import { describe, expect, test } from "bun:test";
import { ClienteWebBridge, WebBridgeError } from "../../src/plataforma/webbridge/ClienteWebBridge";
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

test("lanza WebBridgeError tipado en lugar de string con JSON embebido", async () => {
  const fetchFalso: any = async (_url: string, _init: any) => {
    return new Response(JSON.stringify({ ok: false, error: { code: "tool_error", message: "tool no encontrado" } }));
  };
  const c = new ClienteWebBridge("http://bridge", fetchFalso);
  let errorCapturado: any = null;
  try {
    await c.listarPestanas();
  } catch (error) {
    errorCapturado = error;
  }
  expect(errorCapturado).toBeInstanceOf(WebBridgeError);
  expect(errorCapturado.codigo).toBe("WEBBRIDGE_TOOL_ERROR");
  expect(errorCapturado.codigoExtension).toBe("tool_error");
  expect(errorCapturado.peticion.action).toBe("list_tabs");
  expect((errorCapturado.message)).not.toContain(JSON.stringify({ tool_error: "..." }));
  expect(errorCapturado.mensajeOriginal).toEqual({ code: "tool_error", message: "tool no encontrado" });
});
