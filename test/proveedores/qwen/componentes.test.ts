import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { scriptPrepararEnvioQwen } from "../../../src/proveedores/qwen/scripts/enviarPrompt";
import { QwenModelos } from "../../../src/proveedores/qwen/navegador/QwenModelos";
import { QwenEnvio } from "../../../src/proveedores/qwen/navegador/QwenEnvio";
import { QwenControlEnvio } from "../../../src/proveedores/qwen/navegador/QwenControlEnvio";
import { QwenOpciones } from "../../../src/proveedores/qwen/navegador/QwenOpciones";
import { ProveedorQwen } from "../../../src/proveedores/qwen/ProveedorQwen";
class Fake { scripts:string[]=[]; async estaDisponible(){return true} async navegar(){} async evaluar<T>(codigo:string){this.scripts.push(codigo); if(codigo==="location.pathname") return {value:"/" as T}; if(codigo.includes("promptAparecio")) return {value:{promptAparecio:true,entradaVacia:true,conversacionNueva:true,generando:false} as T}; if(codigo.includes("model-selector-text")) return {value:"Qwen3.7-Plus" as T}; if(codigo.includes("role=\"listbox")) return {value:["Qwen3.7-Plus"] as T}; return {value:{ok:true,x:100,y:100} as T};} async cdp<T>():Promise<T>{return {} as T;} }
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


test("Qwen sincroniza el prompt con el estado controlado de React",()=>{
  const dom=new JSDOM('<main><textarea class="message-input-textarea"></textarea><button aria-label="Enviar"></button></main>',{runScripts:"outside-only",url:"https://chat.qwen.ai/"});
  Object.defineProperty(dom.window.HTMLElement.prototype,'getBoundingClientRect',{value(){return {width:20,height:20,left:0,top:0,right:20,bottom:20,x:0,y:0,toJSON(){}}}});
  const entrada=dom.window.document.querySelector('textarea') as any;
  let valorReact='';
  entrada['__reactProps$prueba']={value:'',onChange:(evento:any)=>{valorReact=evento.target.value;entrada['__reactProps$prueba'].value=evento.target.value;}};
  const resultado=dom.window.eval(scriptPrepararEnvioQwen("PROMPT_REACT")) as any;
  expect(resultado.ok).toBeTrue();
  expect(valorReact).toBe("PROMPT_REACT");
  expect(entrada['__reactProps$prueba'].value).toBe("PROMPT_REACT");
});

test("Qwen cambia de Pensamiento a Rápido con clic físico",async()=>{
 let actual="Pensamiento",liberaciones=0;
 const transporte:any={
  async evaluar(codigo:string){
   if(codigo.includes("return{actual:"))return{value:{actual,x:10,y:10}};
   if(codigo.includes("qwen-select-thinking-dropdown"))return{value:{x:20,y:20,texto:"Rápido"}};
   if(codigo.includes("qwen-select-thinking-label-text"))return{value:actual};
   return{value:null};
  },
  async cdp(_metodo:string,parametros:any){if(parametros.type==="mouseReleased"&&++liberaciones===2)actual="Rápido";}
 };
 await new QwenOpciones(transporte,async()=>{}).configurarRazonamiento(false);
 expect(actual).toBe("Rápido");
 expect(liberaciones).toBe(2);
});

test("ProveedorQwen configura razonamiento antes de enviar",async()=>{
 const orden:string[]=[];
 const pagina:any={
  verificarDisponibilidad:async()=>{},abrirConversacion:async()=>{},
  configurarRazonamiento:async(v:boolean)=>{orden.push(`modo:${v}`)},
  enviarPrompt:async()=>{orden.push("enviar")},obtenerConversacionActual:async()=>"c1",
  observarStreaming:async function*(){yield{tipo:"respuesta",contenido:"OK"};yield{tipo:"fin"}}
 };
 const eventos=[];for await(const e of new ProveedorQwen(pagina).enviarMensaje({prompt:"x",opciones:{razonamiento:false}} as any))eventos.push(e);
 expect(orden).toEqual(["modo:false","enviar"]);
 expect(eventos.some((e:any)=>e.tipo==="inicio"&&e.mensaje.includes("Fast"))).toBeTrue();
});


