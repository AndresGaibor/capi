import { describe, expect, test } from "bun:test";
import { ClienteWebBridge, WebBridgeError } from "../../src/plataforma/webbridge/ClienteWebBridge";
describe("ClienteWebBridge",()=>{test("reporta indisponibilidad",async()=>{const c=new ClienteWebBridge("http://127.0.0.1:1");expect(await c.estaDisponible()).toBeFalse()})});

test("normaliza evaluate directo y envuelto", async () => {
  let llamada = 0;
  const fetchFalso: any = async () => new Response(JSON.stringify({ ok: true, data: llamada++ === 0 ? true : { value: "ok" } }));
  const c = new ClienteWebBridge("http://bridge", fetchFalso);
  expect((await c.evaluar<boolean>("true")).value).toBeTrue();
  expect((await c.evaluar<string>('"ok"')).value).toBe("ok");
});

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

test("reintenta en errores transitorios de red (ECONNREFUSED) y recupera", async () => {
  let intentos = 0;
  const fetchFalso: any = async () => {
    intentos++;
    if (intentos <= 2) throw new TypeError("fetch failed");
    return new Response(JSON.stringify({ ok: true, data: { tabs: [] } }));
  };
  const c = new ClienteWebBridge("http://bridge", fetchFalso);
  const resultado = await c.listarPestanas();
  expect(resultado).toEqual([]);
  expect(intentos).toBe(3);
});

test("selecciona la pestaña activa del proveedor antes que una pestaña antigua", async () => {
  const acciones: Array<{ action: string; args: Record<string, unknown> }> = [];
  const fetchFalso: any = async (_url: string, init: any) => {
    const cuerpo = JSON.parse(init.body);
    acciones.push(cuerpo);
    if (cuerpo.action === "list_tabs") {
      return new Response(JSON.stringify({ ok: true, data: { tabs: [
        { url: "https://chatgpt.com/c/antigua", active: false },
        { url: "https://chatgpt.com/c/actual", active: true },
      ] } }));
    }
    return new Response(JSON.stringify({ ok: true, data: { success: true } }));
  };
  const c = new ClienteWebBridge("http://bridge", fetchFalso);
  await c.seleccionarPestanaPorHost("chatgpt.com");
  expect(acciones.at(-1)?.args).toEqual({ url: "https://chatgpt.com/c/actual", active: false });
});

test("NO reintenta en WebBridgeError (error de la aplicación)", async () => {
  let intentos = 0;
  const fetchFalso: any = async () => {
    intentos++;
    return new Response(JSON.stringify({ ok: false, error: { code: "tool_error", message: "not found" } }));
  };
  const c = new ClienteWebBridge("http://bridge", fetchFalso);
  await expect(c.listarPestanas()).rejects.toThrow(WebBridgeError);
  expect(intentos).toBe(1);
});

test("NO reintenta en errores no transitorios", async () => {
  let intentos = 0;
  const fetchFalso: any = async () => {
    intentos++;
    throw new Error("algo raro paso");
  };
  const c = new ClienteWebBridge("http://bridge", fetchFalso);
  await expect(c.listarPestanas()).rejects.toThrow("algo raro paso");
  expect(intentos).toBe(1);
});
