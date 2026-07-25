import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RepositorioContextoSqlite } from "../../src/plataforma/persistencia/RepositorioContextoSqlite";
import { Database } from "bun:sqlite";

const crear = () => new RepositorioContextoSqlite(join(mkdtempSync(join(tmpdir(), "capi-durable-")), "capi.db"));

test("persiste ejecución durable y diario secuencial", () => {
  const repo = crear();
  repo.registrarProyecto({ id: "p", rutaRaiz: "/tmp/p", nombre: "p", tipoDeteccion: "ruta" });
  repo.crearEjecucionChat({ id: "e", proyectoLocalId: "p", proveedor: "qwen", estado: "creada", promptHash: "hash", propietarioId: "owner" }, 100);
  repo.actualizarEjecucionChat("e", { estado: "pensando", pensamientoParcial: "x", conversacionId: "c", estrategia: "dom" }, 200);
  repo.anexarEventoEjecucion("e", "pensamiento_actualizado", { caracteres: 1 }, 210);
  repo.anexarEventoEjecucion("e", "heartbeat", { ok: true }, 220);
  const ejecucion = repo.obtenerEjecucionChat("e");
  expect(ejecucion?.estado).toBe("pensando");
  expect(ejecucion?.pensamientoParcial).toBe("x");
  expect(ejecucion?.conversacionId).toBe("c");
  expect(repo.listarEventosEjecucion("e").map(e => e.secuencia)).toEqual([1, 2]);
  repo.cerrar();
});

test("cancelación y reanudación son persistentes", () => {
  const repo = crear();
  repo.registrarProyecto({ id: "p", rutaRaiz: "/tmp/p", nombre: "p", tipoDeteccion: "ruta" });
  repo.crearEjecucionChat({ id: "e", proyectoLocalId: "p", proveedor: "qwen", estado: "pensando", propietarioId: "owner", conversacionId: "c" });
  repo.solicitarCancelacionEjecucion("e", 300);
  expect(repo.obtenerEjecucionChat("e")?.cancelacionSolicitada).toBe(true);
  repo.marcarEjecucionReanudable("e", 400);
  expect(repo.obtenerEjecucionChat("e")?.estado).toBe("reconectando");
  expect(repo.obtenerEjecucionChat("e")?.cancelacionSolicitada).toBe(false);
  repo.cerrar();
});


test("abre una segunda conexión mientras existe un escritor WAL", () => {
  const ruta = join(mkdtempSync(join(tmpdir(), "capi-wal-")), "capi.db");
  const primera = new RepositorioContextoSqlite(ruta);
  const escritor = new Database(ruta);
  escritor.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;");
  expect(() => {
    const segunda = new RepositorioContextoSqlite(ruta);
    segunda.cerrar();
  }).not.toThrow();
  escritor.exec("ROLLBACK;");
  escritor.close();
  primera.cerrar();
});
