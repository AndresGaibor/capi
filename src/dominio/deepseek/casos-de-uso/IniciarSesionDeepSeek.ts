import type { PuertoInterfazWebBridge } from "../puertos/PuertoInterfazWebBridge";
import type { PuertoRepositorioSesion } from "../puertos/PuertoRepositorioSesion";
import type { PuertoSalidaCLI } from "../puertos/PuertoSalidaCLI";
import type { SesionDeepSeek } from "../entidades/SesionDeepSeek";
import { sesionEsValida } from "../entidades/SesionDeepSeek";

const BRIDGE_URL = "http://localhost:3847/api/deepseek/session";

interface CookieCdp {
  name: string;
  value: string;
  domain?: string;
}

export class IniciarSesionDeepSeek {
  constructor(
    private readonly webbridge: PuertoInterfazWebBridge,
    private readonly persistencia: PuertoRepositorioSesion,
    private readonly salida: PuertoSalidaCLI
  ) {}

  async ejecutar(): Promise<SesionDeepSeek | null> {
    const existente = this.persistencia.cargar();
    if (sesionEsValida(existente)) {
      this.salida.success("Sesión existente cargada.");
      return existente;
    }

    this.salida.info("No hay sesión. Capturando desde DeepSeek via WebBridge...");

    const disponible = await this.webbridge.estaDisponible();
    if (!disponible) {
      this.salida.error("Kimi WebBridge no está disponible.");
      return null;
    }

    this.salida.info("Abriendo DeepSeek Chat...");
    await this.webbridge.navegar("https://chat.deepseek.com", true, "CAPI Session");
    await new Promise((r) => setTimeout(r, 6000));

    this.salida.info("Esperando cookies (CDP)...");
    let cookies: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      const cdpResult = await this.webbridge.cdp<{ cookies?: CookieCdp[] }>(
        "Network.getAllCookies",
        {}
      );
      const allCookies = cdpResult?.cookies ?? [];
      cookies = {};
      for (const c of allCookies) {
        const d = c.domain ?? "";
        if (d.includes("deepseek") || d.includes("chatdeepseek")) {
          cookies[c.name] = c.value;
        }
      }
      if (cookies["ds_session_id"]) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!cookies["ds_session_id"]) {
      this.salida.error("No se pudo obtener ds_session_id.");
      await this.webbridge.cerrarSesion();
      return null;
    }

    this.salida.info("Extrayendo userToken desde localStorage...");
    const tokenResult = await this.webbridge.evaluar<{ user_token?: string }>(
      `(function(){try{const raw=localStorage.getItem('userToken');if(!raw)return{};try{const p=JSON.parse(raw);return{user_token:typeof p==='string'?p:(p&&p.value)||null};}catch{return{user_token:raw};}}catch{return{};}})()`
    );
    const userToken = tokenResult.value?.user_token ?? "";

    if (!userToken) {
      this.salida.error("No se pudo obtener userToken.");
      await this.webbridge.cerrarSesion();
      return null;
    }

    this.salida.info("Guardando sesión en bridge server...");
    const thumbcache = Object.entries(cookies).find(([k]) => k.startsWith(".thumbcache"));
    const bundle = {
      source: "deepseek-kimi-webbridge",
      capturedAt: new Date().toISOString(),
      authorization: userToken.startsWith("Bearer ") ? userToken : `Bearer ${userToken}`,
      cookies: {
        thumbcache: thumbcache ? `${thumbcache[0]}=${thumbcache[1]}` : "",
        awsWafToken: cookies["aws-waf-token"] ? `aws-waf-token=${cookies["aws-waf-token"]}` : "",
        dsSessionId: `ds_session_id=${cookies["ds_session_id"]}`,
      },
    };

    try {
      const res = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundle),
      });
      if (!res.ok) {
        this.salida.warn(`Bridge server respondió con ${res.status}. Guardando solo localmente.`);
      } else {
        this.salida.info("Sesión guardada en bridge server.");
      }
    } catch (e) {
      this.salida.warn(`Bridge server no disponible: ${e}. Guardando solo localmente.`);
    }

    const sesion: SesionDeepSeek = {
      thumbcache: bundle.cookies.thumbcache,
      awsWafToken: bundle.cookies.awsWafToken,
      dsSessionId: bundle.cookies.dsSessionId,
      userToken,
      authorization: bundle.authorization,
      expiresAt: Date.now() + 3 * 60 * 60 * 1000,
    };

    this.persistencia.guardar(sesion);
    this.salida.success("Sesión capturada y guardada.");
    await this.webbridge.cerrarSesion();
    return sesion;
  }
}
