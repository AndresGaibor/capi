import { describe, expect, test } from "bun:test";
import { QwenNavegacion } from "../../src/proveedores/qwen/navegador/QwenNavegacion";
import { DeepSeekNavegacion } from "../../src/proveedores/deepseek/navegador/DeepSeekNavegacion";
import { DeepSeekModelos } from "../../src/proveedores/deepseek/navegador/DeepSeekModelos";
import { DeepSeekEnvio } from "../../src/proveedores/deepseek/navegador/DeepSeekEnvio";
class T { calls:string[]=[]; i=0; constructor(private vals:any[]=[true]){} async estaDisponible(){return true} async navegar(url:string){this.calls.push(url)} async evaluar<T>(c:string){this.calls.push(c);return{value:this.vals[Math.min(this.i++,this.vals.length-1)] as T}} async cdp<T>(m:string){if(m==='DOM.getDocument')return{root:{nodeId:1}} as T;return{nodeId:2} as T} }
describe('navegación y servicios',()=>{
 test('Qwen navega y espera textarea',async()=>{const t=new T(['https://otro',true,'chat.qwen.ai']);await new QwenNavegacion(t,async()=>{}).abrirConversacion();expect(t.calls.some(x=>x.includes('chat.qwen.ai'))).toBeTrue()});
 test('DeepSeek navega y espera textarea',async()=>{const t=new T(['https://otro',true,'chat.deepseek.com']);await new DeepSeekNavegacion(t,async()=>{}).abrir();expect(t.calls.some(x=>x.includes('chat.deepseek.com'))).toBeTrue()});
 test('DeepSeek modelo actual',async()=>{const t=new T(['default']);expect(await new DeepSeekModelos(t).actual()).toBe('default')});
 test('DeepSeek configura y adjunta',async()=>{const t=new T([{ok:true}]);const e=new DeepSeekEnvio(t);await e.configurar({modelo:'default',deepThink:true},true);await e.adjuntar(['/tmp/x']);expect(t.calls.length).toBeGreaterThan(0)});
});

test("Qwen fuerza la raíz al crear un chat nuevo desde /c", async () => {
  const navegaciones: string[] = [];
  const transporte = {
    async estaDisponible(){ return true; },
    async navegar(url:string){ navegaciones.push(url); },
    async evaluar<T>(codigo:string){
      if (codigo.includes("window.location.href")) return { value: "https://chat.qwen.ai/c/anterior" as T };
      if (codigo.includes("location.host")) return { value: "chat.qwen.ai" as T };
      return { value: true as T };
    },
  };
  await new QwenNavegacion(transporte, async()=>{}).abrirConversacion();
  expect(navegaciones).toEqual(["https://chat.qwen.ai/"]);
});


test("Qwen espera el UUID real después de enviar un chat nuevo",async()=>{
  let lecturas=0;
  const transporte:any={evaluar:async(c:string)=>({value:c.includes("window.location.href")?(++lecturas<3?"https://chat.qwen.ai/":"https://chat.qwen.ai/c/uuid-real"):true}),estaDisponible:async()=>true,navegar:async()=>{}};
  const navegacion=new QwenNavegacion(transporte,async()=>{});
  expect(await navegacion.obtenerConversacionActual(5,0)).toBe("uuid-real");
});
