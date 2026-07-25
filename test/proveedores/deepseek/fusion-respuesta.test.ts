import { expect, test } from "bun:test";
import { fusionarRespuesta } from "../../../src/proveedores/deepseek/servicios/FusionarRespuesta";

test.each([
  ["incremental", "hola", "hola mundo", "hola mundo"],
  ["acumulativa", "hola mundo", "hola", "hola mundo"],
  ["solapada", "hola mun", "mundo", "hola mundo"],
  ["utf8", "¿Cómo est", "estás?", "¿Cómo estás?"],
] as const)("fusiona fuente %s sin duplicar", (_caso, actual, entrante, esperado) => {
  expect(fusionarRespuesta({ contenidoActual: actual, contenidoEntrante: entrante, fuente: "dom", terminado: false }).contenido).toBe(esperado);
});

test("prioriza una fuente terminada sin reemplazar contenido más largo", () => {
  const fusion = fusionarRespuesta({ contenidoActual: "respuesta completa", contenidoEntrante: "respuesta", fuente: "api", terminado: true });
  expect(fusion).toMatchObject({ contenido: "respuesta completa", fuente: "api", confianza: "alta", terminado: true });
});
