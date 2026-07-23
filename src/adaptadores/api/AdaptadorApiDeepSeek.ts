import type { PuertoApiDeepSeek } from "../../dominio/deepseek/puertos/PuertoApiDeepSeek";
import type { PuertoInterfazWebBridge } from "../../dominio/deepseek/puertos/PuertoInterfazWebBridge";
import type { SesionDeepSeek } from "../../dominio/deepseek/entidades/SesionDeepSeek";
import type { Conversacion } from "../../dominio/deepseek/entidades/Conversacion";

interface SesionKimi {
  thumbcache: string;
  awsWafToken: string;
  dsSessionId: string;
  userToken: string;
  authorization: string;
}

export class AdaptadorApiDeepSeek implements PuertoApiDeepSeek {
  constructor(private readonly webbridge: PuertoInterfazWebBridge) {}

  async iniciarSesion(): Promise<SesionDeepSeek> {
    await this.webbridge.navegar("https://chat.deepseek.com", true, "CAPI Login");

    await new Promise((r) => setTimeout(r, 5000));

    const cookies = await this.webbridge.evaluar<Record<string, string>>(
      "Object.fromEntries(document.cookie.split(';').map(c => { const [k,...v] = c.trim().split('='); return [k, v.join('=')]; }))"
    );

    const raw = cookies.value ?? {};
    const thumbcache = raw["thumbcache"] || "";
    const awsWafToken = raw["aws-waf-token"] || "";
    const dsSessionId = raw["ds-session-id"] || "";

    const userTokenResult = await this.webbridge.evaluar<{ user_token?: string }>(
      `(function(){try{const m=document.body.innerText.match(/"user_token"\\s*:\\s*"([^"]+)"/);return{user_token:m?.[1]};}catch{return{};}})()`
    );
    const userToken = userTokenResult.value?.user_token || "";

    const authResult = await this.webbridge.evaluar<{ authorization?: string }>(
      `(function(){try{const m=document.body.innerText.match(/"authorization"\\s*:\\s*"([^"]+)"/);return{authorization:m?.[1]};}catch{return{};}})()`
    );
    const authorization = authResult.value?.authorization || "";

    await this.webbridge.cerrarSesion();

    return {
      thumbcache,
      awsWafToken,
      dsSessionId,
      userToken,
      authorization,
      expiresAt: Date.now() + 3 * 60 * 60 * 1000,
    };
  }

  async listarConversaciones(sesion: SesionDeepSeek): Promise<Conversacion[]> {
    const cookieHeader = [sesion.thumbcache, sesion.awsWafToken, sesion.dsSessionId]
      .filter(Boolean)
      .join("; ");

    const respuesta = await fetch(
      "https://chat.deepseek.com/api/v0/chat_session/fetch_page?lte_cursor.pinned=false",
      {
        method: "GET",
        headers: {
          Accept: "*/*",
          Authorization: sesion.authorization,
          Cookie: cookieHeader,
        },
      }
    );

    if (!respuesta.ok) return [];

    const datos = await respuesta.json() as {
      data?: {
        biz_data?: {
          chat_sessions?: Array<{
            id: string;
            title: string;
            title_type: string;
            pinned: boolean;
            model_type: string;
            updated_at: number;
          }>;
        };
      };
    };

    const sesiones = datos?.data?.biz_data?.chat_sessions ?? [];

    return sesiones.map((s) => ({
      id: s.id,
      titulo: s.title || "Sin título",
      fijada: s.pinned ?? false,
      tipoModelo: s.model_type ?? "",
      actualizadaEn: (s.updated_at ?? 0) * 1000,
      mensajes: [],
    }));
  }
}
