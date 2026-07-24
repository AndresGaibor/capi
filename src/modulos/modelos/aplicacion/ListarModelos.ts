import { ErrorCapacidadNoSoportada } from "../../../nucleo/errores/ErroresAplicacion";
import type { ModeloChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
export class ListarModelos {
  constructor(private readonly proveedores: RegistroProveedores) {}
  async ejecutar(id: string): Promise<ModeloChat[]> {
    const proveedor = this.proveedores.obtener(id);
    if (!proveedor.capacidades.listarModelos || !proveedor.listarModelos) throw new ErrorCapacidadNoSoportada(id, "listar modelos");
    await proveedor.verificarDisponibilidad();
    return proveedor.listarModelos();
  }
}
