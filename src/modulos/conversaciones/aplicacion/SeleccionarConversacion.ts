export interface CandidataConversacion {
  id: string;
  proveedor: string;
  proyectoLocalId: string;
  usadaEn: number;
  ocupada: boolean;
  archivada: boolean;
  principal?: boolean;
}

export type MotivoSeleccion = "explicita" | "reciente_ruta" | "compartida" | "nueva" | "nueva_por_ocupacion" | "nueva_por_antiguedad";

export interface ResultadoSeleccion {
  conversacionId?: string;
  motivo: MotivoSeleccion;
}

export function seleccionarConversacion(entrada: {
  ahora: number;
  umbralMs: number;
  proveedor: string;
  proyectoLocalId: string;
  conversacionExplicita?: string;
  candidatas: CandidataConversacion[];
}): ResultadoSeleccion {
  if (entrada.conversacionExplicita) return { conversacionId: entrada.conversacionExplicita, motivo: "explicita" };
  const validas = entrada.candidatas.filter((c) => c.proveedor === entrada.proveedor && !c.archivada);
  const libres = validas.filter((c) => !c.ocupada).sort((a, b) => Number(b.principal) - Number(a.principal) || b.usadaEn - a.usadaEn);
  const local = libres.find((c) => c.proyectoLocalId === entrada.proyectoLocalId);
  const elegida = local ?? libres[0];
  if (!elegida) return { motivo: validas.some((c) => c.ocupada) ? "nueva_por_ocupacion" : "nueva" };
  if (entrada.ahora - elegida.usadaEn > entrada.umbralMs) return { motivo: "nueva_por_antiguedad" };
  return { conversacionId: elegida.id, motivo: local ? "reciente_ruta" : "compartida" };
}
