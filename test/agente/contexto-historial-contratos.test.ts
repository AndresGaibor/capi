import { expect, test } from "bun:test";
import { comandoPrincipal } from "../../src/entradas/cli/cli";
import { obtenerManifestAgente } from "../../src/entradas/cli/agente/ManifestAgente";

test("CLI y manifiesto exponen contexto, historial y contratos", () => {
  const subcomandos = comandoPrincipal.subCommands as any;
  expect(subcomandos?.contexto).toBeDefined();
  expect(subcomandos?.historial).toBeDefined();
  const nombres = obtenerManifestAgente().commands.map(c => c.name);
  expect(nombres).toContain("context.explain");
  expect(nombres).toContain("history.list");
  expect(nombres).toContain("diagnostics.contracts");
});
