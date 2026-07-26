import { expect, test } from "bun:test";
import { scriptEnviarPromptDeepSeek } from "../../../src/proveedores/deepseek/scripts/enviarPrompt";

test("el script de DeepSeek registra una huella de ejecución antes del click", () => {
  expect(scriptEnviarPromptDeepSeek("hola")).toContain("__capiDeepSeekEnvio");
});

test("DeepSeek confirma envio y NO usa fallback Enter si la huella aparece", async () => {
  const { DeepSeekEnvio } = await import("../../../src/proveedores/deepseek/navegador/DeepSeekEnvio");
  const llamadas: string[] = [];
  const transporte: any = { evaluar: async (codigo: string) => {
    llamadas.push(codigo);
    if (codigo === "location.pathname") return { value: "/a/chat/s/1" };
    if (codigo.includes("__capiDeepSeekEnvio =") || (codigo.includes("__capiDeepSeekFetchOriginal") && codigo.includes("__capiDeepSeekCompletion"))) {
      return { value: { ok: true, x: 1, y: 1 } };
    }
    if (codigo.includes("compositor.querySelectorAll('div[role=\"button\"], button')")) {
      return { value: true };
    }
    if (codigo.includes("window.__capiDeepSeekEnvio || {}") && codigo.includes("completionIniciada")) {
      return { value: { mensajeAparecio: true, stopVisible: false, completionIniciada: false } };
    }
    return { value: true };
  } };
  await new DeepSeekEnvio(transporte, async () => {}).enviar("hola");
  expect(llamadas.some((codigo) => codigo.includes("KeyboardEvent"))).toBeFalse();
});
