import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../../nucleo/chat/PeticionChat";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";

export class EnviarMensajeStreaming {
  constructor(private readonly proveedores: RegistroProveedores) {}
  ejecutar(proveedorId: string, peticion: PeticionChat): AsyncGenerator<EventoStreaming> {
    return this.proveedores.obtener(proveedorId).enviarMensaje(peticion);
  }
}
