import { describe, expect, test } from "bun:test";
import { crearSobreExito, crearSobreError, serializarSalida } from "../../../src/entradas/cli/agente/FormatoSalida";
import { obtenerManifestAgente } from "../../../src/entradas/cli/agente/ManifestAgente";

describe("Self-discoverability para un agente IA", () => {
  test("un sobre JSON de exito tiene la forma que espera un agente sin contexto", () => {
    const sobre = crearSobreExito("test", { items: [1, 2, 3], total: 3 });
    const json = JSON.parse(serializarSalida(sobre, "json"));
    expect(json.protocol).toBe("capi.agent.v1");
    expect(json.ok).toBe(true);
    expect(json.command).toBe("test");
    expect(typeof json.requestId).toBe("string");
    expect(Array.isArray(json.suggestions)).toBe(true);
  });

  test("un sobre JSON de error incluye codigo tipado, retryable y suggestions", () => {
    const error = Object.assign(new Error("falle"), {
      codigo: "ALTA_DEMANDA",
      retryable: true,
      suggestions: [{ command: "capi chat -p deepseek --output jsonl \"hola\"", reason: "usar el proveedor alternativo" }],
    });
    const sobre = crearSobreError("chat.send", error, { requestId: "r-1" });
    const json = JSON.parse(serializarSalida(sobre, "json"));
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("ALTA_DEMANDA");
    expect(json.error.retryable).toBe(true);
    expect(json.error.message).toBe("falle");
    expect(json.suggestions.length).toBe(1);
    expect(json.suggestions[0].command).toContain("capi chat");
    expect(json.requestId).toBe("r-1");
  });

  test("el formato markdown produce secciones legibles para un LLM", () => {
    const sobre = crearSobreExito("chat.send", { model: "qwen-preview", status: "ok" }, { suggestions: [{ command: "capi tareas esperar <id>", reason: "esperar el resultado" }] });
    const md = serializarSalida(sobre, "markdown");
    expect(md).toContain("# CAPI: chat.send");
    expect(md).toContain("**Estado:**");
    expect(md).toContain("## Siguientes acciones");
    expect(md).toContain("`capi tareas esperar <id>`");
  });

  test("todos los pasos del quickStart que son comandos son ejecutables", () => {
    const m = obtenerManifestAgente();
    expect(m.quickStart.length).toBeGreaterThanOrEqual(5);
    for (const paso of m.quickStart) {
      expect(paso.comando).toMatch(/^(capi |consulta)/);
      expect(paso.razon.length).toBeGreaterThan(10);
    }
    const nombres = m.quickStart.map((p) => p.titulo);
    expect(nombres).toContain("Descubre el contrato");
    expect(nombres).toContain("Aprende un comando especifico");
    expect(nombres).toContain("Comprueba el entorno");
    expect(nombres).toContain("Lanza la tarea");
  });

  test("el flujo de un agente que recibe un error encuentra recuperacion", () => {
    const m = obtenerManifestAgente();
    const webbridgeErrors = m.errorTable.filter((e) => e.code.startsWith("WEBBRIDGE"));
    expect(webbridgeErrors.length).toBeGreaterThan(0);
    for (const err of webbridgeErrors) {
      expect(err.recovery.toLowerCase()).toContain("doctor");
    }
    const altaDemanda = m.errorTable.find((e) => e.code === "ALTA_DEMANDA");
    expect(altaDemanda).toBeDefined();
    expect(altaDemanda!.recovery).toContain("alternativa");
    const timeout = m.errorTable.find((e) => e.code === "TIMEOUT_PROVEEDOR");
    expect(timeout).toBeDefined();
    expect(timeout!.recovery).toContain("deepseek");
  });

  test("errors del manifest pueden serializarse en un sobre JSON que un agente lee", () => {
    const m = obtenerManifestAgente();
    for (const err of m.errorTable.slice(0, 5)) {
      const fakeError = Object.assign(new Error(err.code), { codigo: err.code });
      const sobre = crearSobreError("self-test", fakeError);
      const json = JSON.parse(serializarSalida(sobre, "json"));
      expect(json.error.code).toBe(err.code);
      expect(typeof json.error.retryable).toBe("boolean");
    }
  });
});