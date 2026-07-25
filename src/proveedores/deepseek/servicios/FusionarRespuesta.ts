export type FuenteRespuestaDeepSeek = "sse" | "api" | "indexeddb" | "dom";

export function fusionarRespuesta(entrada: {
  contenidoActual: string;
  contenidoEntrante: string;
  fuente: FuenteRespuestaDeepSeek;
  terminado: boolean;
}): { contenido: string; fuente: FuenteRespuestaDeepSeek; confianza: "baja" | "media" | "alta"; terminado: boolean } {
  const actual = entrada.contenidoActual;
  const entrante = entrada.contenidoEntrante;
  let contenido = actual;
  if (entrante.startsWith(actual)) contenido = entrante;
  else if (!actual.startsWith(entrante)) {
    const limite = Math.min(actual.length, entrante.length);
    let solapamiento = 0;
    for (let longitud = limite; longitud > 0; longitud--) {
      if (actual.endsWith(entrante.slice(0, longitud))) { solapamiento = longitud; break; }
    }
    contenido = actual + entrante.slice(solapamiento);
  }
  return { contenido, fuente: entrada.fuente, confianza: entrada.terminado ? "alta" : entrada.fuente === "dom" ? "media" : "baja", terminado: entrada.terminado };
}
