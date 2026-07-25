import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RepositorioContextoSqlite } from "../../src/plataforma/persistencia/RepositorioContextoSqlite";

test("persiste snapshots, historial y resumen por conversación", () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-hist-"));
  const repo = new RepositorioContextoSqlite(join(dir, "ctx.sqlite"));
  repo.registrarProyecto({ id: "p", rutaRaiz: dir, nombre: "p", tipoDeteccion: "ruta" });
  repo.guardarSnapshotContexto("p", "qwen", "c1", [{ ruta: "a.ts", hash: "h1" }], 1);
  expect(repo.obtenerHashesContexto("p", "qwen", "c1")).toEqual({ "a.ts": "h1" });
  repo.iniciarEjecucionHistorial({ id: "e1", proyectoLocalId: "p", proveedor: "qwen", modelo: "max", conversacionId: "c1", rama: "main", commitGit: "abc", archivos: ["a.ts"] }, 2);
  repo.finalizarEjecucionHistorial("e1", { estado: "completada", respuestaCaracteres: 42 }, 3);
  expect(repo.listarHistorialProyecto("p", 10)[0]).toMatchObject({ id: "e1", estado: "completada", rama: "main", respuestaCaracteres: 42, archivos: ["a.ts"] });
  repo.guardarResumenConversacion("p", "qwen", "c1", "resumen", 4);
  expect(repo.obtenerResumenConversacion("p", "qwen", "c1")).toBe("resumen");
  expect(repo.diagnosticar().esquema).toBe(12);
  repo.cerrar();
});
