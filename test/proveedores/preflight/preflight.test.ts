import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { inspeccionarPreflightPagina, sanitizarFixtureDom } from "../../../src/proveedores/preflight/PreflightPagina";
import { scriptDiagnosticarPagina } from "../../../src/proveedores/preflight/scriptDiagnosticarPagina";

test("preflight detecta sesión expirada sin exponer texto privado", () => {
  const dom = new JSDOM('<main><div role="textbox" contenteditable>prompt privado</div><button>Iniciar sesión</button></main>', { url: "https://chat.qwen.ai/c/abc" });
  expect(inspeccionarPreflightPagina(dom.window.document, dom.window.location, "qwen")).toMatchObject({ ok: false, codigo: "SESION_EXPIRADA" });
});

test("preflight detecta captcha, modal y conversación inválida por prioridad", () => {
  const dom = new JSDOM('<div class="captcha">captcha</div><div role="dialog">bloqueante</div><main>Conversation not found</main>', { url: "https://chat.deepseek.com/a/chat/s/x" });
  expect(inspeccionarPreflightPagina(dom.window.document, dom.window.location, "deepseek")).toMatchObject({ ok: false, codigo: "CAPTCHA_REQUERIDO" });
});

test("sanitiza fixture preservando estructura accesible sin contenido ni atributos sensibles", () => {
  const dom = new JSDOM('<main class="chat root"><input aria-label="Prompt" value="secreto" data-token="token"/><button class="send button" aria-label="Enviar">contenido privado</button></main>');
  const fixture = sanitizarFixtureDom(dom.window.document);
  expect(fixture).toContain('<main class="chat root">');
  expect(fixture).toContain('aria-label="Prompt"');
  expect(fixture).not.toContain("secreto");
  expect(fixture).not.toContain("contenido privado");
  expect(fixture).not.toContain("token");
});

test("diagnóstico DOM devuelve sólo señales seguras y código accionable", () => {
  const dom = new JSDOM('<main><div role="textbox" contenteditable>prompt privado</div></main>', { runScripts: "outside-only", url: "https://chat.qwen.ai/c/secreto" });
  const resultado = dom.window.eval(scriptDiagnosticarPagina("qwen")) as Record<string, unknown>;
  expect(resultado).toMatchObject({ proveedor: "qwen", ok: true, estrategia: "dom", url: "https://chat.qwen.ai/c/secreto" });
  expect(JSON.stringify(resultado)).not.toContain("prompt privado");
});
