import { Database } from "bun:sqlite";
import { CifradorLocal } from "../seguridad/CifradorLocal";
import { compactarResumen } from "../../modulos/historial/aplicacion/CompactarResumen";

type CapaProyecto = "cache" | "snapshots" | "historial" | "resumenes";

const TABLAS_POR_CAPA: Record<CapaProyecto, string> = {
  cache: "cache_adjuntos",
  snapshots: "snapshots_contexto",
  historial: "ejecuciones_historial",
  resumenes: "resumenes_conversacion",
};

export class RepositorioCache {
  private readonly cifrador = new CifradorLocal();

  constructor(private readonly db: Database) {}

  registrarAdjuntosConfirmados(
    proyectoLocalId: string,
    proveedor: string,
    conversacionId: string,
    archivos: Array<{ hash: string; ruta: string }>,
    ahora = Date.now(),
  ): void {
    const q = this.db.query(
      `INSERT INTO cache_adjuntos(proyecto_local_id,proveedor,conversacion_id,hash,ruta,confirmado_en) VALUES(?,?,?,?,?,?) ON CONFLICT DO UPDATE SET ruta=excluded.ruta,confirmado_en=excluded.confirmado_en`,
    );
    this.db.transaction(() => {
      for (const a of archivos)
        q.run(
          proyectoLocalId,
          proveedor,
          conversacionId,
          a.hash,
          a.ruta,
          ahora,
        );
    })();
  }

  listarHashesAdjuntos(
    proyectoLocalId: string,
    proveedor: string,
    conversacionId: string,
  ): string[] {
    return (
      this.db
        .query(
          "SELECT hash FROM cache_adjuntos WHERE proyecto_local_id=? AND proveedor=? AND conversacion_id=?",
        )
        .all(proyectoLocalId, proveedor, conversacionId) as Array<{
        hash: string;
      }>
    ).map((x) => x.hash);
  }

  obtenerMetricas(proyectoLocalId: string): any {
    const total = this.db
      .query(
        `SELECT COUNT(*) total,SUM(CASE WHEN estado='completada' THEN 1 ELSE 0 END) completadas,SUM(CASE WHEN estado='fallida' THEN 1 ELSE 0 END) fallidas,AVG(CASE WHEN finalizado_en IS NOT NULL THEN finalizado_en-iniciado_en END) duracionPromedioMs,SUM(respuesta_caracteres) caracteres FROM ejecuciones_historial WHERE proyecto_local_id=?`,
      )
      .get(proyectoLocalId) as any;
    const modelos = this.db
      .query(
        `SELECT proveedor,COALESCE(modelo,'default') modelo,COUNT(*) ejecuciones,SUM(CASE WHEN estado='completada' THEN 1 ELSE 0 END) completadas,AVG(CASE WHEN finalizado_en IS NOT NULL THEN finalizado_en-iniciado_en END) duracionPromedioMs FROM ejecuciones_historial WHERE proyecto_local_id=? GROUP BY proveedor,modelo ORDER BY ejecuciones DESC`,
      )
      .all(proyectoLocalId);
    return { ...total, modelos };
  }

  limpiar(proyectoLocalId: string, capas: string[]): Record<string, number> {
    const resultado: Record<string, number> = {};
    this.db.transaction(() => {
      for (const capa of capas) {
        const tabla = this.tablaDeCapa(capa);
        resultado[capa] = this.db
          .query(`DELETE FROM ${tabla} WHERE proyecto_local_id=?`)
          .run(proyectoLocalId).changes;
      }
    })();
    return resultado;
  }

  exportar(proyectoLocalId: string): any {
    const proyecto = this.db
      .query("SELECT * FROM proyectos_locales WHERE id=?")
      .get(proyectoLocalId);
    if (!proyecto) throw new Error("Proyecto no encontrado");
    return {
      formato: "capi.project.v1",
      exportadoEn: Date.now(),
      proyecto,
      conversaciones: this.filasProyecto("conversaciones", proyectoLocalId),
      preferencias: this.filasProyecto(
        "preferencias_proyecto",
        proyectoLocalId,
      ),
      snapshots: this.filasProyecto("snapshots_contexto", proyectoLocalId),
      historial: this.filasProyecto("ejecuciones_historial", proyectoLocalId),
      resumenes: this.filasProyecto(
        "resumenes_conversacion",
        proyectoLocalId,
      ).map((r: any) => ({
        ...r,
        resumen: this.cifrador.descifrar(r.resumen),
      })),
      cacheAdjuntos: this.filasProyecto("cache_adjuntos", proyectoLocalId),
    };
  }

  importar(datos: unknown): { proyectoLocalId: string; filas: number } {
    const d = datos as any;
    if (d?.formato !== "capi.project.v1" || !d.proyecto?.id)
      throw new Error("Formato de exportación inválido");
    let filas = 0;
    this.db.transaction(() => {
      const p = d.proyecto;
      this.db
        .query(
          `INSERT INTO proyectos_locales(id,ruta_raiz,nombre,tipo_deteccion,usado_en) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre,usado_en=excluded.usado_en`,
        )
        .run(p.id, p.ruta_raiz, p.nombre, p.tipo_deteccion, p.usado_en);
      filas++;
      const insertar = (tabla: string, lista: any[]) => {
        for (const r of lista ?? []) {
          const keys = Object.keys(r);
          this.db
            .query(
              `INSERT OR REPLACE INTO ${tabla}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
            )
            .run(
              ...keys.map((k) =>
                tabla === "resumenes_conversacion" && k === "resumen"
                  ? this.cifrador.cifrar(compactarResumen(r[k], 12000))
                  : r[k],
              ),
            );
          filas++;
        }
      };
      insertar("conversaciones", d.conversaciones);
      insertar("preferencias_proyecto", d.preferencias);
      insertar("snapshots_contexto", d.snapshots);
      insertar("ejecuciones_historial", d.historial);
      insertar("resumenes_conversacion", d.resumenes);
      insertar("cache_adjuntos", d.cacheAdjuntos);
    })();
    return { proyectoLocalId: d.proyecto.id, filas };
  }

  private tablaDeCapa(capa: string): string {
    if (!Object.prototype.hasOwnProperty.call(TABLAS_POR_CAPA, capa))
      throw new Error(`Capa no soportada: ${capa}`);
    return TABLAS_POR_CAPA[capa as CapaProyecto];
  }

  private filasProyecto(tabla: string, proyectoLocalId: string): any[] {
    return this.db
      .query(`SELECT * FROM ${tabla} WHERE proyecto_local_id=?`)
      .all(proyectoLocalId) as any[];
  }
}
