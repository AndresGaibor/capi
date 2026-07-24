import { test, expect } from "bun:test";
import { normalizarRespuesta, truncarTexto } from "../src/proveedores/deepseek/servicios/NormalizarRespuestaDeepSeek";

test("normalizarRespuesta elimina comentarios del sistema", () => {
  const input = "We need to parse the user's input. I'll respond in Spanish with a warm greeting and offer assistance.¡Hola! ¿En qué puedo ayudarte?";
  const resultado = normalizarRespuesta(input);
  expect(resultado).toBe("¡Hola! ¿En qué puedo ayudarte?");
});

test("normalizarRespuesta conserva saltos de línea normales", () => {
  const input = "Línea 1\nLínea 2\n\nLínea 3";
  const resultado = normalizarRespuesta(input);
  expect(resultado).toBe("Línea 1\nLínea 2\n\nLínea 3");
});

test("normalizarRespuesta maneja cadenas vacías", () => {
  expect(normalizarRespuesta("")).toBe("");
});

test("truncarTexto trunca textos largos correctamente", () => {
  const texto = "Este es un texto bastante largo para ser probado";
  const res1 = truncarTexto(texto, 10);
  expect(res1.truncado).toBe(true);
  expect(res1.texto).toBe("Este es un...");

  const res2 = truncarTexto(texto, 100);
  expect(res2.truncado).toBe(false);
  expect(res2.texto).toBe(texto);
});
