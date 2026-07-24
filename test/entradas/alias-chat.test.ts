import { expect, test } from "bun:test";
import { normalizarArgumentosCli } from "../../src/entradas/cli/cli";

test("capi chat directo se normaliza a chat enviar", () => {
  expect(normalizarArgumentosCli(["chat", "hola"])).toEqual(["chat", "enviar", "hola"]);
});

test("chat enviar no se duplica", () => {
  expect(normalizarArgumentosCli(["chat", "enviar", "hola"])).toEqual(["chat", "enviar", "hola"]);
});
test("capi chat acepta flags antes del prompt",()=>{expect(normalizarArgumentosCli(["chat","--dry-run","hola"])).toEqual(["chat","enviar","--dry-run","hola"])});
