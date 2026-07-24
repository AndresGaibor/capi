import type { EventoStreaming } from "../chat/EventoStreaming";
import type { PeticionChat } from "../chat/PeticionChat";
import type { CapacidadesProveedor } from "./CapacidadesProveedor";

export interface ModeloChat { id: string; nombre: string; descripcion?: string; }
export interface ConversacionResumen { id: string; titulo: string; actualizadaEn?: number; modelo?: string; }
export interface MensajeChat { rol: "usuario" | "asistente"; contenido: string; pensamiento?: string; }
export interface ConversacionChat { id: string; titulo?: string; mensajes: MensajeChat[]; }

export interface ProveedorChat {
  readonly id: string;
  readonly capacidades: CapacidadesProveedor;
  verificarDisponibilidad(): Promise<void>;
  enviarMensaje(peticion: PeticionChat): AsyncGenerator<EventoStreaming>;
  listarModelos?(): Promise<ModeloChat[]>;
  seleccionarModelo?(modelo: string): Promise<ModeloChat>;
  listarConversaciones?(): Promise<ConversacionResumen[]>;
  obtenerMensajes?(conversacionId: string): Promise<ConversacionChat | null>;
  importarSesion?(): Promise<void>;
  diagnosticarPagina?(): Promise<Record<string, unknown>>;
  obtenerConversacionActual?(): Promise<string | null>;
}
