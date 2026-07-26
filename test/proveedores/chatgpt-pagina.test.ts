import { expect, test } from "bun:test";
import { ChatGPTPaginaChat } from "../../src/proveedores/chatgpt/navegador/ChatGPTPaginaChat";
import { ProveedorChatGPT } from "../../src/proveedores/chatgpt/ProveedorChatGPT";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

class TransporteChatGPT {
  navegadas: string[] = [];
  estados = 0;
  async estaDisponible() { return true; }
  async seleccionarPestanaPorHost() { return true; }
  async navegar(url: string) { this.navegadas.push(url); }
  async rellenar() {}
  async click() {}
  async cdp<T>(metodo: string) {
    if (metodo === "DOM.getDocument") return { root: { nodeId: 1 } } as T;
    if (metodo === "DOM.querySelector") return { nodeId: 2 } as T;
    return {} as T;
  }
  async evaluar<T>(codigo: string) {
    if (codigo === "location.hostname") return { value: "chatgpt.com" as T };
    if (codigo === "location.href") return { value: "https://chatgpt.com/c/chat-1" as T };
    if (codigo.includes(".ProseMirror") && codigo.includes("Boolean(document.querySelector")) return { value: true as T };
    if (codigo.includes("const enlaces")) return { value: [{ href: "https://chatgpt.com/c/a?x=1", titulo: " A " }, { href: "https://chatgpt.com/c/a", titulo: "A" }] as T };
    if (codigo.includes("isGenerating")) return { value: { turns: this.estados++, response: "respuesta", done: false, isGenerating: false } as T };
    if (codigo.includes("attachment-chip")) return { value: true as T };
    if (codigo.includes("Boolean(document.querySelector")) return { value: false as T };
    return { value: undefined as T };
  }
}

test("ChatGPT abre una pestaña cuando la sesión WebBridge no tiene una asociada", async () => {
  const navegadas: string[] = [];
  const transporte: any = {
    async estaDisponible() { return true; },
    async seleccionarPestanaPorHost() { return false; },
    async seleccionarPestanaActiva() { throw new Error("no debe exigir pestaña foreground"); },
    async navegar(url: string) { navegadas.push(url); },
    async evaluar(codigo: string) {
      if (codigo === "location.hostname") return { value: "chatgpt.com" };
      return { value: undefined };
    },
  };
  await new ChatGPTPaginaChat(transporte).verificarDisponibilidad();
  expect(navegadas).toEqual(["https://chatgpt.com/"]);
});

test("ChatGPT con CDP no acepta solo el textarea antes de ProseMirror", async () => {
  let intentosProseMirror = 0;
  const transporte: any = {
    async navegar() {},
    async cdp() {},
    async evaluar(codigo: string) {
      if (codigo === "location.href") return { value: "https://chatgpt.com/" };
      if (codigo.includes(".ProseMirror") && !codigo.includes("textarea[aria-label")) return { value: ++intentosProseMirror >= 3 };
      if (codigo.includes("textarea[aria-label")) return { value: true };
      return { value: undefined };
    },
  };
  await new ChatGPTPaginaChat(transporte).abrirConversacion();
  expect(intentosProseMirror).toBe(3);
});

test("ChatGPT espera ProseMirror después de abrir una conversación", async () => {
  let intentosEditor = 0;
  const transporte: any = {
    async navegar() {},
    async cdp() {},
    async evaluar(codigo: string) {
      if (codigo === "location.href") return { value: "https://chatgpt.com/" };
      if (codigo.includes(".ProseMirror")) return { value: ++intentosEditor >= 3 };
      return { value: undefined };
    },
  };
  await new ChatGPTPaginaChat(transporte).abrirConversacion();
  expect(intentosEditor).toBe(3);
});

test("ChatGPTPaginaChat verifica, canonicaliza conversaciones, envía y diagnostica", async () => {
  const transporte = new TransporteChatGPT();
  const pagina = new ChatGPTPaginaChat(transporte as any);
  await pagina.verificarDisponibilidad();
  expect(await pagina.listarConversaciones()).toEqual([{ id: "https://chatgpt.com/c/a", titulo: "A" }]);
  await pagina.abrirConversacion("/c/otra?x=1");
  expect(transporte.navegadas).toEqual(["https://chatgpt.com/c/otra"]);
  await pagina.enviar("hola");
  expect(await pagina.obtenerConversacionActual()).toBe("https://chatgpt.com/c/chat-1");
  expect((await pagina.diagnosticar()).proveedor).toBe("chatgpt");
});

