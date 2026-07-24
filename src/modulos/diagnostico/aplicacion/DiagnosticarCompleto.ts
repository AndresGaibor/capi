import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
import type { GestorContextoProyecto } from "../../conversaciones/aplicacion/GestorContextoProyecto";
import type { RepositorioContextoSqlite } from "../../../plataforma/persistencia/RepositorioContextoSqlite";

export interface ResultadoDiagnosticoCompleto {
  proyecto: { ok: boolean; nombre?: string; ruta?: string; error?: string };
  persistencia: { ok: boolean; esquema?: number; ocupacionesActivas?: number; error?: string };
  proveedores: Array<{ proveedor: string; ok: boolean; detalle?: Record<string, unknown>; error?: string }>;
}

export class DiagnosticarCompleto {
  constructor(
    private readonly proveedores: RegistroProveedores,
    private readonly gestor: GestorContextoProyecto,
    private readonly repositorio: RepositorioContextoSqlite,
  ) {}

  async ejecutar(): Promise<ResultadoDiagnosticoCompleto> {
    let proyecto: ResultadoDiagnosticoCompleto["proyecto"];
    try {
      const actual = this.gestor.proyectoActual();
      proyecto = { ok: true, nombre: actual.nombre, ruta: actual.rutaRaiz };
    } catch (error) { proyecto = { ok: false, error: String(error) }; }

    let persistencia: ResultadoDiagnosticoCompleto["persistencia"];
    try {
      const estado = this.repositorio.diagnosticar();
      persistencia = { ok: estado.disponible, esquema: estado.esquema, ocupacionesActivas: estado.ocupacionesActivas };
    } catch (error) { persistencia = { ok: false, error: String(error) }; }

    const resultados = [];
    for (const id of ["qwen", "deepseek"]) {
      try {
        const proveedor = this.proveedores.obtener(id);
        await proveedor.verificarDisponibilidad();
        const detalle = await proveedor.diagnosticarPagina?.();
        resultados.push({ proveedor: id, ok: true, detalle });
      } catch (error) { resultados.push({ proveedor: id, ok: false, error: error instanceof Error ? error.message : String(error) }); }
    }
    return { proyecto, persistencia, proveedores: resultados };
  }
}
