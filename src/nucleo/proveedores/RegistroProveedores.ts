import { ErrorProveedorNoEncontrado } from "../errores/ErroresAplicacion";
import type { ProveedorChat } from "./ProveedorChat";

export class RegistroProveedores {
  private readonly proveedores = new Map<string, ProveedorChat>();
  registrar(proveedor: ProveedorChat): void { this.proveedores.set(proveedor.id.toLowerCase(), proveedor); }
  obtener(id: string): ProveedorChat {
    const proveedor = this.proveedores.get(id.toLowerCase());
    if (!proveedor) throw new ErrorProveedorNoEncontrado(id);
    return proveedor;
  }
  listar(): ProveedorChat[] { return [...this.proveedores.values()]; }
}
