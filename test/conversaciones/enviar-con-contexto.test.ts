import { expect, test } from "bun:test";
import { EnviarMensajeConContexto } from "../../src/modulos/chat/aplicacion/EnviarMensajeConContexto";

test("si la conversación elegida se ocupa en una carrera crea otra", async()=>{
  const peticiones:any[]=[];
  const proveedor:any={id:"qwen",async *enviarMensaje(p:any){peticiones.push(p);yield {tipo:"fin"}},obtenerConversacionActual:async()=>"nueva"};
  const proveedores:any={obtener:()=>proveedor};
  const gestor:any={seleccionar:()=>({proyecto:{id:"p",nombre:"P"},seleccion:{conversacionId:"vieja",motivo:"reciente_ruta"}})};
  const repo:any={
    adquirirEjecucion:()=>true, liberarEjecucion:()=>{}, renovarEjecucion:()=>true,
    adquirirOcupacion:()=>false, renovarOcupacion:()=>true, liberarOcupacion:()=>{},
    listarConversacionesProyecto:()=>[{id:"vieja"}], registrarConversacion:()=>{},
  };
  for await (const _ of new EnviarMensajeConContexto(proveedores,gestor,repo).ejecutar("qwen",{prompt:"hola"})) {}
  expect(peticiones[0].conversacionId).toBeUndefined();
  expect(peticiones[0].nuevaPestana).toBeTrue();
});

test("ante alta demanda baja de preview a max y continúa", async()=>{
  const modelos:string[]=[];
  const proveedor:any={id:"qwen",async *enviarMensaje(p:any){modelos.push(p.modelo);if(p.modelo==="preview")throw new Error("alta demanda");yield {tipo:"respuesta",contenido:"OK"};yield {tipo:"fin"}},obtenerConversacionActual:async()=>"nueva"};
  const proveedores:any={obtener:()=>proveedor};
  const gestor:any={seleccionar:()=>({proyecto:{id:"p",nombre:"P"},seleccion:{motivo:"nueva"}})};
  const repo:any={
    adquirirEjecucion:()=>true, liberarEjecucion:()=>{}, renovarEjecucion:()=>true,
    adquirirOcupacion:()=>true, renovarOcupacion:()=>true, liberarOcupacion:()=>{},
    listarConversacionesProyecto:()=>[], registrarConversacion:()=>{},
  };
  const eventos:any[]=[];
  for await (const e of new EnviarMensajeConContexto(proveedores,gestor,repo).ejecutar("qwen",{prompt:"hola",modelo:"preview"})) eventos.push(e);
  expect(modelos).toEqual(["preview","max"]);
  expect(eventos.some((e)=>e.mensaje?.includes("max"))).toBeTrue();
  expect(eventos.some((e)=>e.contenido==="OK")).toBeTrue();
});

test("DeepSeek degrada de expert a default en un chat nuevo", async()=>{
  const peticiones:any[]=[];
  const proveedor:any={id:"deepseek",async *enviarMensaje(p:any){peticiones.push(p);if(p.modelo==="expert")throw new Error("Server is busy.");yield {tipo:"respuesta",contenido:"OK"};yield {tipo:"fin"}},obtenerConversacionActual:async()=>"nueva-default"};
  const proveedores:any={obtener:()=>proveedor};
  const gestor:any={seleccionar:()=>({proyecto:{id:"p",nombre:"P"},seleccion:{conversacionId:"chat-expert",motivo:"reciente_ruta"}})};
  const repo:any={
    adquirirEjecucion:()=>true, liberarEjecucion:()=>{}, renovarEjecucion:()=>true,
    adquirirOcupacion:()=>true, renovarOcupacion:()=>true, liberarOcupacion:()=>{},
    listarConversacionesProyecto:()=>[{id:"chat-expert"}], registrarConversacion:()=>{},
  };
  for await (const _ of new EnviarMensajeConContexto(proveedores,gestor,repo).ejecutar("deepseek",{prompt:"hola",modelo:"expert"})) {}
  expect(peticiones[0]).toMatchObject({modelo:"expert",conversacionId:"chat-expert"});
  expect(peticiones[1]).toMatchObject({modelo:"default",conversacionId:undefined,nuevaPestana:true});
});
