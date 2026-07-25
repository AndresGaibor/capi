import { expect, test } from "bun:test";
import { normalizarUrlConversacion, canonicalizarConversacion } from "../../src/proveedores/chatgpt/utilidades/urlConversacion";

test("normalizarUrlConversacion acepta UUID simples", () => {
  expect(normalizarUrlConversacion("abc123")).toBe("https://chatgpt.com/c/abc123");
});

test("normalizarUrlConversacion acepta rutas relativas con c/", () => {
  expect(normalizarUrlConversacion("c/abc123")).toBe("https://chatgpt.com/c/abc123");
});

test("normalizarUrlConversacion acepta rutas con /c/", () => {
  expect(normalizarUrlConversacion("/c/abc123")).toBe("https://chatgpt.com/c/abc123");
});

test("normalizarUrlConversacion acepta URLs completas", () => {
  expect(normalizarUrlConversacion("https://chatgpt.com/c/abc123")).toBe("https://chatgpt.com/c/abc123");
});

test("normalizarUrlConversacion limpia query params de URLs", () => {
  expect(normalizarUrlConversacion("https://chatgpt.com/c/abc123?model=xyz")).toBe("https://chatgpt.com/c/abc123");
});

test("canonicalizarConversacion devuelve null para URLs sin /c/", () => {
  expect(canonicalizarConversacion("https://chatgpt.com/")).toBeNull();
  expect(canonicalizarConversacion("https://chat.openai.com/")).toBeNull();
});

test("canonicalizarConversacion devuelve URL canónica para URLs válidas", () => {
  expect(canonicalizarConversacion("https://chatgpt.com/c/abc123")).toBe("https://chatgpt.com/c/abc123");
  expect(canonicalizarConversacion("https://chatgpt.com/c/abc123?foo=bar")).toBe("https://chatgpt.com/c/abc123");
});
