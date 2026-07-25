import { Database } from "bun:sqlite";

export class RepositorioEjecuciones {
  constructor(private readonly db: Database) {}

  adquirir(procesoId: string, ahora: number, ttlMs: number, pid = process.pid, limite = 3): boolean {
    return this.db.transaction(() => {
      this.db.query("DELETE FROM ejecuciones WHERE expira_en<=?").run(ahora);
      const total = Number((this.db.query("SELECT COUNT(*) AS total FROM ejecuciones").get() as { total: number }).total);
      if (total >= limite) return false;
      try {
        this.db.query("INSERT INTO ejecuciones(proceso_id,pid,adquirida_en,expira_en) VALUES(?,?,?,?)")
          .run(procesoId, pid, ahora, ahora + ttlMs);
        return true;
      } catch { return false; }
    })();
  }

  renovar(procesoId: string, ahora: number, ttlMs: number): boolean {
    return this.db.query("UPDATE ejecuciones SET expira_en=? WHERE proceso_id=?")
      .run(ahora + ttlMs, procesoId).changes > 0;
  }

  liberar(procesoId: string): void {
    this.db.query("DELETE FROM ejecuciones WHERE proceso_id=?").run(procesoId);
  }

  contarActivas(ahora = Date.now()): number {
    return Number((this.db.query("SELECT COUNT(*) AS total FROM ejecuciones WHERE expira_en>?").get(ahora) as { total: number }).total);
  }
}
