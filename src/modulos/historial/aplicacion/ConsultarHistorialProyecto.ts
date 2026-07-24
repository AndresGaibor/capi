import type { RepositorioContextoSqlite } from "../../../plataforma/persistencia/RepositorioContextoSqlite";
import type { GestorContextoProyecto } from "../../conversaciones/aplicacion/GestorContextoProyecto";

export class ConsultarHistorialProyecto {
  constructor(private readonly repositorio: RepositorioContextoSqlite, private readonly gestor: GestorContextoProyecto) {}
  ejecutar(limite = 20) {
    const proyecto = this.gestor.proyectoActual();
    return { proyecto, ejecuciones: this.repositorio.listarHistorialProyecto(proyecto.id, Math.max(1, Math.min(200, limite))) };
  }
}
