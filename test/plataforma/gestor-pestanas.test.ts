import { expect, test } from "bun:test";
import { GestorPestanas } from "../../src/plataforma/webbridge/GestorPestanas";

test("reutiliza una pestaña raíz compatible", async () => {
  const transporte:any={ cdp:async()=>({targetInfos:[{targetId:"1",url:"https://chat.qwen.ai/",type:"page"}]}) };
  expect(await new GestorPestanas(transporte).planificar("qwen")).toMatchObject({ accion:"reutilizar", pestana:{targetId:"1"} });
});

test("rechaza abrir más pestañas que el límite", async () => {
  const transporte:any={ cdp:async()=>({targetInfos:[{targetId:"1",url:"https://chat.deepseek.com/a/chat/s/1",type:"page"},{targetId:"2",url:"https://chat.deepseek.com/a/chat/s/2",type:"page"}]}) };
  expect(new GestorPestanas(transporte,2).planificar("deepseek")).rejects.toThrow("límite de 2");
});


test("degrada a inventario vacío si la sesión WebBridge está cerrada", async () => {
  const transporte:any={ cdp:async()=>{ throw new Error('session capi-capture tab was closed'); } };
  expect(await new GestorPestanas(transporte).listar()).toEqual([]);
});


test("degrada a inventario vacío si CDP no permite listar pestañas", async () => {
  const gestor = new GestorPestanas({
    estaDisponible: async () => true,
    navegar: async () => {},
    evaluar: async () => ({ value: undefined }),
    cdp: async () => { throw new Error("Not allowed"); },
  });
  expect(await gestor.listar()).toEqual([]);
  expect(await gestor.planificar("qwen")).toEqual({ accion: "abrir" });
});
