import { expect, test } from "bun:test";
import { ejecutarProcesoConTimeout } from "../../scripts/lib/ejecutarProcesoConTimeout";

test("devuelve la salida de un proceso que termina dentro del límite", async () => {
  const resultado = await ejecutarProcesoConTimeout([
    "bun", "-e", "console.log('LISTO')",
  ], 2_000);

  expect(resultado.timeout).toBeFalse();
  expect(resultado.exitCode).toBe(0);
  expect(resultado.stdout).toContain("LISTO");
});

test("termina un proceso que excede el límite", async () => {
  const inicio = Date.now();
  const resultado = await ejecutarProcesoConTimeout([
    "bun", "-e", "await new Promise(r => setTimeout(r, 10_000))",
  ], 100);

  expect(resultado.timeout).toBeTrue();
  expect(Date.now() - inicio).toBeLessThan(3_000);
});
