import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "./FormatoSalida";

const EVENTOS: Record<EventoStreaming["tipo"], string> = {
  inicio: "progress", pensamiento: "reasoning.delta", respuesta: "response.delta", conversacion: "conversation.selected", modelo: "model.selected", fin: "completed",
};

export class RenderizadorAgenteStreaming {
  private response = "";
  private reasoning = "";
  private model?: string;
  private conversationId?: string;
  private progress: string[] = [];

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
    if (evento.tipo === "modelo") this.model = evento.nombre;
    if (evento.tipo === "conversacion") this.conversationId = evento.id;

    if (this.format === "jsonl") {
      this.write(JSON.stringify({ protocol: "capi.agent.v1", requestId: this.requestId, command: this.command, event: EVENTOS[evento.tipo], data: this.dataEvento(evento) }));
      return;
    }
    if ((this.format === "json" || this.format === "markdown") && evento.tipo === "fin") {
      this.write(serializarSalida(crearSobreExito(this.command, this.resultado(), { requestId: this.requestId }), this.format));
    }
  }

  resultado() {
    return { response: this.response, reasoning: this.reasoning || undefined, model: this.model, conversationId: this.conversationId, progress: this.progress };
  }

  private dataEvento(evento: EventoStreaming): Record<string, unknown> {
    if (evento.tipo === "inicio") return { message: evento.mensaje };
    if (evento.tipo === "pensamiento" || evento.tipo === "respuesta") return { content: evento.contenido };
    if (evento.tipo === "modelo") return { model: evento.nombre };
    if (evento.tipo === "conversacion") return { conversationId: evento.id };
    return this.resultado();
  }
}
