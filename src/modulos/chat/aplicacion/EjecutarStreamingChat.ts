import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../../nucleo/chat/PeticionChat";
import type { ProveedorChat } from "../../../nucleo/proveedores/ProveedorChat";

export class EjecutarStreamingChat {
  respuesta = "";
  modelo?: string;
  conversacionId?: string;

  async *ejecutar(
    proveedor: ProveedorChat,
    peticion: PeticionChat,
    conversacionId: string | undefined,
  ): AsyncGenerator<EventoStreaming> {
    this.respuesta = "";
    this.modelo = peticion.modelo;
    this.conversacionId = conversacionId;
    const iterador = proveedor
      .enviarMensaje({ ...peticion, conversacionId })
      [Symbol.asyncIterator]();
    const limite = peticion.timeoutMs
      ? Date.now() + peticion.timeoutMs
      : undefined;

    while (true) {
      const restante = limite ? limite - Date.now() : undefined;
      if (restante != null && restante <= 0) {
        await iterador.return?.(undefined as never);
        throw new Error(`La operación excedió ${peticion.timeoutMs} ms`);
      }
      const siguiente =
        restante == null
          ? await iterador.next()
          : await Promise.race([
              iterador.next(),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        `La operación excedió ${peticion.timeoutMs} ms`,
                      ),
                    ),
                  restante,
                ),
              ),
            ]);
      if (siguiente.done) break;
      const evento = siguiente.value;
      if (evento.tipo === "respuesta") this.respuesta += evento.contenido;
      if (evento.tipo === "modelo") this.modelo = evento.nombre;
      if (evento.tipo === "conversacion") this.conversacionId = evento.id;
      yield evento;
    }

    this.conversacionId =
      this.conversacionId ??
      (await proveedor.obtenerConversacionActual?.()) ??
      undefined;
  }
}
