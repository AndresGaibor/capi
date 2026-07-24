import type { ProyectoDetectado } from "../../../nucleo/proyectos/Proyecto";
import type { RepositorioContextoSqlite } from "../../../plataforma/persistencia/RepositorioContextoSqlite";
import { seleccionarConversacion, type ResultadoSeleccion } from "./SeleccionarConversacion";

export class GestorContextoProyecto {
  constructor(
    private readonly repositorio: RepositorioContextoSqlite,
    private readonly detectarProyecto: () => ProyectoDetectado,
    private readonly ahora: () => number = Date.now,
  ) {}

  proyectoActual(): ProyectoDetectado {
    const proyecto = this.detectarProyecto();
    this.repositorio.registrarProyecto(proyecto, this.ahora());
    return proyecto;
  }

  seleccionar(proveedor: string, conversacionExplicita?: string): { proyecto: ProyectoDetectado; seleccion: ResultadoSeleccion } {
    const proyecto = this.proyectoActual();
    const candidatas = this.repositorio.listarConversacionesProyecto(proyecto.id);
    const seleccion = seleccionarConversacion({
      ahora: this.ahora(),
      umbralMs: 12 * 60 * 60 * 1000,
      proveedor,
      proyectoLocalId: proyecto.id,
      conversacionExplicita,
      candidatas,
    });
    return { proyecto, seleccion };
  }
}
