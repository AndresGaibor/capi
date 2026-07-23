import type { PuertoInterfazWebBridge } from "../puertos/PuertoInterfazWebBridge";
import type { PuertoRepositorioIndexedDB } from "../puertos/PuertoRepositorioIndexedDB";
import type { PuertoSalidaCLI } from "../puertos/PuertoSalidaCLI";
import type { Pensamiento } from "../entidades";
import { normalizarRespuesta, truncarTexto } from "../servicios/NormalizarRespuestaDeepSeek";

export interface ResultadoEnvio {
  pensamiento: Pensamiento | null;
  respuesta: string;
}

export class EnviarMensaje {
  constructor(
    private readonly webbridge: PuertoInterfazWebBridge,
    private readonly indexeddb: PuertoRepositorioIndexedDB,
    private readonly salida: PuertoSalidaCLI
  ) {}

  async ejecutar(
    idConversacion: string,
    prompt: string,
    tiempoEsperaMs = 15_000
  ): Promise<ResultadoEnvio> {
    const disponible = await this.webbridge.estaDisponible();
    if (!disponible) {
      this.salida.error("Kimi WebBridge no está disponible. Abre Kimi Browser Companion.");
      return { pensamiento: null, respuesta: "" };
    }

    this.salida.info("Enviando mensaje...");

    const urlChat = `https://chat.deepseek.com/a/chat/s/${idConversacion}`;
    await this.webbridge.navegar(urlChat, true, "CAPI Send");
    await new Promise((r) => setTimeout(r, 8000));

    this.salida.info("Esperando a que el textarea exista...");
    let textareaExiste = false;
    for (let i = 0; i < 15; i++) {
      const estado = await this.webbridge.evaluar<boolean>(`
        (() => !!document.querySelector('textarea[name="search"]'))()
      `);
      if (estado.value) {
        textareaExiste = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!textareaExiste) {
      this.salida.error("El textarea no apareció.");
      await this.webbridge.cerrarSesion();
      return { pensamiento: null, respuesta: "" };
    }

    this.salida.info("Escribiendo prompt y enviando...");
    const sendResult = await this.webbridge.evaluar<{ ok: boolean; error?: string }>(`
      (() => {
        const textarea = document.querySelector('textarea[name="search"]');
        if (!textarea) return { ok: false, error: "no_textarea" };
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeSetter.call(textarea, ${JSON.stringify(prompt)});
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        setTimeout(() => {
          const btn = document.querySelector('div[role="button"].ds-button--primary:not(.ds-button--disabled)');
          if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          else {
            const backup = document.querySelector('div[role="button"].ds-button--primary');
            if (backup) backup.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        }, 500);
        return { ok: true };
      })()
    `);

    if (!sendResult.value?.ok) {
      this.salida.error(`Error al enviar: ${sendResult.value?.error}`);
      await this.webbridge.cerrarSesion();
      return { pensamiento: null, respuesta: "" };
    }

    this.salida.info("Esperando respuesta...\n");

    const esperaMaxMs = 35 * 60 * 1000;
    const intervaloMs = 2000;
    const maxIntentos = Math.ceil(esperaMaxMs / intervaloMs);

    let ultimoMsgId = "";
    let ultimoRespuestaTexto = "";

    for (let intento = 0; intento < maxIntentos; intento++) {
      await new Promise((r) => setTimeout(r, intervaloMs));

      const conversacion = await this.indexeddb.obtenerConversacion(idConversacion);
      if (!conversacion || conversacion.mensajes.length === 0) {
        if (intento % 15 === 0) {
          this.salida.info(`  Cargando conversación... (${Math.round((intento * intervaloMs) / 1000)}s)`);
        }
        continue;
      }

      const ultimoMensaje = conversacion.mensajes.at(-1);
      if (!ultimoMensaje) {
        if (intento % 15 === 0) {
          this.salida.info(`  Procesando...`);
        }
        continue;
      }

      if (ultimoMensaje.id === ultimoMsgId) {
        if (intento % 15 === 0) {
          this.salida.info(`  Escribiendo... (${Math.round((intento * intervaloMs) / 1000)}s)`);
        }
        continue;
      }

      if (ultimoMensaje.rol !== "asistente") {
        ultimoMsgId = ultimoMensaje.id;
        if (intento % 15 === 0) {
          this.salida.info(`  Usuario escribió, esperando respuesta...`);
        }
        continue;
      }

      const fragmentos = ultimoMensaje.fragmentos;
      let pensamientoTexto = "";
      let respuestaTexto = "";

      for (const frag of fragmentos) {
        if (frag.type === "THINK") pensamientoTexto += frag.content || "";
        else if (frag.type === "RESPONSE") respuestaTexto += frag.content || "";
      }

      if (!respuestaTexto) {
        if (intento % 15 === 0) {
          this.salida.info(`  Respuesta en progreso...`);
        }
        continue;
      }

      if (respuestaTexto === ultimoRespuestaTexto) {
        if (intento % 15 === 0) {
          this.salida.info(`  Respuesta completándose...`);
        }
        continue;
      }

      if (pensamientoTexto) {
        const { texto, truncado } = truncarTexto(pensamientoTexto, 600);
        this.salida.log(`\n💭 DeepThink:\n  ${texto.replace(/\n/g, "\n  ")}${truncado ? "\n  [...]" : ""}\n`);
      }

      const respuestaLimpia = normalizarRespuesta(respuestaTexto);
      this.salida.log(`🤖 DeepSeek:\n${respuestaLimpia}\n`);

      await this.webbridge.cerrarSesion();
      return { pensamiento: pensamientoTexto ? { contenido: pensamientoTexto } : null, respuesta: respuestaLimpia };
    }

    this.salida.error("Se agotó el tiempo de espera (35 min).");
    await this.webbridge.cerrarSesion();
    return { pensamiento: null, respuesta: "" };
  }
}
