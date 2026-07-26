import { describe, expect, test } from "bun:test";
import { ClienteWebBridge } from "../../src/plataforma/webbridge/ClienteWebBridge";
describe("ClienteWebBridge",()=>{test("reporta indisponibilidad",async()=>{const c=new ClienteWebBridge("http://127.0.0.1:1");expect(await c.estaDisponible()).toBeFalse()})});

test("NO recrea la sesión al fallar 'tab was closed' y propaga el error", async () => {
  const acciones: string[] = [];
  let navegaciones = 0;
  const fetchFalso: any = async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    acciones.push(body.action);
    if (body.action === "navigate" && navegaciones++ === 0) {
      return new Response(JSON.stringify({ ok: false, error: { message: 'session "capi-capture" tab was closed' } }));
    }
    return new Response(JSON.stringify({ ok: true, data: { success: true } }));
  };
  const c = new ClienteWebBridge("http://bridge", fetchFalso);
  await expect(c.navegar("https://chat.deepseek.com", false)).rejects.toThrow(/tab was closed/);
  expect(acciones).toEqual(["navigate"]);
  expect(acciones).not.toContain("close_session");
});


test("NO recrea la sesión al fallar 'no tab with given id' y propaga el error", async () => {
  const acciones: string[] = [];
  let navegaciones = 0;
  const fetchFalso: any = async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    acciones.push(body.action);
    if (body.action === "navigate" && navegaciones++ === 0) {
      return new Response(JSON.stringify({ ok: false, error: { message: "No tab with given id 123" } }));
    }
    return new Response(JSON.stringify({ ok: true, data: { success: true } }));
  };
  await expect(new ClienteWebBridge("http://bridge", fetchFalso).navegar("https://chat.deepseek.com", false)).rejects.toThrow(/No tab with given id/);
  expect(acciones).toEqual(["navigate"]);
  expect(acciones).not.toContain("close_session");
});
