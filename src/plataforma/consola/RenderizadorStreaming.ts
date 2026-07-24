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

    if (evento.tipo === "fin") {
      process.stdout.write("\n");
    }
  }
}
