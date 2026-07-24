import { describe, expect, test } from "bun:test";
import { ClienteWebBridge } from "../../src/plataforma/webbridge/ClienteWebBridge";
describe("ClienteWebBridge",()=>{test("reporta indisponibilidad",async()=>{const c=new ClienteWebBridge("http://127.0.0.1:1");expect(await c.estaDisponible()).toBeFalse()})});

test("recrea la sesión si la pestaña fue cerrada al navegar",async()=>{
  const acciones:string[]=[];
  let navegaciones=0;
  const fetchFalso:any=async (_url:string, init:any)=>{
    const body=JSON.parse(init.body); acciones.push(body.action);
    if(body.action==="navigate" && navegaciones++===0) return new Response(JSON.stringify({ok:false,error:{message:'session "capi-capture" tab was closed'}}));
    return new Response(JSON.stringify({ok:true,data:{success:true}}));
  };
  const c=new ClienteWebBridge("http://bridge",fetchFalso);
  await c.navegar("https://chat.deepseek.com",false);
  expect(acciones).toEqual(["navigate","close_session","navigate"]);
});


test("recrea la sesión si WebBridge conserva un id de pestaña inexistente",async()=>{
  const acciones:string[]=[]; let navegaciones=0;
  const fetchFalso:any=async (_url:string, init:any)=>{
    const body=JSON.parse(init.body); acciones.push(body.action);
    if(body.action==="navigate" && navegaciones++===0) return new Response(JSON.stringify({ok:false,error:{message:"No tab with given id 123"}}));
    return new Response(JSON.stringify({ok:true,data:{success:true}}));
  };
  await new ClienteWebBridge("http://bridge",fetchFalso).navegar("https://chat.deepseek.com",false);
  expect(acciones).toEqual(["navigate","close_session","navigate"]);
});
