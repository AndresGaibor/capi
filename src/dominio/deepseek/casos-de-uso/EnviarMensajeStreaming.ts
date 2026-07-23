import type { PuertoInterfazWebBridge } from "../puertos/PuertoInterfazWebBridge";
import type { PuertoSalidaCLI } from "../puertos/PuertoSalidaCLI";

export interface EventoStream {
  type: "think" | "response" | "start_response" | "done" | "error";
  content?: string;
}

export interface OpcionesChat {
  modelo?: "default" | "expert" | "vision";
  deepThink?: boolean;
  search?: boolean;
  archivos?: string[];
}

export class EnviarMensajeStreaming {
  constructor(
    private readonly webbridge: PuertoInterfazWebBridge,
    private readonly salida: PuertoSalidaCLI
  ) {}

  private async configurarInterfaz(opciones: OpcionesChat, esChatNuevo: boolean): Promise<void> {
    if (!esChatNuevo && opciones.modelo) {
      console.warn(`\x1b[33m⚠️ Advertencia: No se permite cambiar el modelo en una conversación ya iniciada. El cambio de modelo solo está disponible en chats nuevos ('new'). Se mantendrá el modelo actual.\x1b[0m`);
    }

    const result = await this.webbridge.configurarInterfazDOM(opciones, esChatNuevo);

    if (result?.warningModelo && esChatNuevo && opciones.modelo) {
      console.warn(`\x1b[33m⚠️ Advertencia: No se encontró el botón para el modelo '${opciones.modelo}'. Se usará el modelo por defecto.\x1b[0m`);
    }

    await new Promise((r) => setTimeout(r, 500));

    if (opciones.archivos && opciones.archivos.length > 0) {
      if (opciones.modelo === "expert") {
        console.warn("\x1b[33m⚠️ Advertencia: Omitiendo subida de archivos (no soportado en modo Expert).\x1b[0m");
        return;
      }

      try {
        const { resolve } = await import("node:path");
        const archivosAbsolutos = opciones.archivos.map((f) => resolve(f));

        const domData = await this.webbridge.cdp<{ root: { nodeId: number } }>("DOM.getDocument");
        const nodo = await this.webbridge.cdp<{ nodeId: number }>("DOM.querySelector", {
          nodeId: domData.root.nodeId,
          selector: 'input[type="file"]'
        });

        if (nodo.nodeId) {
          await this.webbridge.cdp("DOM.setFileInputFiles", {
            nodeId: nodo.nodeId,
            files: archivosAbsolutos
          });

          await this.webbridge.evaluar(`
            (() => {
              const fi = document.querySelector('input[type="file"]');
              if (fi) {
                fi.dispatchEvent(new Event('change', { bubbles: true }));
                fi.dispatchEvent(new Event('input', { bubbles: true }));
              }
            })()
          `);

          await new Promise((r) => setTimeout(r, 1500));
        } else {
          console.warn("\x1b[33m⚠️ Advertencia: No se encontró el botón de adjuntos. ¿Estás en un chat modo Expert?\x1b[0m");
        }
      } catch (e) {
        console.error("Error al subir archivo via CDP:", e);
      }
    }
  }

