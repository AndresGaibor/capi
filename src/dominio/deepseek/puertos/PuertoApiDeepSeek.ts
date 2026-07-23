import type { Conversacion } from "../entidades/Conversacion";
import type { SesionDeepSeek } from "../entidades/SesionDeepSeek";

export interface DatosSesion {
  session: SesionDeepSeek;
  conversations: Conversacion[];
}

export interface PuertoApiDeepSeek {
  listarConversaciones(sesion: SesionDeepSeek): Promise<Conversacion[]>;
  iniciarSesion(): Promise<SesionDeepSeek>;
}
