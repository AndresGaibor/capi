import { ErrorCapacidadNoSoportada } from "../../../nucleo/errores/ErroresAplicacion";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
export class ImportarSesion {
  constructor(private readonly proveedores: RegistroProveedores) {}
  async ejecutar(id: string): Promise<void> {
    const proveedor = this.proveedores.obtener(id);
    if (!proveedor.capacidades.sesion || !proveedor.importarSesion) throw new ErrorCapacidadNoSoportada(id, "importar sesión");
    await proveedor.importarSesion();
  }
}
