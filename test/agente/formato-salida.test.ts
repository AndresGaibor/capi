import { expect, test } from "bun:test";
import { crearSobreExito, crearSobreError, serializarSalida, codigoSalidaParaError } from "../../src/entradas/cli/agente/FormatoSalida";

test("crea un sobre JSON estable de éxito", () => {
  expect(crearSobreExito("project.current", { nombre: "capi" }, { requestId: "r1" })).toEqual({
    protocol: "capi.agent.v1", ok: true, command: "project.current", requestId: "r1", data: { nombre: "capi" }, suggestions: [],
  });
});

test("crea un sobre de error recuperable con acciones", () => {
  const error = Object.assign(new Error("alta demanda"), { codigo: "ALTA_DEMANDA", retryable: true });
  const sobre = crearSobreError("chat.send", error, { requestId: "r2", suggestions: [{ command: "capi chat -p deepseek", reason: "alternativa" }] });
  expect(sobre.ok).toBeFalse();
  expect(sobre.error?.code).toBe("ALTA_DEMANDA");
  expect(sobre.error?.retryable).toBeTrue();
  expect(codigoSalidaParaError(sobre.error?.code)).toBe(20);
});

test("serializa markdown y json sin ANSI", () => {
  const sobre = crearSobreExito("doctor", { estado: "ok" }, { requestId: "r" });
  expect(serializarSalida(sobre, "json")).toContain('"protocol":"capi.agent.v1"');
  expect(serializarSalida(sobre, "markdown")).toContain("# CAPI: doctor");
  expect(serializarSalida(sobre, "markdown")).not.toContain("\u001b");
});
