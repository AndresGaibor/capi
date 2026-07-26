import { expect, test } from "bun:test";
import { obtenerManifestAgente, obtenerEsquemaComando } from "../../src/entradas/cli/agente/ManifestAgente";

test("descubre capacidades agent-first", () => {
  const manifest = obtenerManifestAgente();
  expect(manifest.protocol).toBe("capi.agent.v1");
  expect(manifest.interfaces).toContain("cli");
  expect(manifest.interfaces).toContain("mcp");
  expect(manifest.commands.some((c) => c.name === "chat.send")).toBeTrue();
  expect(manifest.commands.some((c) => c.name === "context.pack")).toBeTrue();
  expect(manifest.contextFiles.bundleByDefault).toBeTrue();
  expect(manifest.outputFormats).toEqual(["markdown", "human", "json", "jsonl"]);
});

test("expone un esquema de chat completo y sin interacción", () => {
  const schema = obtenerEsquemaComando("chat.send");
  expect(schema?.inputSchema.required).toContain("prompt");
  expect(schema?.inputSchema.properties.output.enum).toContain("jsonl");
  expect(schema?.inputSchema.properties.bundleContext.default).toBeTrue();
  expect(schema?.behavior.nonInteractive).toBeTrue();
});
