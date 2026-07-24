import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { scriptExtraerEstadoStreamingQwen } from "../../src/proveedores/qwen/scripts/extraerEstadoStreaming";
import { scriptEstadoStreamingDeepSeek } from "../../src/proveedores/deepseek/scripts/estadoStreaming";
function ejecutar<T extends Record<string, unknown>>(html:string, script:string):T{const dom=new JSDOM(html,{runScripts:"outside-only"});return dom.window.eval(script) as T}
describe("scripts DOM",()=>{
 test("Qwen normal",()=>{const e=ejecutar<any>(readFileSync("test/fixtures/qwen/respuesta-normal.html","utf8"),scriptExtraerEstadoStreamingQwen());expect(e.response).toBe("OK")});
 test("Qwen A/B",()=>{const e=ejecutar<any>(readFileSync("test/fixtures/qwen/respuesta-ab.html","utf8"),scriptExtraerEstadoStreamingQwen());expect(e.response).toBe("OK");expect(e.isDualResponse).toBeTrue()});
 test("Qwen alta demanda",()=>{const e=ejecutar<any>(readFileSync("test/fixtures/qwen/alta-demanda.html","utf8"),scriptExtraerEstadoStreamingQwen());expect(e.isError).toBeTrue();expect(e.errorMessage).toContain("alta demanda")});
 test("Qwen vacío",()=>{const e=ejecutar<any>(readFileSync("test/fixtures/qwen/respuesta-vacia.html","utf8"),scriptExtraerEstadoStreamingQwen());expect(e.response).toBe("");expect(e.think).toContain("completado")});
 test("DeepSeek normal",()=>{const e=ejecutar<any>(readFileSync("test/fixtures/deepseek/respuesta-normal.html","utf8"),scriptEstadoStreamingDeepSeek());expect(e.response).toBe("OK")});
});
