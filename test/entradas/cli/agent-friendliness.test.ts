import { describe, expect, test } from "bun:test";
import { comandoDiscover } from "../../../src/entradas/cli/comandos/agente/discover";
import { comandoSchema } from "../../../src/entradas/cli/comandos/agente/schema";
import { comandoChatEnviar } from "../../../src/entradas/cli/comandos/chat/enviar";
import { comandoContextoEmpaquetar } from "../../../src/entradas/cli/comandos/contexto/empaquetar";
import { comandoContextoExplicar } from "../../../src/entradas/cli/comandos/contexto/explicar";
import { comandoHistorialListar } from "../../../src/entradas/cli/comandos/historial/listar";
import { comandoDiagnosticoContratos } from "../../../src/entradas/cli/comandos/diagnostico/contratos";
import { comandoDiagnosticoCompleto } from "../../../src/entradas/cli/comandos/diagnostico/completo";
import { comandoConversacionesProyecto } from "../../../src/entradas/cli/comandos/conversaciones/proyecto";
import { comandoProyectoActual } from "../../../src/entradas/cli/comandos/proyecto/actual";
import { comandoTareasReanudar } from "../../../src/entradas/cli/comandos/tareas/reanudar";
import { crearSobreExito, serializarSalida } from "../../../src/entradas/cli/agente/FormatoSalida";
import { obtenerManifestAgente } from "../../../src/entradas/cli/agente/ManifestAgente";

describe("Agent-friendliness: markdown como default", () => {
  const comandosConOutputMarkdown = [
    ["discover", comandoDiscover],
    ["schema", comandoSchema],
    ["chat enviar", comandoChatEnviar],
    ["contexto empaquetar", comandoContextoEmpaquetar],
    ["contexto explicar", comandoContextoExplicar],
    ["historial listar", comandoHistorialListar],
    ["diagnostico contratos", comandoDiagnosticoContratos],
    ["diagnostico completo", comandoDiagnosticoCompleto],
    ["conversaciones proyecto", comandoConversacionesProyecto],
    ["proyecto actual", comandoProyectoActual],
    ["tareas reanudar", comandoTareasReanudar],
  ] as const;

  for (const [nombre, cmd] of comandosConOutputMarkdown) {
    test(`${nombre}: output.default es "markdown"`, () => {
      const args = (cmd as any).args;
      const outputArg = args?.output;
      expect(outputArg).toBeDefined();
      expect(outputArg.default).toBe("markdown");
    });
  }

  test("manifest output incluye markdown como primero", () => {
    const m = obtenerManifestAgente();
    expect(m.outputFormats[0]).toBe("markdown");
  });

  test("serializarSalida produce markdown legible sin ANSI por defecto", () => {
    const sobre = crearSobreExito("test", { foo: "bar" });
    const md = serializarSalida(sobre, "markdown");
    expect(md).toContain("# CAPI: test");
    expect(md).toContain("**Estado:**");
    expect(md).not.toContain("\u001b");
  });
});

describe("Agent-friendliness: discover y schema son autoexplicativos", () => {
  test("discover incluye quickStart que guía al agente paso a paso", () => {
    const m = obtenerManifestAgente();
    expect(m.quickStart.length).toBeGreaterThanOrEqual(5);
    expect(m.quickStart[0]?.comando).toContain("discover");
    expect(m.quickStart.some((p) => p.comando.includes("capi schema"))).toBe(true);
    expect(m.quickStart.some((p) => p.comando.includes("capi doctor"))).toBe(true);
    expect(m.quickStart.some((p) => p.comando.includes("capi chat"))).toBe(true);
  });

  test("discover incluye tabla de errores con recovery accionable", () => {
    const m = obtenerManifestAgente();
    expect(m.errorTable.length).toBeGreaterThan(10);
    for (const err of m.errorTable) {
      expect(err.code).toMatch(/^[A-Z_]+$/);
      expect(err.recovery.length).toBeGreaterThan(5);
    }
  });

  test("schema de chat.send incluye output.enum con markdown", () => {
    const m = obtenerManifestAgente();
    const chatSend = m.commands.find((c) => c.name === "chat.send");
    expect(chatSend).toBeDefined();
    expect(chatSend!.inputSchema.properties.output.enum).toContain("markdown");
    expect(chatSend!.inputSchema.properties.output.default).toBe("markdown");
  });

  test("cada comando del manifest tiene description clara para un agente", () => {
    const m = obtenerManifestAgente();
    for (const cmd of m.commands) {
      expect(cmd.description.length).toBeGreaterThan(10);
      expect(cmd.behavior).toBeDefined();
      expect(typeof cmd.behavior.nonInteractive).toBe("boolean");
    }
  });
});

describe("Agent-friendliness: sin ANSI en salidas estructuradas", () => {
  test("serializarSalida json y markdown no contienen secuencias ANSI", () => {
    const sobre = crearSobreExito("doctor", { status: "ok" });
    for (const fmt of ["json", "markdown"] as const) {
      const salida = serializarSalida(sobre, fmt);
      expect(salida).not.toMatch(/\u001b\[[0-9;]*m/);
    }
  });
});
