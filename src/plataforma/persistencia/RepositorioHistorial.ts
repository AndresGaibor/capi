import { Database } from "bun:sqlite";
import { CifradorLocal } from "../seguridad/CifradorLocal";
import { compactarResumen } from "../../modulos/historial/aplicacion/CompactarResumen";

export class RepositorioHistorial {
  private readonly cifrador = new CifradorLocal();

  constructor(private readonly db: Database) {}

  obtenerHashesContexto(proyectoLocalId: string, proveedor: string, conversacionId: string): Record<string, string> {
    const filas = this.db.query("SELECT ruta,hash FROM snapshots_contexto WHERE proyecto_local_id=? AND proveedor=? AND conversacion_id=?")
      .all(proyectoLocalId, proveedor, conversacionId) as Array<{ ruta: string; hash: string }>;
    return Object.fromEntries(filas.map(f => [f.ruta, f.hash]));
  }

  guardarSnapshot(proyectoLocalId: string, proveedor: string, conversacionId: string, archivos: Array<{ ruta: string; hash: string }>, ahora = Date.now()): void {
    const consulta = this.db.query(`INSERT INTO snapshots_contexto(proyecto_local_id,proveedor,conversacion_id,ruta,hash,enviado_en)
      VALUES(?,?,?,?,?,?) ON CONFLICT(proyecto_local_id,proveedor,conversacion_id,ruta)
      DO UPDATE SET hash=excluded.hash,enviado_en=excluded.enviado_en`);
    this.db.transaction(() => { for (const archivo of archivos) consulta.run(proyectoLocalId, proveedor, conversacionId, archivo.ruta, archivo.hash, ahora); })();
  }

  iniciar(entrada: { id: string; proyectoLocalId: string; proveedor: string; modelo?: string; conversacionId?: string; rama?: string; commitGit?: string; contextoHash?: string; archivos?: string[] }, ahora = Date.now()): void {
    this.db.query(`INSERT INTO ejecuciones_historial(id,proyecto_local_id,proveedor,modelo,conversacion_id,rama,commit_git,iniciado_en,estado,contexto_hash,archivos_json)
      VALUES($id,$proyecto,$proveedor,$modelo,$conversacion,$rama,$commit,$inicio,'en_progreso',$contexto,$archivos)`).run({
      $id: entrada.id, $proyecto: entrada.proyectoLocalId, $proveedor: entrada.proveedor, $modelo: entrada.modelo ?? null,
      $conversacion: entrada.conversacionId ?? null, $rama: entrada.rama ?? null, $commit: entrada.commitGit ?? null,
      $inicio: ahora, $contexto: entrada.contextoHash ?? null, $archivos: JSON.stringify(entrada.archivos ?? []),
    });
  }

  finalizar(id: string, entrada: { estado: "completada" | "pausada" | "cancelada" | "fallida"; conversacionId?: string; modelo?: string; contextoHash?: string; archivos?: string[]; respuestaCaracteres?: number; error?: string }, ahora = Date.now()): void {
    this.db.query(`UPDATE ejecuciones_historial SET finalizado_en=$fin,estado=$estado,
      conversacion_id=COALESCE($conversacion,conversacion_id),modelo=COALESCE($modelo,modelo),
      contexto_hash=COALESCE($contexto,contexto_hash),archivos_json=COALESCE($archivos,archivos_json),
      respuesta_caracteres=$caracteres,error=$error WHERE id=$id`).run({
      $id: id, $fin: ahora, $estado: entrada.estado, $conversacion: entrada.conversacionId ?? null,
      $modelo: entrada.modelo ?? null, $contexto: entrada.contextoHash ?? null,
      $archivos: entrada.archivos ? JSON.stringify(entrada.archivos) : null,
      $caracteres: entrada.respuestaCaracteres ?? 0, $error: entrada.error?.slice(0, 2000) ?? null,
    });
  }

  listar(proyectoLocalId: string, limite = 20): any[] {
    return (this.db.query(`SELECT id,proveedor,modelo,conversacion_id AS conversacionId,rama,commit_git AS commitGit,
      iniciado_en AS iniciadoEn,finalizado_en AS finalizadoEn,estado,contexto_hash AS contextoHash,
      archivos_json AS archivosJson,respuesta_caracteres AS respuestaCaracteres,error
      FROM ejecuciones_historial WHERE proyecto_local_id=? ORDER BY iniciado_en DESC LIMIT ?`).all(proyectoLocalId, limite) as any[])
      .map(f => ({ ...f, archivos: JSON.parse(f.archivosJson || "[]"), archivosJson: undefined }));
  }

  guardarResumen(proyectoLocalId: string, proveedor: string, conversacionId: string, resumen: string, ahora = Date.now()): void {
    const protegido = this.cifrador.cifrar(compactarResumen(resumen, 12000));
    this.db.query(`INSERT INTO resumenes_conversacion(proyecto_local_id,proveedor,conversacion_id,resumen,actualizado_en)
      VALUES(?,?,?,?,?) ON CONFLICT(proyecto_local_id,proveedor,conversacion_id)
      DO UPDATE SET resumen=excluded.resumen,actualizado_en=excluded.actualizado_en`).run(proyectoLocalId, proveedor, conversacionId, protegido, ahora);
  }

  obtenerResumen(proyectoLocalId: string, proveedor: string, conversacionId: string): string | null {
    const fila = this.db.query("SELECT resumen FROM resumenes_conversacion WHERE proyecto_local_id=? AND proveedor=? AND conversacion_id=?")
      .get(proyectoLocalId, proveedor, conversacionId) as { resumen: string } | null;
    return fila?.resumen ? this.cifrador.descifrar(fila.resumen) : null;
  }
}
