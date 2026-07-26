import { expect, test } from "bun:test";
import { resolverConversacionParaChat } from "../../src/entradas/cli/comandos/chat/enviar";

test("usa la conversación persistida e ignora la abierta en navegador", () => {
  expect(resolverConversacionParaChat({ explicita: undefined, persistida: "guardada", forzarNueva: false })).toBe("guardada");
});

test("la conversación explícita tiene prioridad", () => {
  expect(resolverConversacionParaChat({ explicita: "manual", persistida: "guardada", forzarNueva: false })).toBe("manual");
});

test("nueva elimina cualquier conversación seleccionada", () => {
  expect(resolverConversacionParaChat({ explicita: undefined, persistida: "guardada", forzarNueva: true })).toBeUndefined();
});

test("persistencia por path: misma ruta siempre reutiliza la conversación guardada", () => {
  const ruta = "/Users/dev/mi-proyecto";
  const primera = resolverConversacionParaChat({ explicita: undefined, persistida: "conv-abc", forzarNueva: false });
  expect(primera).toBe("conv-abc");
  const segunda = resolverConversacionParaChat({ explicita: undefined, persistida: "conv-abc", forzarNueva: false });
  expect(segunda).toBe("conv-abc");
});

test("forcerNueva ignora persistencia y devuelve undefined para chat nuevo", () => {
  expect(resolverConversacionParaChat({ explicita: undefined, persistida: "conv-abc", forzarNueva: true })).toBeUndefined();
});
