export type Modalidad = "text" | "image" | "document";
export type EstadoCapacidad = "confirmada" | "verificada_por_smoke" | "no_compatible";

export interface CapacidadModeloMultimodal {
  proveedor: string;
  modelo: string;
  nombreVisible?: string;
  modalidades: Modalidad[];
  mimeAceptados: string[];
  maxImagenes: number;
  estadoImagen: EstadoCapacidad;
  evidencia: string;
  nombreVisibleDinamico?: boolean;
}

const IMAGENES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const DOCUMENTOS = ["application/pdf", "text/plain"];

export const CAPACIDADES_MULTIMODALES: CapacidadModeloMultimodal[] = [
  {
    proveedor: "qwen", modelo: "preview", nombreVisible: "Qwen3.8-Max-Preview",
    modalidades: ["text", "image", "document"], mimeAceptados: [...IMAGENES, ...DOCUMENTOS],
    maxImagenes: 10, estadoImagen: "verificada_por_smoke",
    evidencia: "La interfaz acepta PNG como miniatura; el smoke visual confirma análisis mediante marcador.",
    nombreVisibleDinamico: true,
  },
  {
    proveedor: "qwen", modelo: "plus", nombreVisible: "Qwen3.7-Plus",
    modalidades: ["text", "image", "document"], mimeAceptados: [...IMAGENES, ...DOCUMENTOS],
    maxImagenes: 10, estadoImagen: "confirmada",
    evidencia: "La descripción visible de la interfaz declara tareas de texto y multimodales.",
    nombreVisibleDinamico: true,
  },
  {
    proveedor: "qwen", modelo: "max", nombreVisible: "Qwen3.7-Max",
    modalidades: ["text", "document"], mimeAceptados: DOCUMENTOS,
    maxImagenes: 0, estadoImagen: "no_compatible",
    evidencia: "La interfaz declara explícitamente que solo admite texto y no tiene visión.",
    nombreVisibleDinamico: true,
  },
  {
    proveedor: "deepseek", modelo: "vision",
    modalidades: ["text", "image"], mimeAceptados: IMAGENES,
    maxImagenes: 5, estadoImagen: "confirmada",
    evidencia: "Alias visual del proveedor.", nombreVisibleDinamico: true,
  },
  {
    proveedor: "deepseek", modelo: "default",
    modalidades: ["text", "document"], mimeAceptados: DOCUMENTOS,
    maxImagenes: 0, estadoImagen: "no_compatible", evidencia: "Modelo textual/documental.",
  },
  {
    proveedor: "deepseek", modelo: "expert",
    modalidades: ["text", "document"], mimeAceptados: DOCUMENTOS,
    maxImagenes: 0, estadoImagen: "no_compatible", evidencia: "Modelo textual/documental.",
  },
];

export function capacidadMultimodal(proveedor: string, modelo?: string) {
  const p = proveedor.toLowerCase();
  const m = (modelo ?? (p === "qwen" ? "preview" : "default")).toLowerCase();
  return CAPACIDADES_MULTIMODALES.find((x) => x.proveedor === p && x.modelo === m);
}
