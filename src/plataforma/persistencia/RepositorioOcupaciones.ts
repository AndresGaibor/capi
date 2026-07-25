import { Database } from "bun:sqlite";

export class RepositorioOcupaciones {
  constructor(private readonly db: Database) {}

  adquirir(conversacionId: string, procesoId: string, ahora: number, ttlMs: number, proveedor = "qwen", pid = process.pid): boolean {
    return this.db.transaction(() => {
      this.db.query("DELETE FROM ocupaciones WHERE expira_en<=?").run(ahora);
      try {
        this.db.query("INSERT INTO ocupaciones(conversacion_id,proveedor,proceso_id,pid,adquirida_en,expira_en) VALUES(?,?,?,?,?,?)")
          .run(conversacionId, proveedor, procesoId, pid, ahora, ahora + ttlMs);
        return true;
      } catch { return false; }
    })();
  }

  renovar(conversacionId: string, procesoId: string, ahora: number, ttlMs: number, proveedor = "qwen"): boolean {
    return this.db.query("UPDATE ocupaciones SET expira_en=? WHERE conversacion_id=? AND proveedor=? AND proceso_id=?")
      .run(ahora + ttlMs, conversacionId, proveedor, procesoId).changes > 0;
  }

  liberar(conversacionId: string, procesoId: string, proveedor = "qwen"): void {
    this.db.query("DELETE FROM ocupaciones WHERE conversacion_id=? AND proveedor=? AND proceso_id=?").run(conversacionId, proveedor, procesoId);
  }

  contarActivas(ahora = Date.now()): number {
    return Number((this.db.query("SELECT COUNT(*) AS total FROM ocupaciones WHERE expira_en>?").get(ahora) as { total: number }).total);
  }

  limpiar(ahora = Date.now()): number {
    return this.db.query("DELETE FROM ocupaciones WHERE expira_en<=?").run(ahora).changes;
  }
}
