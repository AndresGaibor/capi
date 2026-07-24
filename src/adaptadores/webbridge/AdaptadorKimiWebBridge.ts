import type {
  PuertoInterfazWebBridge,
  ResultadoEvaluacion,
  ConteoRespuestaDOM,
  EstadoStreamingDOM,
} from "../../dominio/deepseek/puertos/PuertoInterfazWebBridge";
import type { OpcionesChat } from "../../dominio/deepseek/casos-de-uso/EnviarMensajeStreaming";
import type { MensajeExtraido } from "../../dominio/deepseek/casos-de-uso/ObtenerMensajes";
import { DomScripts } from "./scripts/DomScripts";
import { CAPI_CONFIG } from "../../configuracion/ConstantesCapi";

const SESSION_NAME = "capi-capture";

export class AdaptadorKimiWebBridge implements PuertoInterfazWebBridge {
  private readonly BASE_URL = "http://127.0.0.1:10086";

  async estaDisponible(): Promise<boolean> {
    try {
      const res = await fetch(this.BASE_URL, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      return res.ok || res.status < 500;
    } catch {
      return false;
    }
  }

  private async ejecutarComando<T>(comando: string, args?: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify({ action: comando, args: args ?? {}, session: SESSION_NAME });
    const response = await fetch(this.BASE_URL + "/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(CAPI_CONFIG.TIMEOUTS_MS.WEBBRIDGE_COMMAND),
    });
    const json = (await response.json()) as { ok: boolean; data: T };
    if (!json.ok) throw new Error(`WebBridge error: ${JSON.stringify(json)}`);
    return json.data;
  }

  async navegar(
    url: string,
    nuevaPestana: boolean,
    tituloGrupo?: string
  ): Promise<{ success: boolean }> {
    return this.ejecutarComando("navigate", {
      url,
      newTab: nuevaPestana,
      group_title: tituloGrupo,
    });
  }

  async evaluar<T = unknown>(codigo: string): Promise<ResultadoEvaluacion & { value: T }> {
    return this.ejecutarComando("evaluate", { code: codigo });
  }

  async cdp<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    return this.ejecutarComando("cdp", { method, params: params ?? {} });
  }

  async cerrarSesion(): Promise<void> {
    await this.ejecutarComando("close_session", {});
  }

  async inyectarScript(script: string): Promise<void> {
    await this.ejecutarComando("evaluate", {
      code: `(function(){${script}})()`,
    });
  }

  async obtenerModeloChatActual(): Promise<string | null> {
    const result = await this.evaluar<string | null>(DomScripts.scriptObtenerModeloHeader());
    return result.value ?? null;
  }

  async configurarInterfazDOM(
    opciones: OpcionesChat,
    esChatNuevo: boolean
  ): Promise<{ warningModelo: boolean }> {
    const result = await this.evaluar<{ warningModelo: boolean }>(
      DomScripts.scriptConfigurarInterfaz(opciones, esChatNuevo)
    );
    return result.value ?? { warningModelo: false };
  }

  async enviarPromptDOM(prompt: string): Promise<{ ok: boolean }> {
    const result = await this.evaluar<{ ok: boolean }>(DomScripts.scriptEnviarPrompt(prompt));
    return result.value ?? { ok: false };
  }

  async obtenerConteoRespuestaDOM(): Promise<ConteoRespuestaDOM> {
    const result = await this.evaluar<ConteoRespuestaDOM>(DomScripts.scriptConteoRespuesta());
    return (
      result.value ?? {
        thinkCount: 0,
        respCount: 0,
        markdownCount: 0,
        isGenerating: false,
      }
    );
  }

  async obtenerEstadoStreamingDOM(): Promise<EstadoStreamingDOM | null> {
    const result = await this.evaluar<EstadoStreamingDOM | null>(
      DomScripts.scriptEstadoStreaming()
    );
    return result.value ?? null;
  }

  async extraerMensajesDOM(): Promise<MensajeExtraido[]> {
    const result = await this.evaluar<MensajeExtraido[]>(DomScripts.scriptExtraerMensajesDOM());
    return result.value ?? [];
  }

  async adjuntarArchivoDOM(rutaArchivo: string): Promise<{ ok: boolean }> {
    try {
      const { resolve, basename, extname } = await import("node:path");
      const { readFileSync, existsSync } = await import("node:fs");

      const absPath = resolve(rutaArchivo);
      if (!existsSync(absPath)) {
        return { ok: false };
      }

      const fileName = basename(absPath);
      const ext = extname(absPath).toLowerCase();
      let mimeType = "text/plain";
      if (ext === ".pdf") mimeType = "application/pdf";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".json") mimeType = "application/json";

      const fileBuffer = readFileSync(absPath);
      const base64 = fileBuffer.toString("base64");

      const res = await this.evaluar<{ ok: boolean }>(
        DomScripts.scriptInyectarArchivoBase64(fileName, mimeType, base64)
      );

      return res.value ?? { ok: false };
    } catch {
      return { ok: false };
    }
  }
}
