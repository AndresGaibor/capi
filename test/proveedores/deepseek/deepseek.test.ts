import { describe, expect, test } from "bun:test";
import { resolverModeloDeepSeek, listarModelosDeepSeek } from "../../../src/proveedores/deepseek/modelos/ResolverModeloDeepSeek";
import { convertirRegistroHistoria } from "../../../src/proveedores/deepseek/servicios/ConvertirRegistroHistoria";

describe("DeepSeek", () => {
  test("valida modelos", () => { expect(resolverModeloDeepSeek("VISION")).toBe("vision"); expect(listarModelosDeepSeek()).toHaveLength(3); expect(() => resolverModeloDeepSeek("otro")).toThrow("Modelo no disponible"); });
  test("convierte historial", () => { const c=convertirRegistroHistoria({id:"1",title:"T",messages:[{role:"user",content:"hola"},{role:"assistant",content:"ok"}]}); expect(c?.mensajes.map(m=>m.rol)).toEqual(["usuario","asistente"]); });
});

test("DeepSeek genera un script de envío con prompt escapado", async () => {
  const { scriptEnviarPromptDeepSeek } = await import("../../../src/proveedores/deepseek/scripts/enviarPrompt");
  const script = scriptEnviarPromptDeepSeek('hola "mundo"');
  expect(script).toContain(JSON.stringify('hola "mundo"'));
  expect(script).toContain("ds-button--primary.ds-button--filled.ds-button--circle");
});
