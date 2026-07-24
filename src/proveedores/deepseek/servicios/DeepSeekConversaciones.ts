import type { ConversacionChat, ConversacionResumen } from "../../../nucleo/proveedores/ProveedorChat";
import type { DeepSeekClienteConversaciones } from "./DeepSeekClienteConversaciones";
import type { DeepSeekLectorHistorial } from "./DeepSeekLectorHistorial";

export class DeepSeekConversaciones {
  constructor(private readonly cliente: DeepSeekClienteConversaciones, private readonly historial: DeepSeekLectorHistorial) {}
  listar(): Promise<ConversacionResumen[]> { return this.cliente.listar(); }
  mensajes(id: string): Promise<ConversacionChat | null> { return this.historial.obtener(id); }
}
