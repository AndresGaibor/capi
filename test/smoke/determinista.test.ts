import { expect, test } from "bun:test";
import { crearMarcadorSmoke, evaluarSmoke } from "../../scripts/lib/smokeDeterminista";

test("smoke usa marcador único y reporta resultado JSON sin salida hija", () => {
  const marcador = crearMarcadorSmoke("TEXT", () => "a-b-c");
  expect(marcador).toBe("CAPI_TEXT_ABC");
  expect(evaluarSmoke("qwen", marcador, { exitCode: 0, timeout: false, stdout: `respuesta ${marcador}`, stderr: "privado" })).toEqual({ ok: true, proveedor: "qwen", marcador });
});

test("smoke falla determinísticamente si el marcador no aparece", () => {
  expect(() => evaluarSmoke("qwen", "CAPI_TEXT_X", { exitCode: 0, timeout: false, stdout: "otra", stderr: "" })).toThrow("no devolvió el marcador");
});
