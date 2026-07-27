import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { scriptEnviarPromptChatGPT } from "../../src/proveedores/chatgpt/scripts/enviarPrompt";
import { scriptEstadoStreamingChatGPT } from "../../src/proveedores/chatgpt/scripts/estadoStreaming";
import { scriptListarConversacionesChatGPT } from "../../src/proveedores/chatgpt/scripts/listarConversaciones";

test("ChatGPT usa el editor ProseMirror y el botón estable de envío", () => {
  const script = scriptEnviarPromptChatGPT("mensaje de prueba");
  expect(script).toContain(".ProseMirror");
  expect(script).toContain("send-button");
  expect(script).toContain("composer-submit-button-color");
  expect(script).toContain("mensaje de prueba");
});

test("ChatGPT extrae el último mensaje asistente y detecta generación", () => {
  const script = scriptEstadoStreamingChatGPT();
  expect(script).toContain("data-message-author-role");
  expect(script).toContain("isGenerating");
  expect(script).toContain("stop-button");
});

test("ChatGPT mantiene generación activa con el botón Stop visible", () => {
  const dom = new JSDOM('<main><button data-testid="stop-button"></button><div data-message-author-role="assistant"><div class="markdown">C</div></div></main>', { runScripts: "outside-only" });
  const estado = dom.window.eval(scriptEstadoStreamingChatGPT()) as any;
  expect(estado.response).toBe("C");
  expect(estado.isGenerating).toBeTrue();
  expect(estado.done).toBeFalse();
});

test("ChatGPT detecta banners de error", () => {
  const script = scriptEstadoStreamingChatGPT();
  expect(script).toContain('role="alert"');
  expect(script).toContain("error-banner");
});

test("ChatGPT detecta botón continue generating", () => {
  const script = scriptEstadoStreamingChatGPT();
  expect(script).toContain("continue-generating");
  expect(script).toContain("Continue generating");
});

test("ChatGPT filtra imágenes SVG y很小 imágenes", () => {
  const script = scriptEstadoStreamingChatGPT();
  expect(script).toContain("data:image/svg+xml");
  expect(script).toContain("width");
});

test("ChatGPT lista conversaciones deduplicadas con URLs canónicas", () => {
  const script = scriptListarConversacionesChatGPT();
  expect(script).toContain("/c/");
  expect(script).toContain("a.href");
  expect(script).toContain("Set");
});

test("ChatGPT escapar prompts especiales con JSON.stringify", () => {
  const promptsPeligrosos = [
    'Hola "mundo',
    "Hola \n mundo",
    "Hola ` mundo",
    "Hola ${expression} mundo",
  ];
  for (const prompt of promptsPeligrosos) {
    const script = scriptEnviarPromptChatGPT(prompt);
    expect(script).toContain(JSON.stringify(prompt));
  }
});
