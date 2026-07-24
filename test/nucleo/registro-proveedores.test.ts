import { describe, expect, test } from "bun:test";
import { RegistroProveedores } from "../../src/nucleo/proveedores/RegistroProveedores";
import { ErrorProveedorNoEncontrado } from "../../src/nucleo/errores/ErroresAplicacion";
import type { ProveedorChat } from "../../src/nucleo/proveedores/ProveedorChat";

const proveedor = { id: "qwen", capacidades: {} } as ProveedorChat;
describe("RegistroProveedores", () => {
  test("registra y obtiene sin distinguir mayúsculas", () => {
    const registro = new RegistroProveedores();
    registro.registrar(proveedor);
    expect(registro.obtener("QWEN")).toBe(proveedor);
  });
  test("lanza error tipado cuando no existe", () => {
    expect(() => new RegistroProveedores().obtener("otro")).toThrow(ErrorProveedorNoEncontrado);
  });
});
