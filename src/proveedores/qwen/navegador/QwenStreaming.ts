import { CAPI_CONFIG } from "../../../configuracion/ConstantesCapi";
import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptExtraerEstadoStreamingQwen } from "../scripts/extraerEstadoStreaming";

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizar = (texto: string) => texto.replace(/\u200B/g, "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();

interface EstadoQwen {
  think: string;
  response: string;
  done: boolean;
  isGenerating?: boolean;
  isAssistant: boolean;
  isError: boolean;
  errorMessage: string;
}

export class QwenStreaming {
  constructor(
    private readonly transporte: TransporteNavegador,
    private readonly pausa: (ms: number) => Promise<unknown> = dormir,
    private readonly ahora: () => number = Date.now,
  ) {}

  async *observar(): AsyncGenerator<EventoStreaming> {
    let ultimoPensamiento = "", ultimaRespuesta = "", observada = "";
    let ultimoCambio = this.ahora(), vaciaDesde: number | null = null;
    const inicio = this.ahora();
    let respondiendo = false;
    let yieldPausado = false;

    while (true) {
      await this.pausa(CAPI_CONFIG.TIMEOUTS_MS.INTERVALO_STREAMING);
      const resultado = await this.transporte.evaluar<EstadoQwen>(scriptExtraerEstadoStreamingQwen());
      const ahora = this.ahora();

      if (!resultado.value) {
        if (ahora - inicio >= CAPI_CONFIG.TIMEOUTS_MS.STREAMING_CHUNK_TIMEOUT) {
          yieldPausado = true;
        } else {
          continue;
        }
      } else {
        const evento = resultado.value;
        if (evento.isError) {
          yield { tipo: "error", mensaje: evento.errorMessage || "Error en Qwen", recuperable: true };
          return;
        }
        if (!evento.isAssistant) {
          if (ahora - inicio >= CAPI_CONFIG.TIMEOUTS_MS.STREAMING_CHUNK_TIMEOUT) {
            yieldPausado = true;
          } else {
            continue;
          }
        } else {
          const pensamiento = normalizar(evento.think || "");
          const respuesta = normalizar(evento.response || "");
          if (respuesta) vaciaDesde = null;
          else if (/pensamiento completado/i.test(pensamiento)) {
            vaciaDesde ??= ahora;
            if (ahora - vaciaDesde >= CAPI_CONFIG.TIMEOUTS_MS.RESPUESTA_VACIA_QWEN) {
              yieldPausado = true;
            }
          }
          if (!respondiendo && pensamiento !== ultimoPensamiento) {
            const delta = pensamiento.startsWith(ultimoPensamiento) ? pensamiento.slice(ultimoPensamiento.length) : pensamiento;
            ultimoPensamiento = pensamiento;
            if (delta) yield { tipo: "pensamiento", contenido: delta };
          }
          if (respuesta !== observada) { observada = respuesta; ultimoCambio = ahora; }
          if (respuesta && !respondiendo) respondiendo = true;
          if (respuesta.startsWith(ultimaRespuesta) && respuesta.length > ultimaRespuesta.length) {
            const delta = respuesta.slice(ultimaRespuesta.length);
            ultimaRespuesta = respuesta;
            yield { tipo: "respuesta", contenido: delta };
          }
          if (respondiendo && respuesta) {
            const estabilidad = evento.done ? CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN_DOM_DONE : evento.isGenerating ? CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN_CON_STOP : CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN;
            if (ahora - ultimoCambio >= estabilidad) { yield { tipo: "fin" }; return; }
          }
        }
      }

      if (yieldPausado) {
        const conversacionId = await this.obtenerConversacionActual();
        yield { tipo: "pausado", motivo: "Qwen continúa procesando la respuesta. Puedes retomarla con 'capi chat --continuar'", conversacionId: conversacionId ?? undefined };
        return;
      }
    }
  }

  private async obtenerConversacionActual(): Promise<string | null> {
    try {
      const resultado = await this.transporte.evaluar<string>("window.location.href");
      const match = resultado.value?.match(/\/c\/([^/?#]+)/);
      return match ? match[1] ?? null : null;
    } catch {
      return null;
    }
  }
}
