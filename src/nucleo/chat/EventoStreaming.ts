export type EventoStreaming =
  | { tipo: "inicio"; mensaje?: string }
  | { tipo: "pensamiento"; contenido: string }
  | { tipo: "respuesta"; contenido: string }
  | { tipo: "conversacion"; id: string }
  | { tipo: "modelo"; nombre: string }
  | { tipo: "fin" };
