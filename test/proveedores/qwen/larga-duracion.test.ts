import { extraerRespuestaSnapshotQwen } from "../../../src/proveedores/qwen/navegador/ExtraerRespuestaSnapshotQwen";
import { expect, test } from "bun:test";
import { QwenStreaming } from "../../../src/proveedores/qwen/navegador/QwenStreaming";
import { ProveedorQwen } from "../../../src/proveedores/qwen/ProveedorQwen";
import { scriptRespuestaHistorialQwen, scriptConfirmarPromptHistorialQwen } from "../../../src/proveedores/qwen/scripts/respuestaHistorial";

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

test("ProveedorQwen entrega el UUID conocido al streaming para recuperación", async () => {
  let recibido: string | undefined;
  const pagina = {
    verificarDisponibilidad: async () => {}, abrirConversacion: async () => {},
    obtenerConversacionActual: async () => "chat-recuperable",
    enviarPrompt: async () => {},
    observarStreaming: async function* (id?: string) { recibido = id; yield { tipo: "fin" }; },
  };
  await recoger(new ProveedorQwen(pagina as any).enviarMensaje({ prompt: "hola" }));
  expect(recibido).toBe("chat-recuperable");
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

test("Qwen sobrevive veinte fallos, recupera pestaña y continúa", async () => {
  let intentos=0, recuperaciones=0;
  const transporte={
    async evaluar<T>(){ if(++intentos<=20) throw new Error("pestaña recargada"); return {value:{think:"",response:"RECUPERADA",done:true,isGenerating:false,isAssistant:true,isError:false,errorMessage:""} as T}; },
    async recuperarPestana(){ recuperaciones++; return true; },
  };
  const eventos=await recoger(new QwenStreaming(transporte as any,async()=>{},(()=>{let t=0;return()=>t+=2_000;})()).observar());
  expect(recuperaciones).toBeGreaterThan(0);
  expect(eventos.find(e=>e.tipo==="respuesta")?.contenido).toBe("RECUPERADA");
  expect(eventos.some(e=>e.tipo==="pausado")).toBeFalse();
});

test('snapshot Qwen ignora anuncios accesibles y controles de interfaz', () => {
  const tree = { role:'main', children:[
    {role:'StaticText',name:'Pensamiento completado'},
    {role:'StaticText',name:'Acknowledging the signal received'},
    {role:'StaticText',name:'Saltar'},
    {role:'button',name:'Copiar'}
  ]};
  expect(extraerRespuestaSnapshotQwen(tree)).toBe('');
});

test('Qwen no consulta snapshot mientras la generación sigue activa', async()=>{
  let snapshots=0; let paso=0;
  const transporte:any={
    async evaluar(c:string){
      if(c.includes('__CAPI_QWEN_BRIDGE__')) return {value:null};
      if(c==='location.href') return {value:'https://chat.qwen.ai/c/activa'};
      paso++;
      return {value: paso<3?{think:'Pensamiento completado',response:'',done:false,isGenerating:true,isAssistant:true,isError:false,errorMessage:''}:{think:'',response:'FINAL',done:true,isGenerating:false,isAssistant:true,isError:false,errorMessage:'',extractionStrategy:'semantic'}};
    },
    async snapshotAccesibilidad(){snapshots++;return{tree:{role:'main'}}}
  };
  const pausas=async()=>{}; let ahora=0;
  const eventos=[]; for await(const e of new QwenStreaming(transporte,pausas,()=>{ahora+=3000;return ahora}).observar()) eventos.push(e);
  expect(snapshots).toBe(0);
  expect(eventos.some((e:any)=>e.tipo==='respuesta'&&e.contenido==='FINAL')).toBeTrue();
});

test('Qwen marca requiere_usuario cuando termina pensamiento sin respuesta', async()=>{
  let ahora=0;
  const transporte:any={
    async evaluar(c:string){
      if(c.includes('__CAPI_QWEN_BRIDGE__')) return {value:null};
      if(c==='location.href') return {value:'https://chat.qwen.ai/c/vacia'};
      return {value:{think:'Pensamiento completado',response:'',done:false,isGenerating:false,isAssistant:true,isError:false,errorMessage:''}};
    },
    async snapshotAccesibilidad(){return{tree:{role:'main',children:[{role:'StaticText',name:'Pensamiento completado'},{role:'button',name:'Copiar'}]}}}
  };
  const eventos=[]; for await(const e of new QwenStreaming(transporte,async()=>{},()=>{ahora+=6000;return ahora}).observar()) eventos.push(e);
  expect(eventos.at(-1)).toMatchObject({tipo:'estado',estado:'requiere_usuario'});
});


test("Qwen regenera una sola vez un turno vacío sin reenviar el prompt", async()=>{
  let ahora=0,lecturas=0,clicks=0,snapshots=0;
  const transporte:any={
    async evaluar(c:string){
      if(c.includes('__CAPI_QWEN_BRIDGE__')) return {value:null};
      if(c==='location.href') return {value:'https://chat.qwen.ai/c/regenerada'};
      if(c.includes("fetch('/api/v2/chats/")) return {value:{contenido:'',pensamiento:'',terminado:false}};
      if(c.includes('const turnos=[...document.querySelectorAll')){clicks++;return{value:true}}
      lecturas++;
      if(lecturas<=4)return{value:{think:'Pensamiento completado',response:'',done:false,isGenerating:false,isAssistant:true,isError:false,errorMessage:'',canRegenerate:true,hasSemanticResponse:true,turnoId:'t1'}};
      return{value:{think:'',response:'RESPUESTA_REGENERADA',done:true,isGenerating:false,isAssistant:true,isError:false,errorMessage:'',canRegenerate:true,hasSemanticResponse:true,turnoId:'t2',extractionStrategy:'semantic'}};
    },
    async snapshotAccesibilidad(){snapshots++;return{tree:{role:'main'}}}
  };
  const eventos=[];for await(const e of new QwenStreaming(transporte,async()=>{},()=>{ahora+=3000;return ahora}).observar())eventos.push(e);
  expect(clicks).toBe(1);
  expect(snapshots).toBe(0);
  expect(eventos).toContainEqual(expect.objectContaining({tipo:'estado',detalles:'respuesta_vacia_regenerada'}));
  expect(eventos).toContainEqual(expect.objectContaining({tipo:'respuesta',contenido:'RESPUESTA_REGENERADA'}));
  expect(eventos.at(-1)?.tipo).toBe('fin');
});


test("Qwen recupera una pestaña cerrada usando el UUID ya conocido",async()=>{
  const recuperaciones:Array<string|undefined>=[];
  const transporte:any={
    async evaluar(){throw new Error("pestaña cerrada")},
    async recuperarPestana(_host:string,url?:string){recuperaciones.push(url);return true},
  };
  const generador=(new QwenStreaming(transporte,async()=>{},()=>Date.now()) as any).observar("CONVERSACION_CONOCIDA");
  const primero=await generador.next();
  expect(primero.value).toMatchObject({tipo:"estado",estado:"desconectado"});
  await generador.next();
  expect(recuperaciones[0]).toBe("https://chat.qwen.ai/c/CONVERSACION_CONOCIDA");
  await generador.return(undefined);
});

test("Qwen recupera respuesta final desde historial cuando el DOM está vacío",async()=>{
 let ahora=0,consultas=0;
 const transporte:any={
  async evaluar(c:string){
   if(c.includes("fetch('/api/v2/chats/")){consultas++;return{value:{contenido:"RESPUESTA_HISTORIAL_QWEN",pensamiento:"",terminado:true,modelo:"Qwen3.7-Plus",turnoId:"a1"}}}
   if(c.includes('__CAPI_QWEN_BRIDGE__'))return{value:null};
   if(c==='location.href')return{value:'https://chat.qwen.ai/c/historial'};
   return{value:{think:'',response:'',done:false,isGenerating:false,isAssistant:true,isError:false,errorMessage:'',hasSemanticResponse:true}};
  }
 };
 const eventos=[];for await(const e of new QwenStreaming(transporte,async()=>{},()=>{ahora+=3000;return ahora}).observar())eventos.push(e);
 expect(consultas).toBeGreaterThan(0);
 expect(eventos).toContainEqual(expect.objectContaining({tipo:'respuesta',contenido:'RESPUESTA_HISTORIAL_QWEN',estrategia:'historial'}));
 expect(eventos.at(-1)?.tipo).toBe('fin');
});

test("scripts de historial Qwen correlacionan después del último usuario",()=>{
 const respuesta=scriptRespuestaHistorialQwen('c1');
 const confirmacion=scriptConfirmarPromptHistorialQwen('c1','MARCADOR');
 expect(respuesta).toContain("mensajes.slice(ultimoUsuario+1)");
 expect(respuesta).toContain("content_list");
 expect(confirmacion).toContain("role||''");
 expect(()=>new Function(`return (${respuesta})`)).not.toThrow();
 expect(()=>new Function(`return (${confirmacion})`)).not.toThrow();
});
