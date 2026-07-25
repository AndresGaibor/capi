import { expect, test } from "bun:test";
import { scriptEnviarPromptDeepSeek } from "../../../src/proveedores/deepseek/scripts/enviarPrompt";

test("el script de DeepSeek registra una huella de ejecución antes del click", () => {
  expect(scriptEnviarPromptDeepSeek("hola")).toContain("__capiDeepSeekEnvio");
});

test("DeepSeek comprueba todas las señales antes del fallback Enter", async () => {
  const { DeepSeekEnvio } = await import("../../../src/proveedores/deepseek/navegador/DeepSeekEnvio");
  const llamadas: string[] = [];
  let lecturas = 0;
  const transporte: any = { evaluar: async (codigo: string) => {
    llamadas.push(codigo);
    if (codigo === "location.pathname") return { value: "/a/chat/s/1" };
    if (codigo.includes("mensajeAparecio:")) return { value: { mensajeAparecio: true, entradaVacia: false, conversacionNueva: false, stopVisible: false, completionIniciada: false } };
    if (++lecturas === 1) return { value: { ok: true, x: 1, y: 1 } };
    return { value: undefined };
  } };
  await new DeepSeekEnvio(transporte, async () => {}).enviar("hola");
  expect(llamadas.some((codigo) => codigo.includes("KeyboardEvent"))).toBeFalse();
});
