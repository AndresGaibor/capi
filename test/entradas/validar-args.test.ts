import { expect, test } from "bun:test";
import { comandoPrincipal } from "../../src/entradas/cli/cli";
import { validarArgumentosDesconocidos } from "../../src/entradas/cli/soporte/validar-args";

test("valida flags contra el comando específico", () => {
  const resultado = validarArgumentosDesconocidos(["chat", "--conversation-id", "abc"], comandoPrincipal as any);
  expect(resultado.ok).toBeFalse();
  expect(resultado.unknowns).toEqual(["--conversation-id"]);
  expect(resultado.command).toBe("chat enviar");
  expect(resultado.suggestions).toContain("--conversacion");
});

test("acepta aliases y flags válidos del comando", () => {
  const resultado = validarArgumentosDesconocidos(["chat", "-p", "qwen", "--continuar"], comandoPrincipal as any);
  expect(resultado.ok).toBeTrue();
});

test("detecta typo de subcomando raiz y sugiere el mas cercano", () => {
  const resultado = validarArgumentosDesconocidos(["modelo", "listar"], comandoPrincipal as any);
  expect(resultado.ok).toBeFalse();
  expect(resultado.subcommandSuggestions).toContain("modelos");
  expect(resultado.unknowns).toContain("modelo");
});

test("detecta typo de subcomando anidado y sugiere los parecidos", () => {
  const resultado = validarArgumentosDesconocidos(["vision", "listar"], comandoPrincipal as any);
  expect(resultado.ok).toBeFalse();
  expect(resultado.unknowns).toContain("listar");
  expect(resultado.command).toBe("vision");
});

test("acepta 'capi chat hola' sin subcomando explicito", () => {
  const resultado = validarArgumentosDesconocidos(["chat", "-p", "qwen", "--output", "jsonl", "hola"], comandoPrincipal as any);
  expect(resultado.ok).toBeTrue();
});
