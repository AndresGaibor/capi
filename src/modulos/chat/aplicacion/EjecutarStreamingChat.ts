import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../../nucleo/chat/PeticionChat";
import type { ProveedorChat } from "../../../nucleo/proveedores/ProveedorChat";

function siguienteConTimeout<T>(iterador: AsyncIterator<T>, timeoutMs: number, mensajeTimeoutMs = timeoutMs): Promise<IteratorResult<T>> {
  return new Promise((resolver, rechazar) => {
    const temporizador = setTimeout(() => {
      rechazar(new Error(`La operación excedió ${mensajeTimeoutMs} ms`));
    }, timeoutMs);
    iterador.next().then(
      (resultado) => { clearTimeout(temporizador); resolver(resultado); },
      (error) => { clearTimeout(temporizador); rechazar(error); },
    );
  });
}

function promesaConTimeout<T>(operacion: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const temporizador = setTimeout(() => rechazar(new Error(`La operación excedió ${timeoutMs} ms`)), timeoutMs);
    operacion.then(
      (resultado) => { clearTimeout(temporizador); resolver(resultado); },
      (error) => { clearTimeout(temporizador); rechazar(error); },
    );
  });
}

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
    let iteradorCerrado = false;
    const limite = peticion.timeoutMs
      ? Date.now() + peticion.timeoutMs
      : undefined;

    try {
      while (true) {
        const restante = limite ? limite - Date.now() : undefined;
        if (restante != null && restante <= 0) throw new Error(`La operación excedió ${peticion.timeoutMs} ms`);
        let siguiente: IteratorResult<EventoStreaming>;
        try {
          siguiente = restante == null ? await iterador.next() : await siguienteConTimeout(iterador, restante, peticion.timeoutMs);
        } catch (error) {
          await iterador.return?.(undefined as never);
          iteradorCerrado = true;
          throw error;
        }
        if (siguiente.done) { iteradorCerrado = true; break; }
        const evento = siguiente.value;
        if (evento.tipo === "respuesta") this.respuesta = evento.reemplazo ? evento.contenido : this.respuesta + evento.contenido;
        if (evento.tipo === "modelo") this.modelo = evento.nombre;
        if (evento.tipo === "conversacion") this.conversacionId = evento.id;
        yield evento;
      }

      const restanteFinal = limite ? limite - Date.now() : undefined;
      if (!this.conversacionId && proveedor.obtenerConversacionActual && (restanteFinal == null || restanteFinal > 0)) {
        this.conversacionId = restanteFinal == null
          ? (await proveedor.obtenerConversacionActual()) ?? undefined
          : (await promesaConTimeout(proveedor.obtenerConversacionActual(), restanteFinal)) ?? undefined;
      }
    } finally {
      if (!iteradorCerrado) {
        await iterador.return?.(undefined as never);
        iteradorCerrado = true;
      }
    }
  }
}
