import type { PuertoInterfazWebBridge } from "../../deepseek/puertos/PuertoInterfazWebBridge";
import type { PuertoSalidaCLI } from "../../deepseek/puertos/PuertoSalidaCLI";
import { CAPI_CONFIG } from "../../../configuracion/ConstantesCapi";
import { scriptEstadoStreamingQwen } from "../../../adaptadores/webbridge/scripts/qwen/scriptEstadoStreamingQwen";

export interface EventoStreamQwen {
  type: "think" | "response" | "start_response" | "done" | "error" | "conversation_id";
  content?: string;
}

function normalizarTextoStreamingQwen(texto: string): string {
  return texto
    .replace(/\u200B/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export class EnviarMensajeStreamingQwen {
  constructor(
    private readonly webbridge: PuertoInterfazWebBridge,
    private readonly salida: PuertoSalidaCLI
  ) {}

  async *ejecutar(
    idConversacion: string,
    prompt: string,
    opciones?: { modelo?: string; thinking?: string }
  ): AsyncGenerator<EventoStreamQwen> {
    const disponible = await this.webbridge.estaDisponible();
    if (!disponible) {
      yield { type: "error", content: "Kimi WebBridge no está disponible." };
      return;
    }

    yield { type: "start_response", content: "Verificando página..." };

    const esChatNuevo = idConversacion === "new";
    const urlChat = esChatNuevo
      ? "https://chat.qwen.ai/"
      : `https://chat.qwen.ai/c/${idConversacion}`;

    const urlActual = await this.webbridge.evaluar<string>("window.location.href");

    if (!urlActual.value?.includes(idConversacion)) {
      yield { type: "start_response", content: esChatNuevo ? "Creando chat nuevo..." : "Abriendo conversación..." };
      await this.webbridge.navegar(urlChat, false, "CAPI Qwen Stream");
      await new Promise((r) => setTimeout(r, 5000));
    } else {
      yield { type: "start_response", content: "Ya estamos en la conversación." };
    }

    yield { type: "start_response", content: "Esperando textarea..." };
    let textareaLista = false;
    for (let i = 0; i < 15; i++) {
      const ok = await this.webbridge.evaluar<boolean>(
        `!!document.querySelector('textarea.message-input-textarea')`
      );
      if (ok.value) { textareaLista = true; break; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!textareaLista) {
      yield { type: "error", content: "Textarea no apareció." };
      return;
    }

    yield { type: "start_response", content: "Enviando prompt..." };

    const scriptEnviar = `
      (async () => {
        const ta = document.querySelector('textarea.message-input-textarea');
        if (!ta) return { ok: false };
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(ta, ${JSON.stringify(prompt)});
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        for (let i = 0; i < 100; i++) {
          const btn = document.querySelector('.message-input-right-button-send:not([disabled])');
          if (btn) { btn.click(); return { ok: true }; }
          await new Promise(r => setTimeout(r, 100));
        }
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        return { ok: true };
      })()
    `;
    const clickResult = await this.webbridge.evaluar<{ ok: boolean }>(scriptEnviar);

    if (!clickResult?.value?.ok) {
      yield { type: "error", content: "No se pudo enviar el prompt." };
      return;
    }

    await new Promise((r) => setTimeout(r, 1000));

    yield { type: "start_response", content: "Recibiendo respuesta...\n" };

    let lastThinkEmitido = "";
    let lastResponseEmitida = "";
    let responseObservada = "";
    let ultimoCambioResponseEn = Date.now();
    let ultimoEstadoValidoEn = Date.now();
    const inicioPollingEn = Date.now();
    let recibiendoRespuesta = false;
    let idConversacionEmitido = false;

    while (true) {
      await new Promise((r) => setTimeout(r, CAPI_CONFIG.TIMEOUTS_MS.INTERVALO_STREAMING));

      let estado;
      try {
        estado = await this.webbridge.evaluar<{
          think: string;
          response: string;
          done: boolean;
          isGenerating?: boolean;
          isAssistant: boolean;
          isError: boolean;
          errorMessage: string;
          conversationId?: string;
        }>(scriptEstadoStreamingQwen());
      } catch (error) {
        yield {
          type: "error",
          content: `WebBridge dejó de responder durante el streaming: ${String(error)}`,
        };
        return;
      }

      const ahora = Date.now();

      if (!estado?.value) {
        if (
          ahora - ultimoEstadoValidoEn >=
          CAPI_CONFIG.TIMEOUTS_MS.STREAMING_CHUNK_TIMEOUT
        ) {
          yield { type: "error", content: "Timeout: No se encontró el área de respuesta." };
          return;
        }
        continue;
      }

      ultimoEstadoValidoEn = ahora;

      const ev = estado.value;
      const think = normalizarTextoStreamingQwen(ev.think || "");
      const response = normalizarTextoStreamingQwen(ev.response || "");

      if (ev.conversationId && !idConversacionEmitido) {
        idConversacionEmitido = true;
        yield { type: "conversation_id", content: ev.conversationId };
      }

      if (ev.isError) {
        yield { type: "error", content: `Error de Qwen: ${ev.errorMessage}` };
        return;
      }

      if (!ev.isAssistant) {
        if (
          ahora - inicioPollingEn >=
          CAPI_CONFIG.TIMEOUTS_MS.STREAMING_CHUNK_TIMEOUT
        ) {
          yield { type: "error", content: "Timeout: Qwen no comenzó a responder." };
          return;
        }
        continue;
      }

      if (recibiendoRespuesta && response.length === 0) {
        continue;
      }

      if (response !== responseObservada) {
        responseObservada = response;
        ultimoCambioResponseEn = ahora;
      }

      if (!recibiendoRespuesta && think !== lastThinkEmitido) {
        const deltaThink = think.startsWith(lastThinkEmitido)
          ? think.slice(lastThinkEmitido.length)
          : "";
        lastThinkEmitido = think;

        if (deltaThink) {
          yield { type: "think", content: deltaThink };
        }
      }

      if (response.length > 0 && !recibiendoRespuesta) {
        recibiendoRespuesta = true;
        yield { type: "start_response", content: "" };
      }

      if (
        response.startsWith(lastResponseEmitida) &&
        response.length > lastResponseEmitida.length
      ) {
        const deltaResponse = response.slice(lastResponseEmitida.length);
        lastResponseEmitida = response;
        yield { type: "response", content: deltaResponse };
      }

      if (!recibiendoRespuesta || response.length === 0) {
        continue;
      }

      const tiempoEstable = ahora - ultimoCambioResponseEn;
      const estabilidadRequerida = ev.done
        ? CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN_DOM_DONE
        : ev.isGenerating
          ? CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN_CON_STOP
          : CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN;

      if (tiempoEstable >= estabilidadRequerida) {
        yield { type: "done" };
        return;
      }
    }
  }
}
