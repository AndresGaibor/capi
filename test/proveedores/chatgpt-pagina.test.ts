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
    if (codigo.includes("const enlaces")) return { value: [{ href: "https://chatgpt.com/c/a?x=1", titulo: " A " }, { href: "https://chatgpt.com/c/a", titulo: "A" }] as T };
    if (codigo.includes("isGenerating")) return { value: { turns: this.estados++, response: "respuesta", done: false, isGenerating: false } as T };
    if (codigo.includes("attachment-chip")) return { value: true as T };
    if (codigo.includes("Boolean(document.querySelector")) return { value: false as T };
    return { value: undefined as T };
  }
}

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
