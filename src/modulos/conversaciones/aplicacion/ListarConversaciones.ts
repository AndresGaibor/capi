import { ErrorCapacidadNoSoportada } from "../../../nucleo/errores/ErroresAplicacion";
import type { ConversacionResumen } from "../../../nucleo/proveedores/ProveedorChat";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
export class ListarConversaciones {
  constructor(private readonly proveedores: RegistroProveedores) {}
  async ejecutar(id: string): Promise<ConversacionResumen[]> {
    const proveedor = this.proveedores.obtener(id);
    if (!proveedor.capacidades.conversaciones || !proveedor.listarConversaciones) throw new ErrorCapacidadNoSoportada(id, "listar conversaciones");
    return proveedor.listarConversaciones();
  }
}
