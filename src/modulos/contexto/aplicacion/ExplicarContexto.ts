import type { ResultadoPaqueteContexto } from "./EmpaquetadorContexto";

export function explicarContexto(resultado: ResultadoPaqueteContexto) {
  return {
    paquete: resultado.ruta,
    hash: resultado.hash,
    bytes: resultado.bytes,
    tokensEstimados: resultado.tokensEstimados,
    desdeCache: resultado.desdeCache,
    incluidos: resultado.archivos.map(a => ({ ruta: a.ruta, bytes: a.bytes, hash: a.hash, motivo: a.motivo })),
    truncados: resultado.truncados.map(ruta => ({ ruta, motivo: "límite del paquete" })),
    omitidos: resultado.omitidos,
  };
}