test("Qwen no duplica el clic cuando el DOM no confirma y CDP funciona",async()=>{
 const scripts:string[]=[];let clics=0;
 const transporte:any={
  async evaluar(codigo:string){scripts.push(codigo);if(codigo==="location.pathname")return{value:"/"};if(codigo.includes("btn.click(); return true"))return{value:false};if(codigo.includes("promptAparecio"))return{value:{promptAparecio:true,entradaVacia:true,conversacionNueva:true,generando:false}};return{value:{ok:true,x:10,y:10}};},
  async cdp(_m:string,p:any){if(p.type==="mouseReleased")clics++;}
 };
 await new QwenControlEnvio(transporte,async()=>{}).enviar("PROMPT_UNICO");
 expect(clics).toBe(1);
 expect(scripts.filter(c=>c.includes("btn.click(); return true"))).toHaveLength(1);
});

test("Qwen no confirma solo por editor vacío y UUID nuevo",async()=>{
 let sondeos=0;
 const transporte:any={
  async evaluar(codigo:string){if(codigo==="location.pathname")return{value:"/"};if(codigo.includes("promptAparecio")){sondeos++;return{value:{promptAparecio:false,entradaVacia:true,conversacionNueva:true,generando:false}}}return{value:{ok:true,x:10,y:10}};},
  async cdp(){},
 };
 await expect(new QwenControlEnvio(transporte,async()=>{}).enviar("PROMPT_AUSENTE")).rejects.toThrow("no materializó el mensaje");
 expect(sondeos).toBe(150);
});


test("Qwen confirma envío mediante historial aunque el DOM esté vacío",async()=>{
 let historial=0;
 const transporte:any={
  async evaluar(codigo:string){
   if(codigo==="location.pathname")return{value:"/"};
   if(codigo.includes("promptAparecio"))return{value:{promptAparecio:false,entradaVacia:true,conversacionNueva:true,conversacionId:"c1",generando:false}};
   if(codigo.includes("fetch('/api/v2/chats/")){historial++;return{value:true}};
   return{value:{ok:true,x:10,y:10}};
  },
  async cdp(){},
 };
 await new QwenControlEnvio(transporte,async()=>{}).enviar("PROMPT_REMOTO");
 expect(historial).toBe(1);
});


test("Qwen prefiere click de WebBridge sobre CDP",async()=>{
 let clicks=0,cdp=0;
 const transporte:any={
  async evaluar(codigo:string){if(codigo==="location.pathname")return{value:"/"};if(codigo.includes("promptAparecio"))return{value:{promptAparecio:true,entradaVacia:true,conversacionNueva:true,conversacionId:"c1",generando:false}};return{value:{ok:true,x:10,y:10}};},
  async click(){clicks++;},
  async cdp(){cdp++;},
 };
 await new QwenControlEnvio(transporte,async()=>{}).enviar("PROMPT_CLICK");
 expect(clicks).toBe(1);
 expect(cdp).toBe(0);
});


test("Qwen usa clic DOM de la sesión antes que CDP cuando WebBridge click falla",async()=>{
  let clicDom=0,cdp=0;
  const transporte:any={
    async evaluar(codigo:string){
      if(codigo==="location.pathname")return{value:"/"};
      if(codigo.includes("btn.click(); return true")){clicDom++;return{value:true}};
      if(codigo.includes("promptAparecio"))return{value:{promptAparecio:true,entradaVacia:true,conversacionNueva:true,conversacionId:"c1",generando:false}};
      return{value:{ok:true,x:10,y:10}};
    },
    async click(){throw new Error("click de extensión falló")},
    async cdp(){cdp++;},
  };
  await new QwenControlEnvio(transporte,async()=>{}).enviar("PROMPT_DOM");
  expect(clicDom).toBe(1);
  expect(cdp).toBe(0);
});

test("todos los scripts generados por QwenControlEnvio compilan",async()=>{
 const scripts:string[]=[];
 const transporte:any={
  async evaluar(codigo:string){scripts.push(codigo);if(codigo==="location.pathname")return{value:"/"};if(codigo.includes("promptAparecio"))return{value:{promptAparecio:true}};return{value:{ok:true,x:1,y:1}};},
  async click(){},
 };
 await new QwenControlEnvio(transporte,async()=>{}).enviar("PROMPT_COMPILA");
 for(const script of scripts)expect(()=>new Function(`return (${script})`)).not.toThrow();
});
