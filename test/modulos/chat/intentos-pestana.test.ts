import { describe, expect, test } from "bun:test";
import { EjecutarIntentosChat } from "../../../src/modulos/chat/aplicacion/EjecutarIntentosChat";
import { esErrorTransitorioProveedor } from "../../../src/modulos/chat/aplicacion/PoliticaRecuperacionProveedor";

class ErrorTransitorio extends Error {
  constructor() { super("Alta demanda"); }
}

class ErrorNoTransitorio extends Error {
  constructor() { super("Error fatal"); }
}

function crearProveedor(errores: Error[]) {
  const llamadas: Array<{ prompt: string; nuevaPestana?: boolean }> = [];
  let indiceLlamada = 0;
  const proveedor: any = {
    id: "x",
    async *enviarMensaje(peticion: any) {
      llamadas.push({ prompt: peticion.prompt, nuevaPestana: peticion.nuevaPestana });
      const error = errores[indiceLlamada++];
      if (error) throw error;
      yield { tipo: "respuesta", contenido: "OK" };
      yield { tipo: "fin" };
    },
  };
  return { proveedor, llamadas };
}

describe("EjecutarIntentosChat control de pestañas", () => {
  test("reintento por error transitorio NO fuerza nuevaPestana", async () => {
    const { proveedor, llamadas } = crearProveedor([
      new ErrorTransitorio(),
      new ErrorTransitorio(),
      new ErrorTransitorio(),
    ]);
    const ej = new EjecutarIntentosChat();
    await expect((async () => {
      for await (const _ of ej.ejecutar(proveedor, { prompt: "hola" } as any, [
        { proveedor: "x", modelo: "a" },
        { proveedor: "x", modelo: "b" },
        { proveedor: "x", modelo: "c" },
      ], undefined, 0)) { /* noop */ }
    })()).rejects.toThrow(/Alta demanda/);
    expect(llamadas[0]?.nuevaPestana).toBeFalsy();
    expect(llamadas[1]?.nuevaPestana).toBe(false);
    expect(llamadas[2]?.nuevaPestana).toBe(false);
  });

  test("primer intento con nuevaPestana=true del usuario SÍ propaga el flag", async () => {
    const { proveedor, llamadas } = crearProveedor([]);
    const ej = new EjecutarIntentosChat();
    for await (const _ of ej.ejecutar(proveedor, { prompt: "hola", nuevaPestana: true } as any, [
      { proveedor: "x", modelo: "a" },
    ], undefined, 0)) { /* noop */ }
    expect(llamadas[0]?.nuevaPestana).toBe(true);
  });

  test("primer intento sin nuevaPestana NO propaga false positivo", async () => {
    const { proveedor, llamadas } = crearProveedor([]);
    const ej = new EjecutarIntentosChat();
    for await (const _ of ej.ejecutar(proveedor, { prompt: "hola" } as any, [
      { proveedor: "x", modelo: "a" },
    ], undefined, 0)) { /* noop */ }
    expect(llamadas[0]?.nuevaPestana).toBeFalsy();
  });

  test("error fatal (no transitorio) NO reintenta", async () => {
    const { proveedor, llamadas } = crearProveedor([new ErrorNoTransitorio()]);
    const ej = new EjecutarIntentosChat();
    await expect((async () => {
      for await (const _ of ej.ejecutar(proveedor, { prompt: "hola" } as any, [
        { proveedor: "x", modelo: "a" },
        { proveedor: "x", modelo: "b" },
      ], undefined, 0)) { /* noop */ }
    })()).rejects.toThrow(/Error fatal/);
    expect(llamadas.length).toBe(1);
  });
});

describe("esErrorTransitorioProveedor", () => {
  test("detecta 'alta demanda' y 'server is busy'", () => {
    expect(esErrorTransitorioProveedor(new Error("Alta demanda"))).toBe(true);
    expect(esErrorTransitorioProveedor(new Error("server is busy"))).toBe(true);
    expect(esErrorTransitorioProveedor(new Error("Error fatal"))).toBe(false);
  });
});