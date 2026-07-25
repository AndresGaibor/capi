import { expect, test } from "bun:test";
import { SELECTORES_QWEN } from "../../src/proveedores/qwen/selectores/SelectoresQwen";
import { SELECTORES_DEEPSEEK } from "../../src/proveedores/deepseek/selectores/SelectoresDeepSeek";

test("Qwen expone cadenas ordenadas con fallbacks semánticos",()=>{
  expect(Array.isArray(SELECTORES_QWEN.entrada)).toBeTrue();
  expect(SELECTORES_QWEN.entrada.join(" ")).toContain("contenteditable");
  expect(SELECTORES_QWEN.enviarCandidatos.join(" ")).toContain("aria-label");
});

test("DeepSeek evita selectores globales ambiguos",()=>{
  expect(Array.isArray(SELECTORES_DEEPSEEK.entrada)).toBeTrue();
  expect((SELECTORES_DEEPSEEK.respuestaCandidatos as readonly string[]).some(s=>s==='[class*="response"]')).toBeFalse();
  expect((SELECTORES_DEEPSEEK.detenerCandidatos as readonly string[]).some(s=>s==='[class*="stop"]')).toBeFalse();
});
