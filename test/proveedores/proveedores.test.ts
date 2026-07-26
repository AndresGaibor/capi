import { describe, expect, test } from "bun:test";
import { ProveedorQwen } from "../../src/proveedores/qwen/ProveedorQwen";
import { ProveedorDeepSeek } from "../../src/proveedores/deepseek/ProveedorDeepSeek";
async function recoger(g:AsyncGenerator<any>){const r=[];for await(const x of g)r.push(x);return r}
describe("proveedores",()=>{
 test("Qwen orquesta página",async()=>{const p:any={verificarDisponibilidad:async()=>{},abrirConversacion:async()=>{},seleccionarModelo:async()=>({id:"x",nombre:"x"}),enviarPrompt:async()=>{},async *observarStreaming(){yield{tipo:"respuesta",contenido:"OK"};yield{tipo:"fin"}}};const ev=await recoger(new ProveedorQwen(p).enviarMensaje({prompt:"hola",modelo:"x"}));expect(ev.some(x=>x.tipo==="modelo")).toBeTrue();expect(ev.at(-1).tipo).toBe("fin")});
 test("DeepSeek orquesta página",async()=>{const pagina:any={verificar:async()=>{},abrir:async()=>{},listarModelos:()=>[],seleccionarModelo:async(m:string)=>({id:m,nombre:m}),preparar:async()=>{},enviar:async()=>{},async *observar(){yield{tipo:"respuesta",contenido:"OK"};yield{tipo:"fin"}},modeloActual:async()=>"default",obtenerConversacionActual:async()=>"c-nueva"};const conv:any={listar:async()=>[],mensajes:async()=>null};const ses:any={importar:async()=>{}};const ev=await recoger(new ProveedorDeepSeek(pagina,conv,ses).enviarMensaje({prompt:"hola",modelo:"default"}));expect(ev.at(-1).tipo).toBe("fin")});
});

test("DeepSeek continuar observa sin reenviar el prompt", async()=>{
 let enviados=0; const pagina:any={verificar:async()=>{},abrir:async()=>{},listarModelos:()=>[],seleccionarModelo:async(m:string)=>({id:m,nombre:m}),preparar:async()=>{},enviar:async()=>{enviados++},async *observar(){yield{tipo:"fin"}},modeloActual:async()=>"default",obtenerConversacionActual:async()=>"c"};
 const conv:any={listar:async()=>[],mensajes:async()=>null}; const ses:any={importar:async()=>{}};
 for await(const _ of new ProveedorDeepSeek(pagina,conv,ses).enviarMensaje({prompt:"no enviar",soloPoll:true,conversacionId:"c"})) {}
 expect(enviados).toBe(0);
});
