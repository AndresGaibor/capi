import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { scriptEnviarPromptDeepSeek } from "../../../src/proveedores/deepseek/scripts/enviarPrompt";
import { resolverModeloDeepSeek, listarModelosDeepSeek } from "../../../src/proveedores/deepseek/modelos/ResolverModeloDeepSeek";
import { convertirRegistroHistoria } from "../../../src/proveedores/deepseek/servicios/ConvertirRegistroHistoria";

describe("DeepSeek", () => {
  test("valida modelos", () => { expect(resolverModeloDeepSeek("VISION")).toBe("vision"); expect(listarModelosDeepSeek()).toHaveLength(3); expect(() => resolverModeloDeepSeek("otro")).toThrow("Modelo no disponible"); });
  test("convierte historial", () => { const c=convertirRegistroHistoria({id:"1",title:"T",messages:[{role:"user",content:"hola"},{role:"assistant",content:"ok"}]}); expect(c?.mensajes.map(m=>m.rol)).toEqual(["usuario","asistente"]); });
});

test("DeepSeek genera un script de envío con prompt escapado", async () => {
  const { scriptEnviarPromptDeepSeek } = await import("../../../src/proveedores/deepseek/scripts/enviarPrompt");
  const script = scriptEnviarPromptDeepSeek('hola "mundo"');
  expect(script).toContain(JSON.stringify('hola "mundo"'));
  expect(script).toContain("ds-button--primary.ds-button--filled.ds-button--circle");
});


test("DeepSeek elige el botón de envío visible más cercano al textarea", async () => {
  const { scriptEnviarPromptDeepSeek } = await import("../../../src/proveedores/deepseek/scripts/enviarPrompt");
  const script = scriptEnviarPromptDeepSeek("hola");
  expect(script).toContain("getBoundingClientRect");
  expect(script).toContain("estilo.display !== 'none'");
  expect(script).toContain("x: rect.left + rect.width / 2");
  expect(script).toContain("y: rect.top + rect.height / 2");
});


test("DeepSeek captura una copia del stream SSE", async () => {
  const { scriptEnviarPromptDeepSeek } = await import("../../../src/proveedores/deepseek/scripts/enviarPrompt");
  const script = scriptEnviarPromptDeepSeek("hola");
  expect(script).toContain("/api/v0/chat/completion");
  expect(script).toContain("body?.getReader()");
  expect(script).toContain("captura.raw.includes('[DONE]')");
});


test("DeepSeek chat nuevo no reutiliza una conversación abierta", async () => {
  const { DeepSeekNavegacion } = await import("../../../src/proveedores/deepseek/navegador/DeepSeekNavegacion");
  const navegaciones: string[] = [];
  const t: any = {
    estaDisponible: async () => true,
    evaluar: async (code: string) => ({ value: code.includes("window.location.href") ? "https://chat.deepseek.com/a/chat/s/antigua" : code.includes("location.host") ? "chat.deepseek.com" : true }),
    navegar: async (url: string) => { navegaciones.push(url); },
  };
  await new DeepSeekNavegacion(t, async () => {}).abrir();
  expect(navegaciones).toEqual(["https://chat.deepseek.com/"]);
});


test("DeepSeek consulta el historial autenticado como respaldo", async () => {
  const { DeepSeekStreaming } = await import("../../../src/proveedores/deepseek/navegador/DeepSeekStreaming");
  const scripts: string[] = [];
  let consultas = 0;
  const transporte: any = {
    evaluar: async (codigo: string) => {
      scripts.push(codigo);
      if (codigo.includes("location.pathname.match")) return { value: "conv-1" };
      if (codigo.includes("history_messages")) {
        consultas++;
        return { value: { contenido: "RESPUESTA_API", terminado: true } };
      }
      return { value: { think: "", response: "", done: false, isAssistant: false, isError: false, errorMessage: "" } };
    },
  };
  const eventos = [];
  for await (const evento of new DeepSeekStreaming(transporte, async () => {}).observar()) eventos.push(evento);
  expect(consultas).toBeGreaterThan(0);
  expect(eventos).toContainEqual({ tipo: "respuesta", contenido: "RESPUESTA_API", estrategia: "historial" });
  expect(eventos.at(-1)).toEqual({ tipo: "fin" });
  expect(scripts.some(x => x.includes("Authorization: 'Bearer ' + token"))).toBeTrue();
});


test("DeepSeek genera scripts sintácticamente válidos durante streaming", async () => {
  const { DeepSeekStreaming } = await import("../../../src/proveedores/deepseek/navegador/DeepSeekStreaming");
  const transporte: any = {
    evaluar: async (codigo: string) => {
      expect(() => new Function(`return (${codigo})`)).not.toThrow();
      if (codigo.includes("pathname.split")) return { value: "conv-1" };
      if (codigo.includes("history_messages")) return { value: { contenido: "OK", terminado: true } };
      return { value: { think: "", response: "", done: false, isAssistant: false, isError: false, errorMessage: "" } };
    },
  };
  const eventos = [];
  for await (const evento of new DeepSeekStreaming(transporte, async () => {}).observar()) eventos.push(evento);
  expect(eventos.at(-1)).toEqual({ tipo: "fin" });
});

test("DeepSeek prepara prompt en editor contenteditable",()=>{
  const dom=new JSDOM('<main><div role="textbox" contenteditable="true"></div><button aria-label="Send"></button></main>',{runScripts:"outside-only",url:"https://chat.deepseek.com/"});
  dom.window.fetch=(async()=>new Response('')) as any;
  Object.defineProperty(dom.window.HTMLElement.prototype,'getBoundingClientRect',{value(){return {width:20,height:20,left:0,top:0,right:20,bottom:20,x:0,y:0,toJSON(){}}}});
  const resultado=dom.window.eval(scriptEnviarPromptDeepSeek("hola")) as any;
  expect(resultado.ok).toBeTrue();
  expect(dom.window.document.querySelector('[contenteditable]')?.textContent).toBe("hola");
});
