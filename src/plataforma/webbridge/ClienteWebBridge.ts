import { CAPI_CONFIG } from "../../configuracion/ConstantesCapi";
const SESION = "capi-capture";
export class ClienteWebBridge {
  constructor(private readonly baseUrl = "http://127.0.0.1:10086") {}
  async estaDisponible(): Promise<boolean> { try { const r = await fetch(this.baseUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) }); return r.ok || r.status < 500; } catch { return false; } }
  private async comando<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
    const r = await fetch(`${this.baseUrl}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, args, session: SESION }), signal: AbortSignal.timeout(CAPI_CONFIG.TIMEOUTS_MS.WEBBRIDGE_COMMAND) });
    const j = await r.json() as { ok: boolean; data: T; error?: unknown };
    if (!j.ok) throw new Error(`WebBridge error: ${JSON.stringify(j.error ?? j)}`);
    return j.data;
  }
  navegar(url: string, nuevaPestana: boolean, tituloGrupo?: string) { return this.comando<{ success: boolean }>("navigate", { url, newTab: nuevaPestana, group_title: tituloGrupo }); }
  evaluar<T>(codigo: string) { return this.comando<{ value: T }>("evaluate", { code: codigo }); }
  cdp<T>(method: string, params: Record<string, unknown> = {}) { return this.comando<T>("cdp", { method, params }); }
  cerrarSesion() { return this.comando<void>("close_session"); }
}
