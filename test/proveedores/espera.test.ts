import { describe, expect, test } from "bun:test";
import { esperarHasta, ErrorTiempoEsperaAgotado, ErrorOperacionCancelada } from "../../src/proveedores/chatgpt/navegador/espera";

describe("esperarHasta", () => {
  test("resuelve cuando completado retorna true", async () => {
    let intentos = 0;
    const resultado = await esperarHasta({
      operacion: "test",
      timeoutMs: 5000,
      intervaloMs: 10,
      verificar: async () => { intentos++; return { ok: intentos >= 3 }; },
      completado: (r) => r.ok,
    });
    expect(resultado.ok).toBeTrue();
    expect(intentos).toBeGreaterThanOrEqual(3);
  });

  test("lanza ErrorTiempoEsperaAgotado cuando se agota el timeout", async () => {
    await expect(
      esperarHasta({
        operacion: "test-timeout",
        timeoutMs: 100,
        intervaloMs: 20,
        verificar: async () => ({ ok: false }),
        completado: (r) => r.ok,
      }),
    ).rejects.toThrow(ErrorTiempoEsperaAgotado);
  });

  test("lanza ErrorOperacionCancelada cuando signal se aborta", async () => {
    const controlador = new AbortController();
    setTimeout(() => controlador.abort(), 50);
    await expect(
      esperarHasta({
        operacion: "test-cancel",
        timeoutMs: 10000,
        intervaloMs: 10,
        signal: controlador.signal,
        verificar: async () => ({ ok: false }),
        completado: (r) => r.ok,
      }),
    ).rejects.toThrow(ErrorOperacionCancelada);
  });

  test("alProgresar se invoca con datos de progreso", async () => {
    const progresos: Array<{ transcurridoMs: number; restanteMs: number }> = [];
    await esperarHasta({
      operacion: "test-progress",
      timeoutMs: 2000,
      intervaloMs: 10,
      intervaloFeedbackMs: 30,
      alProgresar: (p) => progresos.push({ transcurridoMs: p.transcurridoMs, restanteMs: p.restanteMs }),
      verificar: async () => ({ ok: false }),
      completado: () => false,
    }).catch(() => {});
    expect(progresos.length).toBeGreaterThan(0);
    const primero = progresos[0]!;
    expect(primero.transcurridoMs).toBeGreaterThanOrEqual(0);
    expect(primero.restanteMs).toBeGreaterThan(0);
  });

  test("lanza error si completado lanza", async () => {
    await expect(
      esperarHasta({
        operacion: "test-throw",
        timeoutMs: 5000,
        intervaloMs: 10,
        verificar: async () => ({ ok: false }),
        completado: () => { throw new Error("custom error"); },
      }),
    ).rejects.toThrow("custom error");
  });
});
