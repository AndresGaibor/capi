import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolverPresupuestoContexto } from "../../src/modulos/contexto/aplicacion/ResolverPresupuestoContexto";
import { seleccionarContextoAutomatico } from "../../src/modulos/contexto/aplicacion/SeleccionarContextoAutomatico";

test("resuelve presupuestos por proveedor y modelo y respeta override", () => {
  expect(resolverPresupuestoContexto("qwen", "plus").maxBytes).toBe(8 * 1024 * 1024);
  expect(resolverPresupuestoContexto("deepseek", "expert").maxBytes).toBe(8 * 1024 * 1024);
  expect(resolverPresupuestoContexto("qwen", "preview", 12345)).toMatchObject({ maxBytes: 12345, origen: "solicitado" });
});

test("selecciona cambios, imports relativos, pruebas y archivos base", () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-auto-"));
  Bun.spawnSync(["git", "init", dir]);
  Bun.spawnSync(["git", "-C", dir, "config", "user.email", "test@example.com"]);
  Bun.spawnSync(["git", "-C", dir, "config", "user.name", "Test"]);
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "util.ts"), "export const util=1\n");
  writeFileSync(join(dir, "src", "app.ts"), "import { util } from './util'; export { util }\n");
  writeFileSync(join(dir, "src", "app.test.ts"), "test('x',()=>{})\n");
  writeFileSync(join(dir, "README.md"), "# demo\n");
  writeFileSync(join(dir, "package.json"), "{}\n");
  Bun.spawnSync(["git", "-C", dir, "add", "."]); Bun.spawnSync(["git", "-C", dir, "commit", "-m", "base"]);
  writeFileSync(join(dir, "src", "app.ts"), "import { util } from './util'; export const app=util+1\n");
  const resultado = seleccionarContextoAutomatico(dir);
  expect(resultado.fuentes).toContain("src/app.ts");
  expect(resultado.fuentes).toContain("src/util.ts");
  expect(resultado.fuentes).toContain("src/app.test.ts");
  expect(resultado.fuentes).toContain("README.md");
});