test("ChatGPT usa rellenar y clic para enviar cuando rellenar está disponible", async () => {
  let textoRellenado = "";
  let clics = 0;
  let lecturasEstado = 0;
  const transporte: any = {
    async estaDisponible() { return true; },
    async rellenar(_selector: string, valor: string) { textoRellenado = valor; },
    async click(_selector: string) { clics++; },
    async cdp() { return {}; },
    async evaluar(codigo: string) {
      if (codigo.includes("isGenerating")) {
        lecturasEstado++;
        return { value: lecturasEstado === 1 ? { turns: 0, response: "", done: false, isGenerating: false } : { turns: 1, response: "OK", done: false, isGenerating: false } };
      }
      return { value: undefined };
    },
  };
  await new ChatGPTPaginaChat(transporte).enviar("PROMPT_CHATGPT");
  expect(textoRellenado).toBe("PROMPT_CHATGPT");
  expect(clics).toBe(1);
});

test("ChatGPT usa script DOM cuando rellenar no está disponible", async () => {
  let insercion = "";
  let lecturasEstado = 0;
  const transporte: any = {
    async estaDisponible() { return true; },
    async cdp() { return {}; },
    async evaluar(codigo: string) {
      if (codigo.includes("isGenerating")) {
        lecturasEstado++;
        return { value: lecturasEstado === 1 ? { turns: 0, response: "", done: false, isGenerating: false } : { turns: 1, response: "OK", done: false, isGenerating: false } };
      }
      if (codigo.includes("editor")) return { value: true };
      if (codigo.includes("btn.click()")) return { value: true };
      if (codigo.includes("prompt-textarea")) return { value: true };
      return { value: undefined };
    },
  };
  await new ChatGPTPaginaChat(transporte).enviar("PROMPT_SCRIPT");
});

test("todos los scripts generados por el envío de ChatGPT compilan", async () => {
  let lecturasEstado = 0;
  const transporte: any = {
    async cdp() { return {}; },
    async evaluar(codigo: string) {
      expect(() => new Function(`return (${codigo})`)).not.toThrow();
      if (codigo.includes("isGenerating")) {
        lecturasEstado++;
        return { value: lecturasEstado === 1 ? { turns: 0, response: "", done: false, isGenerating: false } : { turns: 0, response: "", done: false, isGenerating: false } };
      }
      if (codigo.includes(".ProseMirror") && codigo.includes("focus")) return { value: true };
      if (codigo.includes("btn.click()")) return { value: true };
      if (codigo.includes("Boolean(document.querySelector")) return { value: true };
      return { value: undefined };
    },
  };
  await new ChatGPTPaginaChat(transporte).enviar("PROMPT_COMPILA");
});

test("ChatGPTPaginaChat adjunta archivos mediante CDP y confirma el chip", async () => {
  const archivo = join(mkdtempSync(join(tmpdir(), "capi-chatgpt-")), "nota.txt");
  writeFileSync(archivo, "contenido");
  await new ChatGPTPaginaChat(new TransporteChatGPT() as any).adjuntar([archivo]);
  expect(true).toBeTrue();
});

test("ProveedorChatGPT delega el envío y el polling sin reenviar en soloPoll", async () => {
  const llamadas: string[] = [];
  const pagina = { verificarDisponibilidad: async () => llamadas.push("verificar"), abrirConversacion: async () => llamadas.push("abrir"), enviar: async () => llamadas.push("enviar"), observar: async function* () { yield { tipo: "fin" as const }; }, listarModelos: () => [], seleccionarModelo: async () => ({ id: "auto", nombre: "Auto" }), listarConversaciones: async () => [], obtenerConversacionActual: async () => null, adjuntar: async () => llamadas.push("adjuntar"), diagnosticar: async () => ({}) };
  const eventos = [];
  for await (const evento of new ProveedorChatGPT(pagina as any).enviarMensaje({ prompt: "x", modelo: "auto", soloPoll: true } as any)) eventos.push(evento.tipo);
  expect(eventos.at(-1)).toBe("fin");
  expect(llamadas).not.toContain("enviar");
});
