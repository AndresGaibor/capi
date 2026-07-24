const PATRON_COMMENTARY = /We need to parse the user's input\..*?I'll respond in Spanish with a warm greeting and offer assistance\./gs;

export function normalizarRespuesta(respuesta: string): string {
  if (!respuesta) return "";
  return respuesta
    .replace(PATRON_COMMENTARY, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncarTexto(texto: string, maximo: number): {
  texto: string;
  truncado: boolean;
} {
  if (!texto) return { texto: "", truncado: false };
  if (texto.length <= maximo) return { texto, truncado: false };
  return { texto: texto.slice(0, maximo) + "...", truncado: true };
}

