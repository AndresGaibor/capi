import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { crearMarcadorSmoke, evaluarSmoke, ejecutarSmokeTextoYContinuidad, obtenerConversacionProyectoJson } from "../../scripts/lib/smokeDeterminista";

test("smoke usa marcador único y reporta resultado JSON sin salida hija", () => {
  const marcador = crearMarcadorSmoke("TEXT", () => "a-b-c");
  expect(marcador).toBe("CAPI_TEXT_ABC");
  expect(evaluarSmoke("qwen", marcador, { exitCode: 0, timeout: false, stdout: `respuesta ${marcador}`, stderr: "privado" })).toEqual({ ok: true, proveedor: "qwen", marcador });
});

test("smoke falla determinísticamente si el marcador no aparece", () => {
  expect(() => evaluarSmoke("qwen", "CAPI_TEXT_X", { exitCode: 0, timeout: false, stdout: "otra", stderr: "" })).toThrow("no devolvió el marcador");
});

test("smoke de texto conserva la conversación, la archiva y limpia el proyecto aislado", async () => {
  const llamadas: Array<{ comando: string[]; cwd?: string; env?: Record<string, string> }> = [];
  const resultado = await ejecutarSmokeTextoYContinuidad({
    proveedor: "qwen",
    modelo: "preview",
    marcador: "CAPI_TEXT_UNICO",
    ejecutar: async (comando, _timeout, opciones) => {
      llamadas.push({ comando, cwd: opciones?.cwd, env: opciones?.env });
      if (comando.includes("archivar")) return { exitCode: 0, timeout: false, stdout: "", stderr: "" };
      return {
        exitCode: 0,
        timeout: false,
        stderr: "",
        stdout: comando.includes("--nueva")
          ? `{"event":"conversation.selected","data":{"conversationId":"chat-123"}}\n{"event":"completed","data":{"response":"CAPI_TEXT_UNICO"}}`
          : `{"event":"completed","data":{"response":"CAPI_TEXT_UNICO"}}`,
      };
    },
  });

  expect(resultado).toEqual({ ok: true, proveedor: "qwen", marcador: "CAPI_TEXT_UNICO", conversacionId: "chat-123", archivada: true, limpiado: true });
  expect(llamadas).toHaveLength(3);
  expect(llamadas[0]!.comando).toContain("--output");
  expect(llamadas[0]!.comando).toContain("jsonl");
  expect(llamadas[0]!.comando).not.toContain("--no-busqueda");
  expect(llamadas[0]!.comando).not.toContain("--no-razonamiento");
  expect(llamadas[1]!.comando).toContain("--conversacion");
  expect(llamadas[1]!.comando).toContain("chat-123");
  expect(llamadas[2]!.comando).toContain("archivar");
  expect(llamadas[0]!.env?.CAPI_DATA_DIR).toBeDefined();
  expect(llamadas[0]!.cwd).toBe(llamadas[1]!.cwd);
  expect(existsSync(llamadas[0]!.cwd!)).toBeFalse();
});

test("smoke archiva la conversación aun cuando falla la continuidad", async () => {
  const llamadas: string[][] = [];

  await expect(ejecutarSmokeTextoYContinuidad({
    proveedor: "qwen",
    modelo: "preview",
    marcador: "CAPI_TEXT_X",
    ejecutar: async (comando) => {
      llamadas.push(comando);
      if (comando.includes("archivar")) return { exitCode: 0, timeout: false, stdout: "", stderr: "" };
      if (comando.includes("--conversacion")) return { exitCode: 1, timeout: false, stdout: "", stderr: "falló" };
      return { exitCode: 0, timeout: false, stderr: "", stdout: '{"event":"conversation.selected","data":{"conversationId":"chat-123"}}\nCAPI_TEXT_X' };
    },
  })).rejects.toThrow("no devolvió el marcador");

  expect(llamadas.at(-1)).toContain("archivar");
  expect(llamadas.at(-1)).toContain("chat-123");
});


test("smoke recupera la conversación desde el estado local cuando JSONL no emite selección", () => {
  const salida = JSON.stringify({ data: { conversations: [
    { id: "vieja", proveedor: "deepseek", principal: false, usadaEn: 1 },
    { id: "actual", proveedor: "deepseek", principal: true, usadaEn: 2 },
    { id: "otra", proveedor: "qwen", principal: true, usadaEn: 3 },
  ] } });
  expect(obtenerConversacionProyectoJson(salida, "deepseek")).toBe("actual");
  expect(obtenerConversacionProyectoJson("no-json", "deepseek")).toBeUndefined();
});
