import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmpaquetadorContexto } from "../../src/modulos/contexto/aplicacion/EmpaquetadorContexto";
import { explicarContexto } from "../../src/modulos/contexto/aplicacion/ExplicarContexto";
import { filtrarContextoIncremental } from "../../src/modulos/contexto/aplicacion/FiltrarContextoIncremental";

test("explica hashes, motivos y omisiones del paquete", async () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-explica-"));
  writeFileSync(join(dir, "a.ts"), "export const a=1");
  writeFileSync(join(dir, ".env"), "TOKEN=secreto");
  const paquete = await new EmpaquetadorContexto(join(dir, "cache")).empaquetar({ cwd: dir, fuentes: ["a.ts", ".env"], motivos: { "a.ts": ["archivo modificado"] } });
  const explicacion = explicarContexto(paquete);
  expect(explicacion.incluidos[0]).toMatchObject({ ruta: "a.ts", motivo: "archivo modificado" });
  expect(explicacion.incluidos[0]?.hash.length).toBe(64);
  expect(explicacion.omitidos.some(o => o.ruta === ".env")).toBeTrue();
});

test("omite archivos sin cambios según snapshot", () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-inc-"));
  writeFileSync(join(dir, "a.ts"), "uno"); writeFileSync(join(dir, "b.ts"), "dos");
  const primero = filtrarContextoIncremental(dir, ["a.ts", "b.ts"], {});
  const segundo = filtrarContextoIncremental(dir, ["a.ts", "b.ts"], primero.hashes);
  expect(segundo.fuentes).toEqual([]);
  expect(segundo.sinCambios).toEqual(["a.ts", "b.ts"]);
});
