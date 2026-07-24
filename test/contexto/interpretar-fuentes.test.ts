import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { interpretarFuentesContexto } from "../../src/modulos/contexto/aplicacion/InterpretarFuentesContexto";

test("acepta lista por comas y JSON", () => {
  expect(interpretarFuentesContexto("src,test,README.md")).toEqual(["src", "test", "README.md"]);
  expect(interpretarFuentesContexto('["a.ts","b.ts"]')).toEqual(["a.ts", "b.ts"]);
});

test("acepta un archivo manifiesto con una ruta por línea", () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-manifest-"));
  const ruta = join(dir, "archivos.txt");
  writeFileSync(ruta, "# comentario\nsrc\nREADME.md\n");
  expect(interpretarFuentesContexto(`@${ruta}`)).toEqual(["src", "README.md"]);
});
