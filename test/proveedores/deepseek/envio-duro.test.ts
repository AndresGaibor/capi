import { describe, expect, test } from "bun:test";
import { DeepSeekEnvio } from "../../../src/proveedores/deepseek/navegador/DeepSeekEnvio";

function crearTransporte(opts: {
  cdpDisponible?: boolean;
  clicDomDevuelve?: boolean;
  confirmarTras?: number;
}) {
  let intentosConfirmar = 0;
  const t: any = {
    cdp: opts.cdpDisponible === false ? undefined : async (_m: string, _p: unknown) => ({}),
    async evaluar<T>(code: string): Promise<{ value: T }> {
      if (code === "location.pathname") return { value: "/a/chat/s/conv" as T };
      if (code.includes("__capiDeepSeekEnvio =") || (code.includes("__capiDeepSeekFetchOriginal") && code.includes("__capiDeepSeekCompletion"))) {
        return { value: { ok: true, x: 100, y: 100 } as T };
      }
      if (code.includes("compositor.querySelectorAll('div[role=\"button\"], button')")) {
        return { value: Boolean(opts.clicDomDevuelve ?? true) as T };
      }
      if (code.includes("elementFromPoint")) {
        return { value: true as T };
      }
      if (code.includes("window.__capiDeepSeekEnvio || {}") && code.includes("completionIniciada")) {
        intentosConfirmar++;
        if (opts.confirmarTras === undefined || intentosConfirmar >= opts.confirmarTras) {
          return { value: { mensajeAparecio: true, stopVisible: false, completionIniciada: false } as T };
        }
        return { value: { mensajeAparecio: false, stopVisible: false, completionIniciada: false } as T };
      }
      return { value: true as T };
    },
    _intentosConfirmar: () => intentosConfirmar,
  };
  return t;
}

describe("DeepSeekEnvio anti-duplicado", () => {
  test("ejecuta un solo clic CDP y NO hace clic DOM posterior", async () => {
    let mouseReleased = 0;
    const t = crearTransporte({ cdpDisponible: true });
    const cdpOriginal = t.cdp;
    t.cdp = async (m: string, p: unknown) => {
      if (m === "Input.dispatchMouseEvent" && (p as { type?: string })?.type === "mouseReleased") mouseReleased++;
      return cdpOriginal(m, p);
    };
    await new DeepSeekEnvio(t, async () => {}).enviar("hola");
    expect(mouseReleased).toBe(1);
  });

  test("ejecuta exactamente un clic DOM cuando no hay CDP", async () => {
    const t = crearTransporte({ cdpDisponible: false });
    await new DeepSeekEnvio(t, async () => {}).enviar("hola");
  });

  test("confirmarEnvio NO retorna antes de la huella del prompt", async () => {
    const t = crearTransporte({ cdpDisponible: false, confirmarTras: 3 });
    await new DeepSeekEnvio(t, async () => {}).enviar("hola");
    expect(t._intentosConfirmar()).toBeGreaterThanOrEqual(3);
  });

  test("lanza error si no se pudo ejecutar el clic DOM", async () => {
    const t = crearTransporte({ cdpDisponible: false, clicDomDevuelve: false });
    await expect(new DeepSeekEnvio(t, async () => {}).enviar("hola")).rejects.toThrow(/no se pudo ejecutar el clic/);
  });
});