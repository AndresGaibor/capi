import { expect, test } from "bun:test";
import { seleccionarConversacion } from "../../src/modulos/conversaciones/aplicacion/SeleccionarConversacion";

const ahora = Date.parse("2026-07-24T22:00:00Z");

test("prioriza una conversación reciente de la ruta actual", () => {
  const resultado = seleccionarConversacion({
    ahora,
    umbralMs: 12 * 60 * 60 * 1000,
    proveedor: "qwen",
    proyectoLocalId: "p1",
    candidatas: [
      { id: "1", proveedor: "qwen", proyectoLocalId: "p2", usadaEn: ahora - 1000, ocupada: false, archivada: false },
      { id: "2", proveedor: "qwen", proyectoLocalId: "p1", usadaEn: ahora - 2000, ocupada: false, archivada: false },
    ],
  });
  expect(resultado).toEqual({ conversacionId: "2", motivo: "reciente_ruta" });
});

test("crea nueva si la mejor candidata está ocupada", () => {
  const resultado = seleccionarConversacion({
    ahora,
    umbralMs: 12 * 60 * 60 * 1000,
    proveedor: "qwen",
    proyectoLocalId: "p1",
    candidatas: [{ id: "1", proveedor: "qwen", proyectoLocalId: "p1", usadaEn: ahora - 1000, ocupada: true, archivada: false }],
  });
  expect(resultado.motivo).toBe("nueva_por_ocupacion");
});
