import { describe, expect, test } from "bun:test";
import { QwenModelos } from "../../../src/proveedores/qwen/navegador/QwenModelos";
import { QwenEnvio } from "../../../src/proveedores/qwen/navegador/QwenEnvio";
class Fake { scripts:string[]=[]; async estaDisponible(){return true} async navegar(){} async evaluar<T>(codigo:string){this.scripts.push(codigo); if(codigo.includes("model-selector-text")) return {value:"Qwen3.7-Plus" as T}; if(codigo.includes("role=\"listbox")) return {value:["Qwen3.7-Plus"] as T}; return {value:{ok:true} as T};} }
describe("componentes Qwen",()=>{
 test("modelo actual",async()=>{const f=new Fake();expect((await new QwenModelos(f).seleccionar("plus")).nombre).toBe("Qwen3.7-Plus")});
 test("envío inserta prompt seguro",async()=>{const f=new Fake();await new QwenEnvio(f).enviar('hola "mundo"');expect(f.scripts.join(" ")).toContain(JSON.stringify('hola \"mundo\"'))});
});
