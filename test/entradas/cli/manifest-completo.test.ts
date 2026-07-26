import { describe, expect, test } from "bun:test";
import { obtenerManifestAgente, obtenerEsquemaComando, type EsquemaComandoAgente } from "../../../src/entradas/cli/agente/ManifestAgente";

describe("ManifestAgente discovery", () => {
  test("incluye quickStart navegable para un agente sin contexto", () => {
    const m = obtenerManifestAgente();
    expect(m.quickStart.length).toBeGreaterThanOrEqual(5);
    expect(m.quickStart[0]?.comando).toContain("discover");
    expect(m.quickStart.map((p) => p.comando).some((c) => c.includes("capi tareas esperar"))).toBe(true);
  });

  test("declara tabla global de errores con retryable y recovery", () => {
    const m = obtenerManifestAgente();
    expect(m.errorTable.length).toBeGreaterThan(10);
    for (const err of m.errorTable) {
      expect(err.code).toMatch(/^[A-Z_]+$/);
      expect(typeof err.retryable).toBe("boolean");
      expect(err.recovery.length).toBeGreaterThan(0);
    }
    expect(m.errorTable.some((e) => e.code === "WEBBRIDGE" && e.retryable === true)).toBe(true);
    expect(m.errorTable.some((e) => e.code === "TIMEOUT_ESPERA" && e.retryable === true)).toBe(true);
    expect(m.errorTable.some((e) => e.code === "ENVIO_INCIERTO" && e.retryable === false)).toBe(true);
  });

  test("identifica comandos de larga duracion y un helper para esperarlos", () => {
    const m = obtenerManifestAgente();
    expect(m.longRunning.commands.length).toBeGreaterThanOrEqual(3);
    expect(m.longRunning.helper).toContain("capi tareas esperar");
    expect(m.longRunning.defaultTimeoutMs).toBeGreaterThanOrEqual(1_800_000);
  });

  test("los comandos principales exponen examples para que un agente los pruebe sin leer el schema", () => {
    const m = obtenerManifestAgente();
    const principales = ["chat.send", "chat.wait", "doctor", "discover", "schema", "history.list", "state.metrics", "diagnostics.contracts"];
    for (const nombre of principales) {
      const cmd = m.commands.find((c) => c.name === nombre);
      expect(cmd).toBeDefined();
      expect(cmd!.examples).toBeDefined();
      expect(cmd!.examples!.length).toBeGreaterThan(0);
      for (const ej of cmd!.examples!) {
        expect(ej).toContain("capi ");
      }
    }
  });

  test("cubre los sub-comandos reales que antes faltaban en el manifest", () => {
    const m = obtenerManifestAgente();
    const nombres: string[] = m.commands.map((c) => c.name);
    for (const esperado of [
      "chat.send", "chat.wait", "tasks.list", "tasks.state", "models.list",
      "diagnostics.page", "diagnostics.complete", "diagnostics.network",
      "project.configure", "conversations.list", "conversations.messages",
      "context.pack", "context.explain", "vision.analyze", "vision.compare",
      "doctor", "discover", "schema",
    ]) {
      expect(nombres).toContain(esperado);
    }
  });

  test("exit codes cubren señales y timeout de espera", () => {
    const m = obtenerManifestAgente();
    expect(m.exitCodes.waitTimeout).toBe(124);
    expect(m.exitCodes.signalInterrupt).toBe(130);
    expect(m.exitCodes.signalTerm).toBe(143);
  });

  test("obtenerEsquemaComando devuelve el schema completo o undefined", () => {
    expect(obtenerEsquemaComando("chat.send")).toBeDefined();
    expect(obtenerEsquemaComando("desconocido")).toBeUndefined();
  });

  test("cada comando de larga duración expone defaultTimeoutMs", () => {
    const m = obtenerManifestAgente();
    for (const cmd of m.commands.filter((c) => c.behavior.longRunning)) {
      expect(cmd.behavior.defaultTimeoutMs).toBeGreaterThan(0);
    }
  });
});