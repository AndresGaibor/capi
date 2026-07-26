import { expect, test } from "bun:test";
import { EjecutarStreamingChat } from "../../src/modulos/chat/aplicacion/EjecutarStreamingChat";

test("EjecutarStreamingChat sustituye la respuesta cuando el proveedor corrige el fragmento", async () => {
  const proveedor: any = {
    async *enviarMensaje() {
      yield { tipo: "respuesta", contenido: "CAPI_CHATGPT_SESION_NUE_" };
      yield { tipo: "respuesta", contenido: "CAPI_CHATGPT_SESION_NUEVA_7", reemplazo: true };
      yield { tipo: "fin" };
    },
  };
  const ejecucion = new EjecutarStreamingChat();
  for await (const _ of ejecucion.ejecutar(proveedor, { prompt: "x" } as any, undefined)) {}
  expect(ejecucion.respuesta).toBe("CAPI_CHATGPT_SESION_NUEVA_7");
});
