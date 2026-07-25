import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "./FormatoSalida";

const EVENTOS: Record<EventoStreaming["tipo"], string> = {
  inicio: "progress",
  pensamiento: "reasoning.delta",
  respuesta: "response.delta",
  imagen: "image.generated",
  conversacion: "conversation.selected",
  ejecucion: "execution.selected",
  estado: "provider.status",
  modelo: "model.selected",
  contexto: "context.prepared",
  fin: "completed",
  pausado: "stream.paused",
  error: "stream.error",
};

export class RenderizadorAgenteStreaming {
  private response = "";
  private reasoning = "";
  private model?: string;
  private conversationId?: string;
  private executionId?: string;
  private progress: string[] = [];
  private context?: Record<string, unknown>;
  private paused = false;
  private error?: string;

  constructor(
    private readonly command: string,
    private readonly format: FormatoSalida,
    private readonly requestId: string = crypto.randomUUID(),
    private readonly write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  ) {}

  renderizar(evento: EventoStreaming): void {
    if (evento.tipo === "inicio" && evento.mensaje) this.progress.push(evento.mensaje);
    if (evento.tipo === "pensamiento") this.reasoning += evento.contenido;
    if (evento.tipo === "respuesta") this.response += evento.contenido;
    if (evento.tipo === "imagen") this.response += `\n[Imagen: ${evento.url}]`;
    if (evento.tipo === "modelo") this.model = evento.nombre;
    if (evento.tipo === "conversacion") this.conversationId = evento.id;
    if (evento.tipo === "ejecucion") this.executionId = evento.id;
    if (evento.tipo === "contexto") this.context = { path: evento.ruta, bytes: evento.bytes, estimatedTokens: evento.tokensEstimados, includedFiles: evento.archivosIncluidos, omittedFiles: evento.omitidos, truncatedFiles: evento.truncados, fromCache: evento.desdeCache };
    if (evento.tipo === "pausado") this.paused = true;
    if (evento.tipo === "error") this.error = evento.mensaje;

    if (this.format === "jsonl") {
      this.write(JSON.stringify({ protocol: "capi.agent.v1", requestId: this.requestId, command: this.command, event: EVENTOS[evento.tipo], data: this.dataEvento(evento) }));
      return;
    }
    if ((this.format === "json" || this.format === "markdown") && (evento.tipo === "fin" || evento.tipo === "pausado" || evento.tipo === "error")) {
      this.write(serializarSalida(crearSobreExito(this.command, this.resultado(), { requestId: this.requestId }), this.format));
    }
  }

  resultado() {
    return {
      response: this.response,
      reasoning: this.reasoning || undefined,
      model: this.model,
      conversationId: this.conversationId,
      executionId: this.executionId,
      context: this.context,
      progress: this.progress,
      paused: this.paused || undefined,
      error: this.error,
    };
  }

  private dataEvento(evento: EventoStreaming): Record<string, unknown> {
    if (evento.tipo === "inicio") return { message: evento.mensaje };
    if (evento.tipo === "pensamiento" || evento.tipo === "respuesta") return { content: evento.contenido };
    if (evento.tipo === "imagen") return { url: evento.url, alt: evento.alt };
    if (evento.tipo === "modelo") return { model: evento.nombre };
    if (evento.tipo === "conversacion") return { conversationId: evento.id };
    if (evento.tipo === "ejecucion") return { executionId: evento.id };
    if (evento.tipo === "estado") return { status:evento.estado,progressDetected:evento.progresoDetectado,strategy:evento.estrategia,details:evento.detalles };
    if (evento.tipo === "contexto") return this.context ?? {};
    if (evento.tipo === "pausado") return { motivo: evento.motivo, conversacionId: evento.conversacionId };
    if (evento.tipo === "error") return { mensaje: evento.mensaje, recuperable: evento.recuperable };
    return this.resultado();
  }
}
