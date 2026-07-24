import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";

export class VerificarContratosProveedor {
  constructor(private readonly proveedores: RegistroProveedores) {}
  async ejecutar() {
    const resultados: Array<{ proveedor: string; disponible: boolean; modelos: boolean; error?: string }> = [];
    for (const proveedor of this.proveedores.listar()) {
      try {
        await proveedor.verificarDisponibilidad();
        const modelos = proveedor.capacidades.listarModelos ? (await proveedor.listarModelos!()).length > 0 : true;
        resultados.push({ proveedor: proveedor.id, disponible: true, modelos });
      } catch (error) {
        resultados.push({ proveedor: proveedor.id, disponible: false, modelos: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { ok: resultados.every(r => r.disponible && r.modelos), resultados, verificadoEn: Date.now() };
  }
}
