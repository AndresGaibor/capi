import { ErrorCapacidadNoSoportada } from "../../../nucleo/errores/ErroresAplicacion";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
export class DiagnosticarPagina {
  constructor(private readonly proveedores: RegistroProveedores) {}
  async ejecutar(id: string): Promise<Record<string, unknown>> {
    const proveedor = this.proveedores.obtener(id);
    if (!proveedor.diagnosticarPagina) throw new ErrorCapacidadNoSoportada(id, "diagnosticar página");
    return proveedor.diagnosticarPagina();
  }
}
