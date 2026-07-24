import { describe, expect, test } from "bun:test";
import { RegistroProveedores } from "../../src/nucleo/proveedores/RegistroProveedores";
import { ListarModelos } from "../../src/modulos/modelos/aplicacion/ListarModelos";
import { ErrorCapacidadNoSoportada } from "../../src/nucleo/errores/ErroresAplicacion";
import type { ProveedorChat } from "../../src/nucleo/proveedores/ProveedorChat";

function crearProveedor(partial: Partial<ProveedorChat>): ProveedorChat {
  return {
    id: "fake",
    capacidades: { cambioModelo: false, listarModelos: false, conversaciones: false, mensajes: false, sesion: false, archivos: false, razonamiento: false, busquedaWeb: false },
    verificarDisponibilidad: async () => {},
    async *enviarMensaje() {},
    ...partial,
  } as ProveedorChat;
}

describe("casos de uso neutrales", () => {
  test("lista modelos por contrato", async () => {
    const registro = new RegistroProveedores();
    registro.registrar(crearProveedor({ capacidades: { cambioModelo: true, listarModelos: true, conversaciones: false, mensajes: false, sesion: false, archivos: false, razonamiento: false, busquedaWeb: false }, listarModelos: async () => [{ id: "uno", nombre: "Uno" }] }));
    expect(await new ListarModelos(registro).ejecutar("fake")).toEqual([{ id: "uno", nombre: "Uno" }]);
  });
  test("rechaza una capacidad ausente", async () => {
    const registro = new RegistroProveedores();
    registro.registrar(crearProveedor({}));
    expect(new ListarModelos(registro).ejecutar("fake")).rejects.toBeInstanceOf(ErrorCapacidadNoSoportada);
  });
});
