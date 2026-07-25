import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { scriptPrepararEnvioQwen } from "../../../src/proveedores/qwen/scripts/enviarPrompt";
import { QwenModelos } from "../../../src/proveedores/qwen/navegador/QwenModelos";
import { QwenEnvio } from "../../../src/proveedores/qwen/navegador/QwenEnvio";
class Fake { scripts:string[]=[]; async estaDisponible(){return true} async navegar(){} async evaluar<T>(codigo:string){this.scripts.push(codigo); if(codigo==="location.pathname") return {value:"/" as T}; if(codigo.includes("conversacionNueva")) return {value:{vacio:true,conversacionNueva:false} as T}; if(codigo.includes("model-selector-text")) return {value:"Qwen3.7-Plus" as T}; if(codigo.includes("role=\"listbox")) return {value:["Qwen3.7-Plus"] as T}; return {value:{ok:true,x:100,y:100} as T};} async cdp<T>():Promise<T>{return {} as T;} }
describe("componentes Qwen",()=>{
 test("modelo actual",async()=>{const f=new Fake();expect((await new QwenModelos(f).seleccionar("plus")).nombre).toBe("Qwen3.7-Plus")});
 test("envío inserta prompt seguro",async()=>{const f=new Fake();await new QwenEnvio(f).enviar('hola "mundo"');expect(f.scripts.join(" ")).toContain(JSON.stringify('hola \"mundo\"'))});
});

test("Qwen prepara prompt en editor contenteditable",()=>{
  const dom=new JSDOM('<main><div role="textbox" contenteditable="true"></div><button aria-label="Enviar"></button></main>',{runScripts:"outside-only",url:"https://chat.qwen.ai/"});
  Object.defineProperty(dom.window.HTMLElement.prototype,'getBoundingClientRect',{value(){return {width:20,height:20,left:0,top:0,right:20,bottom:20,x:0,y:0,toJSON(){}}}});
  const resultado=dom.window.eval(scriptPrepararEnvioQwen("hola")) as any;
  expect(resultado.ok).toBeTrue();
  expect(dom.window.document.querySelector('[contenteditable]')?.textContent).toBe("hola");
});
