import { ErrorCapacidadNoSoportada } from "../../../nucleo/errores/ErroresAplicacion";
import type { ConversacionChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
export class ObtenerMensajes {
  constructor(private readonly proveedores: RegistroProveedores) {}
  async ejecutar(proveedorId: string, conversacionId: string): Promise<ConversacionChat | null> {
    const proveedor = this.proveedores.obtener(proveedorId);
    if (!proveedor.capacidades.mensajes || !proveedor.obtenerMensajes) throw new ErrorCapacidadNoSoportada(proveedorId, "obtener mensajes");
    return proveedor.obtenerMensajes(conversacionId);
  }
}
