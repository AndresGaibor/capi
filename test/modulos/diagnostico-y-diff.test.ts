import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiagnosticarCompleto } from "../../src/modulos/diagnostico/aplicacion/DiagnosticarCompleto";
import { VerificarContratosProveedor } from "../../src/modulos/diagnostico/aplicacion/VerificarContratosProveedor";
import { obtenerDiffGit } from "../../src/modulos/contexto/aplicacion/ObtenerDiffGit";
import { QwenConversaciones } from "../../src/proveedores/qwen/navegador/QwenConversaciones";

test("diagnóstico completo combina proyecto, persistencia y estado de proveedores", async () => {
  const proveedores: any = {
    obtener(id: string) {
      if (id === "deepseek") throw new Error("no registrado");
      return {
        verificarDisponibilidad: async () => {
          if (id === "chatgpt") throw new Error("sesión vencida");
        },
        diagnosticarPagina: async () => ({ proveedor: id, ok: true }),
      };
    },
  };
  const gestor: any = { proyectoActual: () => ({ nombre: "CAPI", rutaRaiz: "/tmp/capi" }) };
  const repositorio: any = { diagnosticar: () => ({ disponible: true, esquema: 9, ocupacionesActivas: 2 }) };

  const resultado = await new DiagnosticarCompleto(proveedores, gestor, repositorio).ejecutar();

  expect(resultado.proyecto).toEqual({ ok: true, nombre: "CAPI", ruta: "/tmp/capi" });
  expect(resultado.persistencia).toEqual({ ok: true, esquema: 9, ocupacionesActivas: 2 });
  expect(resultado.proveedores).toEqual([
    { proveedor: "qwen", ok: true, detalle: { proveedor: "qwen", ok: true } },
    { proveedor: "deepseek", ok: false, error: "no registrado" },
    { proveedor: "chatgpt", ok: false, error: "sesión vencida" },
  ]);
});

test("diagnóstico completo conserva fallos de proyecto y persistencia", async () => {
  const proveedores: any = { obtener: () => ({ verificarDisponibilidad: async () => {}, diagnosticarPagina: async () => undefined }) };
  const gestor: any = { proyectoActual: () => { throw new Error("sin proyecto"); } };
  const repositorio: any = { diagnosticar: () => { throw new Error("sqlite cerrado"); } };

  const resultado = await new DiagnosticarCompleto(proveedores, gestor, repositorio).ejecutar();

  expect(resultado.proyecto.ok).toBeFalse();
  expect(resultado.proyecto.error).toContain("sin proyecto");
  expect(resultado.persistencia.ok).toBeFalse();
  expect(resultado.persistencia.error).toContain("sqlite cerrado");
  expect(resultado.proveedores.every((item) => item.ok)).toBeTrue();
});

test("verificación contractual distingue modelos vacíos y proveedor caído", async () => {
  const registro: any = {
    listar: () => [
      { id: "qwen", capacidades: { listarModelos: true }, verificarDisponibilidad: async () => {}, listarModelos: async () => [{ id: "max" }] },
      { id: "deepseek", capacidades: { listarModelos: true }, verificarDisponibilidad: async () => {}, listarModelos: async () => [] },
      { id: "chatgpt", capacidades: { listarModelos: false }, verificarDisponibilidad: async () => { throw new Error("offline"); } },
    ],
  };

  const resultado = await new VerificarContratosProveedor(registro).ejecutar();

  expect(resultado.ok).toBeFalse();
  expect(resultado.resultados).toEqual([
    { proveedor: "qwen", disponible: true, modelos: true },
    { proveedor: "deepseek", disponible: true, modelos: false },
    { proveedor: "chatgpt", disponible: false, modelos: false, error: "offline" },
  ]);
  expect(resultado.verificadoEn).toBeNumber();
});

test("obtiene diff staged y unstaged de un repositorio real", () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-diff-"));
  Bun.spawnSync(["git", "init", "-q", dir]);
  Bun.spawnSync(["git", "-C", dir, "config", "user.email", "test@example.com"]);
  Bun.spawnSync(["git", "-C", dir, "config", "user.name", "Test"]);
  const archivo = join(dir, "dato.txt");
  writeFileSync(archivo, "base\n");
  Bun.spawnSync(["git", "-C", dir, "add", "dato.txt"]);
  Bun.spawnSync(["git", "-C", dir, "commit", "-qm", "base"]);
  writeFileSync(archivo, "staged\n");
  Bun.spawnSync(["git", "-C", dir, "add", "dato.txt"]);
  writeFileSync(archivo, "unstaged\n");

  const diff = obtenerDiffGit(dir);

  expect(diff).toContain("# GIT DIFF --CACHED");
  expect(diff).toContain("# GIT DIFF");
  expect(diff).toContain("staged");
  expect(diff).toContain("unstaged");
  expect(obtenerDiffGit(join(dir, "inexistente"))).toBe("");
});

test("Qwen aplana secciones y normaliza títulos vacíos", async () => {
  const transporte: any = {
    evaluar: async () => ({ value: [
      { titulo: "Hoy", items: [{ id: "1", text: "Chat uno" }, { id: "2", text: "" }] },
      { titulo: "Ayer", items: [{ id: "3", text: "Chat tres" }] },
    ] }),
  };
  const conversaciones = await new QwenConversaciones(transporte).listar();
  expect(conversaciones).toEqual([
    { id: "1", titulo: "Chat uno", seccion: "Hoy" },
    { id: "2", titulo: "Sin título", seccion: "Hoy" },
    { id: "3", titulo: "Chat tres", seccion: "Ayer" },
  ]);
  expect(await new QwenConversaciones({ evaluar: async () => ({ value: undefined }) } as any).listar()).toEqual([]);
});
