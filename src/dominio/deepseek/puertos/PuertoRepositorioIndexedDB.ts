import type { Conversacion } from "../entidades/Conversacion";

export interface PuertoRepositorioIndexedDB {
  obtenerConversacion(idConversacion: string): Promise<Conversacion | null>;
}
