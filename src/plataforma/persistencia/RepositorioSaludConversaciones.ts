import type { Database } from "bun:sqlite";
import type { EstadoSaludConversacion } from "./RepositorioConversaciones";

/** Cambia salud y principal de una conversación como una única transacción. */
export class RepositorioSaludConversaciones {
  constructor(private readonly db: Database) {}
  marcar(id: string, proveedor: string, estado: EstadoSaludConversacion, motivo?: string, fecha = Date.now()): void {
    this.db.transaction(() => {
      this.db.query("UPDATE conversaciones SET estado_salud=?, motivo_salud=?, fecha_salud=?, principal=CASE WHEN ?='activa' THEN principal ELSE 0 END WHERE id=? AND proveedor=?")
        .run(estado, motivo ?? null, fecha, estado, id, proveedor);
      if (estado !== "activa") {
        const reemplazo = this.db.query("SELECT id FROM conversaciones WHERE proveedor=? AND proyecto_local_id=(SELECT proyecto_local_id FROM conversaciones WHERE id=? AND proveedor=?) AND estado_salud='activa' AND archivada=0 ORDER BY usada_en DESC LIMIT 1")
          .get(proveedor, id, proveedor) as { id?: string } | null;
        if (reemplazo?.id) this.db.query("UPDATE conversaciones SET principal=1 WHERE id=? AND proveedor=?").run(reemplazo.id, proveedor);
      }
    })();
  }
}
