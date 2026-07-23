import type { Mensaje } from "./Mensaje";

export interface Conversacion {
  id: string;
  titulo: string;
  fijada: boolean;
  tipoModelo: string;
  actualizadaEn: number;
  mensajes: Mensaje[];
}

export function conversacionTieneRespuesta(conversacion: Conversacion): boolean {
  return conversacion.mensajes.some((m) => m.rol === "asistente");
}
