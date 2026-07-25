import consola from "consola";
import type { EventoStreaming } from "../../nucleo/chat/EventoStreaming";

export class RenderizadorStreaming {
  private pensando = false;

  renderizar(evento: EventoStreaming): void {
    if (evento.tipo === "inicio" && evento.mensaje) {
      consola.info(evento.mensaje);
      return;
    }

    if (evento.tipo === "modelo") {
      consola.info(`Modelo activo: ${evento.nombre}`);
      return;
    }

    if (evento.tipo === "contexto") {
      consola.info(`Contexto preparado: ${evento.archivosIncluidos} archivo(s), ${evento.bytes} bytes, ~${evento.tokensEstimados} tokens${evento.desdeCache ? " (cache)" : ""}`);
      if (evento.omitidos || evento.truncados) consola.warn(`Contexto reducido: ${evento.omitidos} omitido(s), ${evento.truncados} truncado(s)`);
      return;
    }

    if (evento.tipo === "pensamiento") {
      if (!this.pensando) {
        process.stdout.write("\n\x1b[90m🤔 Pensando...\n");
        this.pensando = true;
      }
      process.stdout.write(`\x1b[90m${evento.contenido}\x1b[0m`);
      return;
    }

    if (evento.tipo === "respuesta") {
      if (this.pensando) {
        process.stdout.write("\n\n\x1b[32m💡 Respuesta:\x1b[0m\n");
        this.pensando = false;
      }
      process.stdout.write(evento.contenido);
      return;
    }

    if (evento.tipo === "imagen") {
      process.stdout.write(`\n[Imagen generada: ${evento.alt ?? "sin descripción"}] ${evento.url}\n`);
      return;
    }

    if (evento.tipo === "fin") {
      process.stdout.write("\n");
      return;
    }

    if (evento.tipo === "pausado") {
      consola.warn(`${evento.motivo}${evento.conversacionId ? ` Conversación: ${evento.conversacionId}` : ""}`);
      return;
    }

    if (evento.tipo === "error") {
      consola.error(evento.mensaje);
    }
  }
}
