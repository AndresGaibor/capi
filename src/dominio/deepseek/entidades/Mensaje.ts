export interface Pensamiento {
  contenido: string;
}

export interface Fragmento {
  type: "REQUEST" | "RESPONSE" | "TEMPLATE_RESPONSE" | "THINK";
  content: string;
}

export interface Mensaje {
  id: string;
  rol: "usuario" | "asistente";
  fragmentos: Fragmento[];
  pensamiento?: Pensamiento;
  respuesta?: string;
  peticion?: string;
}

export interface RespuestaAsistente {
  contenido: string;
  pensamientos: Pensamiento[];
}
