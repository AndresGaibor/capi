import { expect,test } from "bun:test";
import { ClienteWebBridge, sanearRegistroRed } from "../../src/plataforma/webbridge/ClienteWebBridge";

test("recupera pestaña por host y reabre url si no existe",async()=>{const acciones:string[]=[];const f:any=async(_u:string,i:any)=>{const b=JSON.parse(i.body);acciones.push(b.action);if(b.action==="list_tabs")return new Response(JSON.stringify({ok:true,data:{tabs:[]}}));return new Response(JSON.stringify({ok:true,data:{success:true}}));};const c=new ClienteWebBridge("http://x",f);expect(await c.recuperarPestana("chat.qwen.ai","https://chat.qwen.ai/c/abc")).toBeTrue();expect(acciones).toEqual(["list_tabs","navigate"]);});

test("sanea red sin autorización cookies ni cuerpos privados",()=>{const s=sanearRegistroRed({url:"https://x/api?token=secret",requestHeaders:{Authorization:"Bearer secret",Cookie:"a=b",Accept:"x"},responseHeaders:{"set-cookie":"x",status:"ok"},requestBody:"prompt privado",responseBody:"respuesta privada",method:"POST",status:200});expect(JSON.stringify(s)).not.toMatch(/secret|privado|cookie|authorization/i);expect(s.method).toBe("POST");expect(s.status).toBe(200);});
