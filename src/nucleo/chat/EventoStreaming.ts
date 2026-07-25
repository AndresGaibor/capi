export type EventoStreaming =
  | { tipo: "inicio"; mensaje?: string }
  | { tipo: "pensamiento"; contenido: string }
  | { tipo: "respuesta"; contenido: string; reemplazo?: boolean }
  | { tipo: "imagen"; url: string; alt?: string }
  | { tipo: "conversacion"; id: string }
  | { tipo: "modelo"; nombre: string }
  | { tipo: "contexto"; ruta: string; bytes: number; tokensEstimados: number; archivosIncluidos: number; omitidos: number; truncados: number; desdeCache: boolean }
  | { tipo: "fin" }
  | { tipo: "pausado"; motivo: string; conversacionId?: string }
  | { tipo: "error"; mensaje: string; recuperable?: boolean };
