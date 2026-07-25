import type { Database } from "bun:sqlite";

export interface CheckpointChat {
  proyectoLocalId: string;
  proveedor: string;
  conversacionId: string;
  motivo: string;
  pensamiento: string;
  respuesta: string;
  estado: "pausado" | "completado";
  actualizadoEn?: number;
}

/** Persistencia aislada del estado recuperable de un streaming. */
export class RepositorioCheckpointsChat {
  constructor(private readonly db: Database) {}
  guardar(entrada: CheckpointChat, actualizadoEn = Date.now()): void {
    this.db.query(`INSERT INTO checkpoints_chat(proyecto_local_id,proveedor,conversacion_id,motivo,pensamiento,respuesta,estado,actualizado_en) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(proyecto_local_id,proveedor,conversacion_id) DO UPDATE SET motivo=excluded.motivo,pensamiento=excluded.pensamiento,respuesta=excluded.respuesta,estado=excluded.estado,actualizado_en=excluded.actualizado_en`)
      .run(entrada.proyectoLocalId, entrada.proveedor, entrada.conversacionId, entrada.motivo, entrada.pensamiento, entrada.respuesta, entrada.estado, actualizadoEn);
  }
  obtener(proyectoLocalId: string, proveedor: string, conversacionId: string): CheckpointChat | null {
    return (this.db.query(`SELECT proyecto_local_id AS proyectoLocalId,proveedor,conversacion_id AS conversacionId,motivo,pensamiento,respuesta,estado,actualizado_en AS actualizadoEn FROM checkpoints_chat WHERE proyecto_local_id=? AND proveedor=? AND conversacion_id=?`).get(proyectoLocalId, proveedor, conversacionId) as CheckpointChat | null) ?? null;
  }
}
