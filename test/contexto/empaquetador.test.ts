import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmpaquetadorContexto } from "../../src/modulos/contexto/aplicacion/EmpaquetadorContexto";

function entorno() {
  const raiz = mkdtempSync(join(tmpdir(), "capi-contexto-"));
  const cache = join(raiz, ".cache");
  return { raiz, cache, empaquetador: new EmpaquetadorContexto(cache) };
}

test("combina archivos y directorios en un único txt con índice", async () => {
  const { raiz, empaquetador } = entorno();
  mkdirSync(join(raiz, "src"));
  writeFileSync(join(raiz, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(raiz, "README.md"), "# Demo\n");
  const resultado = await empaquetador.empaquetar({ cwd: raiz, fuentes: ["src", "README.md"], maxBytes: 100_000 });
  const texto = readFileSync(resultado.ruta, "utf8");
  expect(resultado.archivosIncluidos).toBe(2);
  expect(texto).toContain("FILE: README.md");
  expect(texto).toContain("FILE: src/a.ts");
  expect(resultado.ruta.endsWith(".txt")).toBeTrue();
});

test("ignora secretos, binarios y carpetas pesadas", async () => {
  const { raiz, empaquetador } = entorno();
  mkdirSync(join(raiz, "node_modules"));
  writeFileSync(join(raiz, "node_modules", "x.js"), "no");
  writeFileSync(join(raiz, ".env"), "TOKEN=secreto");
  writeFileSync(join(raiz, "imagen.png"), Buffer.from([0, 1, 2, 3]));
  writeFileSync(join(raiz, "ok.ts"), "const ok = true;");
  const r = await empaquetador.empaquetar({ cwd: raiz, fuentes: ["."], maxBytes: 100_000 });
  const texto = readFileSync(r.ruta, "utf8");
  expect(texto).toContain("ok.ts");
  expect(texto).not.toContain("secreto");
  expect(r.omitidos.some(x => x.ruta.includes(".env"))).toBeTrue();
});

test("respeta el límite y reporta archivos truncados u omitidos", async () => {
  const { raiz, empaquetador } = entorno();
  writeFileSync(join(raiz, "grande.txt"), "x".repeat(20_000));
  writeFileSync(join(raiz, "pequeno.txt"), "hola");
  const r = await empaquetador.empaquetar({ cwd: raiz, fuentes: ["grande.txt", "pequeno.txt"], maxBytes: 4_000 });
  expect(r.bytes).toBeLessThanOrEqual(4_000);
  expect(r.omitidos.length + r.truncados.length).toBeGreaterThan(0);
});

test("reutiliza el mismo paquete cuando el contenido no cambia", async () => {
  const { raiz, empaquetador } = entorno();
  writeFileSync(join(raiz, "a.txt"), "igual");
  const a = await empaquetador.empaquetar({ cwd: raiz, fuentes: ["a.txt"], maxBytes: 10_000 });
  const b = await empaquetador.empaquetar({ cwd: raiz, fuentes: ["a.txt"], maxBytes: 10_000 });
  expect(a.ruta).toBe(b.ruta);
  expect(b.desdeCache).toBeTrue();
});
