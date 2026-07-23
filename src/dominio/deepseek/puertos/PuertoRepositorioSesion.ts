import type { SesionDeepSeek } from "../entidades/SesionDeepSeek";

export interface PuertoRepositorioSesion {
  cargar(): SesionDeepSeek | null;
  guardar(sesion: SesionDeepSeek): void;
  existe(): boolean;
}
