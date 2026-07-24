import { CAPI_CONFIG } from "../../configuracion/ConstantesCapi";
const SESION = "capi-capture";
type FetchLike = typeof fetch;
export class ClienteWebBridge {
  constructor(private readonly baseUrl = "http://127.0.0.1:10086", private readonly fetcher: FetchLike = fetch) {}
  async estaDisponible(): Promise<boolean> { try { const r = await this.fetcher(this.baseUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) }); return r.ok || r.status < 500; } catch { return false; } }
  private async comando<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
    const r = await this.fetcher(`${this.baseUrl}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, args, session: SESION }), signal: AbortSignal.timeout(CAPI_CONFIG.TIMEOUTS_MS.WEBBRIDGE_COMMAND) });
    const j = await r.json() as { ok: boolean; data: T; error?: unknown };
    if (!j.ok) throw new Error(`WebBridge error: ${JSON.stringify(j.error ?? j)}`);
    return j.data;
  }
  async navegar(url: string, nuevaPestana: boolean, tituloGrupo?: string) {
    const args = { url, newTab: nuevaPestana, group_title: tituloGrupo };
    try {
      return await this.comando<{ success: boolean }>("navigate", args);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      if (!/tab was closed|session .* closed|no tab with given id/i.test(mensaje)) throw error;
      try { await this.comando<void>("close_session"); } catch {}
      return this.comando<{ success: boolean }>("navigate", args);
    }
  }
  evaluar<T>(codigo: string) { return this.comando<{ value: T }>("evaluate", { code: codigo }); }
  cdp<T>(method: string, params: Record<string, unknown> = {}) { return this.comando<T>("cdp", { method, params }); }
  cerrarSesion() { return this.comando<void>("close_session"); }
}
