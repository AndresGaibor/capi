import { describe, expect, test } from "bun:test";
import { ChatGPTPaginaChat } from "../../src/proveedores/chatgpt/navegador/ChatGPTPaginaChat";

describe("ChatGPTPaginaChat envío", () => {
  test("usa rellenar + click cuando rellenar está disponible", async () => {
    let texto = "";
    let clics = 0;
    let estadoLeido = 0;
    const transporte: any = {
      async cdp() { return {}; },
      async rellenar(_sel: string, val: string) { texto = val; },
      async click(_sel: string) { clics++; },
      async evaluar(code: string) {
        if (code.includes("isGenerating")) {
          estadoLeido++;
          if (estadoLeido === 1) return { value: { turns: 0, response: "", done: false, isGenerating: false } };
          return { value: { turns: 1, response: "hola", done: false, isGenerating: false } };
        }
        return { value: undefined };
      },
    };
    const pagina = new ChatGPTPaginaChat(transporte);
    await pagina.enviar("hola");
    expect(texto).toBe("hola");
    expect(clics).toBe(1);
  });

  test("usa script DOM como fallback cuando rellenar no existe", async () => {
    let estadoLeido = 0;
    let scriptEval = false;
    const transporte: any = {
      async cdp() { return {}; },
      async evaluar(code: string) {
        if (code.includes("isGenerating")) {
          estadoLeido++;
          if (estadoLeido === 1) return { value: { turns: 0, response: "", done: false, isGenerating: false } };
          return { value: { turns: 1, response: "hola", done: false, isGenerating: false } };
        }
        if (code.includes("ProseMirror") || code.includes("prompt-textarea") || code.includes("btn.click()") || code.includes("send-button")) {
          scriptEval = true;
          return { value: true };
        }
        return { value: true };
      },
    };
    const pagina = new ChatGPTPaginaChat(transporte);
    await pagina.enviar("hola");
    expect(scriptEval).toBeTrue();
  });
});
