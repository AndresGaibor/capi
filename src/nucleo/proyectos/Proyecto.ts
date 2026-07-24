export type TipoDeteccionProyecto = "git" | "ruta";

export interface ProyectoDetectado {
  id: string;
  rutaRaiz: string;
  nombre: string;
  tipoDeteccion: TipoDeteccionProyecto;
}

export function crearIdProyecto(rutaRaiz: string): string {
  return Bun.hash(rutaRaiz).toString(16);
}
