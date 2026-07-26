import { describe, expect, test } from "bun:test";
import { ChatGPTPaginaChat } from "../../src/proveedores/chatgpt/navegador/ChatGPTPaginaChat";

describe("ChatGPTPaginaChat bucle de clic", () => {
  test("acota el bucle de clic en ProseMirror a 5 intentos", async () => {
    let intentosClic = 0;
    const transporte: any = {
      async cdp() { return {}; },
      async evaluar(code: string) {
        if (code.includes("isGenerating")) return { value: { turns: 0, response: "OK", done: false, isGenerating: false } };
        if (code.includes("ProseMirror") && code.includes("focus")) return { value: true };
        if (code.includes("btn.click()")) {
          intentosClic++;
          return { value: true };
        }
        return { value: true };
      },
    };
    const pagina = new ChatGPTPaginaChat(transporte);
    await pagina.enviar("hola");
    expect(intentosClic).toBeLessThanOrEqual(5);
    expect(intentosClic).toBeGreaterThanOrEqual(1);
  });

  test("lanza error si el botón nunca se habilita", async () => {
    const transporte: any = {
      async cdp() { return {}; },
      async evaluar(code: string) {
        if (code.includes("isGenerating")) return { value: { turns: 0, response: "OK", done: false, isGenerating: false } };
        if (code.includes("ProseMirror") && code.includes("focus")) return { value: true };
        if (code.includes("btn.click()")) return { value: false };
        return { value: true };
      },
    };
    const pagina = new ChatGPTPaginaChat(transporte);
    await expect(pagina.enviar("hola")).rejects.toThrow(/No apareció el botón de envío de ChatGPT/);
  });
});