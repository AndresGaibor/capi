import { describe, expect, test } from "bun:test";
import { resolverModeloQwen } from "../../../src/proveedores/qwen/modelos/ResolverModeloQwen";
import { primeraAlternativaNoVacia } from "../../../src/proveedores/qwen/politicas/PrimeraAlternativaNoVacia";

describe("Qwen", () => {
  test("resuelve aliases", () => {
    expect(resolverModeloQwen("max")).toBe("Qwen3.7-Max");
    expect(resolverModeloQwen("preview")).toBe("Qwen3.8-Max-Preview");
  });
  test("elige la primera alternativa no vacía", () => {
    expect(primeraAlternativaNoVacia([{ contenido: "" }, { contenido: "OK" }])?.contenido).toBe("OK");
  });
});
