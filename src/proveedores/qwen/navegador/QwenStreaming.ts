import { CAPI_CONFIG } from "../../../configuracion/ConstantesCapi";
import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptExtraerEstadoStreamingQwen } from "../scripts/extraerEstadoStreaming";
import { extraerRespuestaSnapshotQwen } from "./ExtraerRespuestaSnapshotQwen";

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizar = (texto: string) => texto.replace(/\u200B/g, "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
const INTERVALO_RESCATE_SNAPSHOT = 30_000;

interface EstadoQwen {
  think: string;
  response: string;
  done: boolean;
  isGenerating?: boolean;
  isAssistant: boolean;
  isError: boolean;
  errorMessage: string;
  extractionStrategy?: string;
}

export class QwenStreaming {
  constructor(
    private readonly transporte: TransporteNavegador,
    private readonly pausa: (ms: number) => Promise<unknown> = dormir,
    private readonly ahora: () => number = Date.now,
  ) {}

  async *observar(): AsyncGenerator<EventoStreaming> {
    let ultimoPensamiento = "", ultimaRespuesta = "", observada = "";
    let ultimoCambio = this.ahora();
    let ultimoRescateSnapshot = 0;
    const inicio = this.ahora();
    let respondiendo = false;

    while (true) {
      await this.pausa(CAPI_CONFIG.TIMEOUTS_MS.INTERVALO_STREAMING);
      let evento: EstadoQwen | undefined;
      try {
        evento = (await this.transporte.evaluar<EstadoQwen>(scriptExtraerEstadoStreamingQwen())).value;
      } catch {
        // WebBridge puede fallar de forma transitoria durante navegaciones o renders largos.
        continue;
      }
      const ahora = this.ahora();

      if (!evento) {
        if (ahora - inicio >= CAPI_CONFIG.TIMEOUTS_MS.STREAMING_CHUNK_TIMEOUT) {
          const conversacionId = await this.obtenerConversacionActual();
          yield { tipo: "pausado", motivo: "No se pudo leer el estado de Qwen durante un periodo prolongado. Puedes retomar con 'capi chat --continuar'", conversacionId: conversacionId ?? undefined };
          return;
        }
        continue;
      }
      if (evento.isError) {
        yield { tipo: "error", mensaje: evento.errorMessage || "Error en Qwen", recuperable: true };
        return;
      }
      if (!evento.isAssistant) {
        if (ahora - inicio >= CAPI_CONFIG.TIMEOUTS_MS.STREAMING_CHUNK_TIMEOUT) {
          const conversacionId = await this.obtenerConversacionActual();
          yield { tipo: "pausado", motivo: "Qwen no creó todavía un turno asistente. Puedes retomar con 'capi chat --continuar'", conversacionId: conversacionId ?? undefined };
          return;
        }
        continue;
      }

      const pensamiento = normalizar(evento.think || "");
      let respuesta = normalizar(evento.response || "");
      if (!respuesta && /pensamiento completado/i.test(pensamiento) && this.transporte.snapshotAccesibilidad && ahora - ultimoRescateSnapshot >= INTERVALO_RESCATE_SNAPSHOT) {
        ultimoRescateSnapshot = ahora;
        try {
          respuesta = normalizar(extraerRespuestaSnapshotQwen((await this.transporte.snapshotAccesibilidad()).tree));
        } catch {
          // El rescate es complementario; un fallo no interrumpe el polling principal.
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
        yield { tipo: "respuesta", contenido: delta, estrategia: respuesta === evento.response ? (evento.extractionStrategy ?? "dom") : "snapshot-accesible" };
      }
      if (respondiendo && respuesta) {
        const estabilidad = evento.done ? CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN_DOM_DONE : evento.isGenerating ? CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN_CON_STOP : CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN;
        if (ahora - ultimoCambio >= estabilidad) { yield { tipo: "fin" }; return; }
      }
      // No existe timeout interno mientras Qwen tenga un turno asistente válido.
      // El límite absoluto, cuando se desea, lo impone PeticionChat.timeoutMs.
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
