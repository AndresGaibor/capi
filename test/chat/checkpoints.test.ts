import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RepositorioContextoSqlite } from "../../src/plataforma/persistencia/RepositorioContextoSqlite";

test("persiste checkpoint pausado por proyecto, proveedor y conversación", () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-checkpoint-"));
  const r = new RepositorioContextoSqlite(join(dir, "contexto.sqlite"));
  r.guardarCheckpoint({ proyectoLocalId: "p", proveedor: "deepseek", conversacionId: "c", motivo: "red", pensamiento: "pienso", respuesta: "respuesta", estado: "pausado" }, 123);
  expect(r.obtenerCheckpoint("p", "deepseek", "c")).toEqual({ proyectoLocalId: "p", proveedor: "deepseek", conversacionId: "c", motivo: "red", pensamiento: "pienso", respuesta: "respuesta", estado: "pausado", actualizadoEn: 123 });
  r.cerrar(); rmSync(dir, { recursive: true, force: true });
});
