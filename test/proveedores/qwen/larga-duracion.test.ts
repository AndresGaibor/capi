import { expect, test } from "bun:test";
import { QwenStreaming } from "../../../src/proveedores/qwen/navegador/QwenStreaming";
import { ProveedorQwen } from "../../../src/proveedores/qwen/ProveedorQwen";

async function recoger(gen: AsyncGenerator<any>, max = 20) {
  const eventos: any[] = [];
  for await (const evento of gen) {
    eventos.push(evento);
    if (eventos.length >= max) break;
  }
  return eventos;
}

test("Qwen no pausa aunque el pensamiento completado dure más de una hora", async () => {
  let lectura = 0;
  let reloj = 0;
  const transporte = {
    async evaluar<T>() {
      lectura++;
      const respuesta = lectura >= 5 ? "RESPUESTA_TARDIA" : "";
      return { value: { think: "Pensamiento completado", response: respuesta, done: !!respuesta, isGenerating: false, isAssistant: true, isError: false, errorMessage: "" } as T };
    },
  };
  const eventos = await recoger(new QwenStreaming(transporte as any, async () => {}, () => (reloj += 30 * 60_000)).observar());
  expect(eventos.some((e) => e.tipo === "pausado")).toBeFalse();
  expect(eventos.find((e) => e.tipo === "respuesta")?.contenido).toBe("RESPUESTA_TARDIA");
  expect(eventos.at(-1)?.tipo).toBe("fin");
});

test("Qwen rescata respuesta tardía desde snapshot accesible", async () => {
  let reloj = 0;
  const transporte = {
    async evaluar<T>() { return { value: { think: "Pensamiento completado", response: "", done: false, isGenerating: false, isAssistant: true, isError: false, errorMessage: "" } as T }; },
    async snapshotAccesibilidad() { return { url: "https://chat.qwen.ai/c/id", title: "Qwen", tree: [{ role: "main", children: [{ role: "StaticText", name: "Pensamiento completado" }, { role: "StaticText", name: "RESPUESTA_DESDE_SNAPSHOT" }, { role: "button", name: "Copiar" }] }] }; },
  };
  const eventos = await recoger(new QwenStreaming(transporte as any, async () => {}, () => (reloj += 31_000)).observar());
  expect(eventos.find((e) => e.tipo === "respuesta")?.contenido).toBe("RESPUESTA_DESDE_SNAPSHOT");
  expect(eventos.at(-1)?.tipo).toBe("fin");
});

test("Qwen reintenta errores transitorios de evaluación", async () => {
  let intentos = 0;
  const transporte = { async evaluar<T>() { if (++intentos < 3) throw new Error("WebBridge temporal"); return { value: { think: "", response: "OK", done: true, isGenerating: false, isAssistant: true, isError: false, errorMessage: "" } as T }; } };
  const eventos = await recoger(new QwenStreaming(transporte as any, async () => {}, (() => { let t=0; return () => t+=1000; })()).observar());
  expect(intentos).toBeGreaterThanOrEqual(3);
  expect(eventos.map((e) => e.tipo)).toEqual(["respuesta", "fin"]);
});

test("ProveedorQwen emite conversación apenas aparece tras enviar", async () => {
  const pagina = {
    verificarDisponibilidad: async () => {}, abrirConversacion: async () => {}, seleccionarModelo: async () => ({ nombre: "modelo" }),
    adjuntar: async () => {}, enviarPrompt: async () => {}, obtenerConversacionActual: async () => "chat-tardio",
    observarStreaming: async function* () { yield { tipo: "respuesta", contenido: "OK" }; yield { tipo: "fin" }; },
  };
  const eventos = await recoger(new ProveedorQwen(pagina as any).enviarMensaje({ prompt: "hola" }));
  expect(eventos.find((e) => e.tipo === "conversacion")?.id).toBe("chat-tardio");
});
