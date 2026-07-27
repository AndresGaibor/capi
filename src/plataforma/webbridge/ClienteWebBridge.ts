import { CAPI_CONFIG } from "../../configuracion/ConstantesCapi";

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function esErrorTransitorio(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    return ["econnrefused", "econnreset", "etimedout", "socket", "fetch failed", "network", "temporarily unavailable"].some((t) => m.includes(t));
  }
  return false;
}

export interface RegistroRedSaneado { url:string; method?:string; status?:number; requestHeaders?:Record<string,string>; responseHeaders?:Record<string,string>; }
export function sanearRegistroRed(entrada:any):RegistroRedSaneado {
  const sanearUrl=(valor:string)=>{ try{const u=new URL(valor); for(const k of [...u.searchParams.keys()]) if(/token|key|auth|session|cookie/i.test(k)) u.searchParams.set(k,"[REDACTADO]"); return u.toString();}catch{return String(valor||"").replace(/(token|key|auth|session)=([^&]+)/gi,"$1=[REDACTADO]");}};
  const headers=(h:any)=>Object.fromEntries(Object.entries(h??{}).filter(([k])=>!/authorization|cookie|set-cookie|token|api-key/i.test(k)).map(([k,v])=>[k,String(v).slice(0,500)]));
  return {url:sanearUrl(String(entrada?.url??"")),method:entrada?.method,status:typeof entrada?.status==="number"?entrada.status:undefined,requestHeaders:headers(entrada?.requestHeaders),responseHeaders:headers(entrada?.responseHeaders)};
}

export class WebBridgeError extends Error {
  readonly codigo: string;
  readonly codigoExtension: string | undefined;
  readonly mensajeOriginal: unknown;
  readonly peticion: { action: string; args: Record<string, unknown> };
  constructor({ codigo, codigoExtension, mensajeOriginal, mensaje, peticion }: { codigo: string; codigoExtension?: string; mensajeOriginal?: unknown; mensaje: string; peticion: { action: string; args: Record<string, unknown> } }) {
    super(mensaje);
    this.name = "WebBridgeError";
    this.codigo = codigo;
    this.codigoExtension = codigoExtension;
    this.mensajeOriginal = mensajeOriginal;
    this.peticion = peticion;
  }
}

const SESION = process.env.CAPI_WEBBRIDGE_SESSION?.trim() || "capi-capture";
type FetchLike = typeof fetch;
export class ClienteWebBridge {
  constructor(private readonly baseUrl = "http://127.0.0.1:10086", private readonly fetcher: FetchLike = fetch) {}
  async estaDisponible(): Promise<boolean> { try { const r = await this.fetcher(this.baseUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) }); return r.ok || r.status < 500; } catch { return false; } }
  private async comando<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
    const peticion = { action, args };
    const MAX_INTENTOS = 3;
    const RETRASO_BASE_MS = 250;
    let ultimoError: unknown;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        const r = await this.fetcher(`${this.baseUrl}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...peticion, session: SESION }), signal: AbortSignal.timeout(CAPI_CONFIG.TIMEOUTS_MS.WEBBRIDGE_COMMAND) });
        const j = await r.json() as { ok: boolean; data: T; error?: { code?: string; message?: string; data?: unknown } };
        if (!j.ok) {
          const errorRemoto = j.error ?? { message: "Respuesta WebBridge sin error definido" };
          const codigo = errorRemoto.code === "tool_error" ? "WEBBRIDGE_TOOL_ERROR" : errorRemoto.code ? `WEBBRIDGE_${String(errorRemoto.code).toUpperCase()}` : "WEBBRIDGE";
          throw new WebBridgeError({
            codigo,
            codigoExtension: errorRemoto.code,
            mensajeOriginal: errorRemoto,
            mensaje: errorRemoto.message ?? `WebBridge rechazo la accion ${action}`,
            peticion,
          });
        }
        return j.data;
      } catch (error) {
        ultimoError = error;
        if (error instanceof WebBridgeError || intento >= MAX_INTENTOS || !esErrorTransitorio(error)) throw error;
        await dormir(RETRASO_BASE_MS * 2 ** (intento - 1));
      }
    }
    throw ultimoError;
  }
  async navegar(url: string, nuevaPestana: boolean, tituloGrupo?: string) {
    const args = { url, newTab: nuevaPestana, group_title: tituloGrupo };
    return this.comando<{ success: boolean }>("navigate", args);
  }
  async seleccionarPestanaActiva(url = "https://chatgpt.com") {
    await this.comando("find_tab", { url, active: true });
  }
  async seleccionarPestanaPorHost(host: string): Promise<boolean> {
    const resultado = await this.comando<{ tabs?: Array<{ url?: string; active?: boolean }> }>("list_tabs");
    const pestañas = resultado.tabs ?? [];
    const compatibles = pestañas.filter((tab) => tab.url?.includes(host));
    const pestaña = compatibles.find((tab) => tab.active) ?? compatibles[0];
    if (!pestaña?.url) return false;
    await this.comando("find_tab", { url: pestaña.url, active: false });
    return true;
  }

  async listarPestanas():Promise<Array<{url?:string;title?:string;active?:boolean}>> { const r=await this.comando<{tabs?:Array<{url?:string;title?:string;active?:boolean}>}>("list_tabs"); return r.tabs??[]; }
  async recuperarPestana(host:string,url?:string):Promise<boolean> { try { const tabs=await this.listarPestanas(); const encontrada=tabs.find(t=>t.url?.includes(host)); if(encontrada?.url){ await this.comando("find_tab",{url:encontrada.url,active:false}); return true; } if(url){ await this.comando("navigate",{url,newTab:true,group_title:"Recuperación CAPI"}); return true; } return false; } catch { return false; } }
  async red(cmd:"start"|"stop"|"list"|"detail",opciones:Record<string,unknown>={}):Promise<unknown> { return this.comando("network",{cmd,...opciones}); }
  async listarRedSaneada():Promise<RegistroRedSaneado[]> { const r:any=await this.red("list"); const registros=Array.isArray(r)?r:(r?.requests??r?.entries??[]); return registros.map(sanearRegistroRed); }

  async subirArchivos(selector: string, archivos: string[]): Promise<void> {
    await this.comando("upload", { selector, files: archivos });
  }
  async rellenar(selector: string, valor: string): Promise<void> {
    await this.comando("fill", { selector, value: valor });
  }
  async click(selector: string): Promise<void> {
    await this.comando("click", { selector });
  }
  async evaluar<T>(codigo: string): Promise<{ value: T }> {
    const resultado = await this.comando<unknown>("evaluate", { code: codigo });
    if (resultado && typeof resultado === "object" && "value" in resultado) return resultado as { value: T };
    return { value: resultado as T };
  }
  snapshotAccesibilidad() { return this.comando<{ url: string; title: string; tree: unknown }>("snapshot"); }
  cdp<T>(method: string, params: Record<string, unknown> = {}) { return this.comando<T>("cdp", { method, params }); }
  cerrarSesion() { return this.comando<void>("close_session"); }
}
