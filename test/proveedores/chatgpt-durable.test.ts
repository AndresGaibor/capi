import { expect, test } from "bun:test";
import { ProveedorChatGPT } from "../../src/proveedores/chatgpt/ProveedorChatGPT";
import { ChatGPTPaginaChat } from "../../src/proveedores/chatgpt/navegador/ChatGPTPaginaChat";

test("ProveedorChatGPT emite la conversación nueva y la entrega al streaming", async () => {
  let conocida: string | undefined;
  const pagina = {
    verificarDisponibilidad: async () => {},
    abrirConversacion: async () => {},
    enviar: async () => {},
    adjuntar: async () => {},
    obtenerConversacionActual: async () => "https://chatgpt.com/c/chat-nuevo",
    observar: async function* (conversacion?: string) {
      conocida = conversacion;
      yield { tipo: "respuesta", contenido: "OK" } as const;
      yield { tipo: "fin" } as const;
    },
  };
  const eventos = [];
  for await (const evento of new ProveedorChatGPT(pagina as any).enviarMensaje({ prompt: "hola" })) eventos.push(evento);
  expect(eventos).toContainEqual({ tipo: "conversacion", id: "https://chatgpt.com/c/chat-nuevo" });
  expect(conocida).toBe("https://chatgpt.com/c/chat-nuevo");
});

test("ProveedorChatGPT espera el UUID definitivo después de enviar", async () => {
  let intentosSolicitados = 0;
  const pagina = {
    verificarDisponibilidad: async () => {},
    abrirConversacion: async () => {},
    enviar: async () => {},
    adjuntar: async () => {},
    obtenerConversacionActual: async (intentos = 1) => { intentosSolicitados = intentos; return intentos > 1 ? "https://chatgpt.com/c/uuid-final" : null; },
    observar: async function* () { yield { tipo: "fin" } as const; },
  };
  const eventos = [];
  for await (const evento of new ProveedorChatGPT(pagina as any).enviarMensaje({ prompt: "hola" })) eventos.push(evento);
  expect(intentosSolicitados).toBeGreaterThan(1);
  expect(eventos).toContainEqual({ tipo: "conversacion", id: "https://chatgpt.com/c/uuid-final" });
});

test("ChatGPT recupera una pestaña cerrada usando la conversación conocida", async () => {
  const recuperaciones: Array<string | undefined> = [];
  let lecturas = 0;
  const transporte = {
    async evaluar() {
      lecturas++;
      if (lecturas <= 3) throw new Error("tab was closed");
      return { value: { response: "OK", images: [], turns: 1, isGenerating: false, done: true } };
    },
    async recuperarPestana(_host: string, url?: string) { recuperaciones.push(url); return true; },
  };
  const pagina = new ChatGPTPaginaChat(transporte as any);
  const generador = pagina.observar("https://chatgpt.com/c/chat-recuperable");
  const primero = await generador.next();
  expect(primero.value).toMatchObject({ tipo: "estado", estado: "desconectado" });
  const continuacion = generador.next();
  await Bun.sleep(20);
  expect(recuperaciones[0]).toBe("https://chatgpt.com/c/chat-recuperable");
  await generador.return(undefined);
  await continuacion;
}, 10_000);

test("ChatGPT espera que la URL temporal WEB cambie al UUID definitivo", async () => {
  const urls = [
    "https://chatgpt.com/c/WEB:temporal",
    "https://chatgpt.com/c/WEB:temporal",
    "https://chatgpt.com/c/uuid-definitivo",
  ];
  const transporte = {
    async evaluar(codigo: string) {
      expect(codigo).toBe("location.href");
      return { value: urls.shift() ?? "https://chatgpt.com/c/uuid-definitivo" };
    },
  };
  const pagina = new ChatGPTPaginaChat(transporte as any);
  expect(await pagina.obtenerConversacionActual(3, 0)).toBe("https://chatgpt.com/c/uuid-definitivo");
});