  async *ejecutar(
    idConversacion: string,
    prompt: string,
    opciones?: OpcionesChat
  ): AsyncGenerator<EventoStream> {
    const disponible = await this.webbridge.estaDisponible();
    if (!disponible) {
      yield { type: "error", content: "Kimi WebBridge no está disponible." };
      return;
    }

    yield { type: "start_response", content: "Verificando página..." };

    const esChatNuevo = idConversacion === "new";
    const urlChat = esChatNuevo
      ? "https://chat.deepseek.com/"
      : `https://chat.deepseek.com/a/chat/s/${idConversacion}`;

    const urlActual = await this.webbridge.evaluar<string>("window.location.href");

    if (!urlActual.value?.includes(idConversacion)) {
      yield { type: "start_response", content: esChatNuevo ? "Creando chat nuevo..." : "Abriendo conversación..." };
      await this.webbridge.navegar(urlChat, false, "CAPI Stream");
      await new Promise((r) => setTimeout(r, 5000));
    } else {
      yield { type: "start_response", content: "Ya estamos en la conversación." };
    }

    yield { type: "start_response", content: "Esperando textarea..." };
    let textareaLista = false;
    for (let i = 0; i < 15; i++) {
      const ok = await this.webbridge.evaluar<boolean>(
        `!!document.querySelector('textarea[name="search"]')`
      );
      if (ok.value) { textareaLista = true; break; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!textareaLista) {
      yield { type: "error", content: "Textarea no apareció." };
      return;
    }

    if (opciones) {
      yield { type: "start_response", content: "Configurando parámetros del chat..." };
      await this.configurarInterfaz(opciones, esChatNuevo);
    }

    const modeloActual = await this.webbridge.obtenerModeloChatActual();
    if (modeloActual) {
      yield { type: "start_response", content: `Modelo activo en header: [${modeloActual}]` };
    }

    yield { type: "start_response", content: "Enviando prompt..." };

    const clickResult = await this.webbridge.enviarPromptDOM(prompt);

    if (!clickResult?.ok) {
      yield { type: "error", content: "No se pudo enviar el prompt." };
      return;
    }

    await new Promise((r) => setTimeout(r, 1000));

    yield { type: "start_response", content: "Recibiendo respuesta...\n" };

    let nodosaparecieron = false;
    for (let i = 0; i < 50; i++) {
      const counts = await this.webbridge.obtenerConteoRespuestaDOM();
      if (
        (counts.thinkCount ?? 0) > 0 ||
        (counts.respCount ?? 0) > 0 ||
        (counts.markdownCount ?? 0) > 0 ||
        counts.isGenerating
      ) {
        nodosaparecieron = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!nodosaparecieron) {
      yield { type: "error", content: "Timeout: DeepSeek no empezó a generar respuesta." };
      return;
    }

    let lastThink = "";
    let lastResponse = "";
    let iteracionesSinCambio = 0;
    let recibiendoRespuesta = false;
    let terminado = false;
    let intentosRealizados = 0;
    const MAX_INTENTOS = 3;

    while (!terminado) {
      await new Promise((r) => setTimeout(r, 100));

      const estado = await this.webbridge.obtenerEstadoStreamingDOM();

      if (!estado) {
        iteracionesSinCambio++;
        if (iteracionesSinCambio > 100) {
          yield { type: "error", content: "Timeout: No se encontró el área de respuesta." };
          break;
        }
        continue;
      }

      const { think, response, done, isAssistant, isError, errorMessage } = estado;

      if (isError) {
        if (intentosRealizados < MAX_INTENTOS) {
          intentosRealizados++;
          yield { type: "start_response", content: `\n⚠️ Servidor ocupado. Reintentando automáticamente (${intentosRealizados}/${MAX_INTENTOS})...\n` };

          await this.webbridge.evaluar(`
            (() => {
              const btn = document.querySelector('.ds-button--warning');
              if (btn) btn.click();
            })()
          `);

          await new Promise((r) => setTimeout(r, 3000));

          lastThink = "";
          lastResponse = "";
          iteracionesSinCambio = 0;
          recibiendoRespuesta = false;
          continue;
        } else {
          yield { type: "error", content: `\n❌ Error de DeepSeek: ${errorMessage} (Se alcanzó el límite de ${MAX_INTENTOS} reintentos).\n` };
          break;
        }
      }

      if (!isAssistant) {
        iteracionesSinCambio++;
        if (iteracionesSinCambio > 100) {
          yield { type: "error", content: "Timeout: DeepSeek no comenzó a responder." };
          break;
        }
        continue;
      }

      if (!recibiendoRespuesta && think.length > lastThink.length) {
        const delta = think.substring(lastThink.length);
        lastThink = think;
        yield { type: "think", content: delta };
      }

      if (response.length > lastResponse.length) {
        if (!recibiendoRespuesta) {
          recibiendoRespuesta = true;
          yield { type: "start_response", content: "" };
        }
        const delta = response.substring(lastResponse.length);
        lastResponse = response;
        iteracionesSinCambio = 0;
        yield { type: "response", content: delta };
      } else if (recibiendoRespuesta) {
        iteracionesSinCambio++;
      }

      if (think === lastThink && response === lastResponse && (think !== "" || response !== "")) {
        iteracionesSinCambio++;
      }

      if (done || iteracionesSinCambio > 50) {
        yield { type: "done" };
        terminado = true;
        break;
      }
    }

  }
}
