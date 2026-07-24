import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ProyectoDetectado } from "../../nucleo/proyectos/Proyecto";

export interface ConversacionRegistrada {
  id: string;
  proveedor: string;
  proyectoLocalId: string;
  proyectoLogicoId?: string | null;
  titulo?: string;
  modelo?: string;
  usadaEn: number;
  favorita: boolean;
  archivada: boolean;
  principal: boolean;
  ocupada: boolean;
  rutaOrigen?: string;
}

export class RepositorioContextoSqlite {
  private readonly db: Database;

  constructor(ruta: string) {
    mkdirSync(dirname(ruta), { recursive: true });
    this.db = new Database(ruta, { create: true });
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.migrar();
  }

  private migrar(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proyectos_locales (
        id TEXT PRIMARY KEY, ruta_raiz TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
        tipo_deteccion TEXT NOT NULL, usado_en INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS proyectos_logicos (
        id TEXT PRIMARY KEY, alias TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS vinculos_proyecto (
        proyecto_local_id TEXT PRIMARY KEY REFERENCES proyectos_locales(id) ON DELETE CASCADE,
        proyecto_logico_id TEXT NOT NULL REFERENCES proyectos_logicos(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS conversaciones (
        id TEXT NOT NULL, proveedor TEXT NOT NULL, proyecto_local_id TEXT NOT NULL REFERENCES proyectos_locales(id),
        titulo TEXT, modelo TEXT, usada_en INTEGER NOT NULL, favorita INTEGER NOT NULL DEFAULT 0,
        archivada INTEGER NOT NULL DEFAULT 0, principal INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (id, proveedor)
      );
      CREATE TABLE IF NOT EXISTS ocupaciones (
        conversacion_id TEXT NOT NULL, proveedor TEXT NOT NULL, proceso_id TEXT NOT NULL,
        pid INTEGER NOT NULL, adquirida_en INTEGER NOT NULL, expira_en INTEGER NOT NULL,
        PRIMARY KEY (conversacion_id, proveedor)
      );
      CREATE TABLE IF NOT EXISTS ejecuciones (
        proceso_id TEXT PRIMARY KEY, pid INTEGER NOT NULL, adquirida_en INTEGER NOT NULL, expira_en INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preferencias_proyecto (
        proyecto_local_id TEXT PRIMARY KEY REFERENCES proyectos_locales(id) ON DELETE CASCADE,
        proveedor TEXT, modelo TEXT, razonamiento INTEGER, busqueda_web INTEGER
      );
      PRAGMA user_version=3;
    `);
  }

  registrarProyecto(proyecto: ProyectoDetectado, ahora = Date.now()): void {
    this.db.query(`INSERT INTO proyectos_locales(id,ruta_raiz,nombre,tipo_deteccion,usado_en)
      VALUES($id,$ruta,$nombre,$tipo,$ahora)
      ON CONFLICT(id) DO UPDATE SET ruta_raiz=excluded.ruta_raiz,nombre=excluded.nombre,tipo_deteccion=excluded.tipo_deteccion,usado_en=excluded.usado_en`)
      .run({ $id: proyecto.id, $ruta: proyecto.rutaRaiz, $nombre: proyecto.nombre, $tipo: proyecto.tipoDeteccion, $ahora: ahora });
  }

  vincularProyecto(proyectoLocalId: string, alias: string): void {
    const id = Bun.hash(alias.trim().toLowerCase()).toString(16);
    this.db.transaction(() => {
      this.db.query("INSERT INTO proyectos_logicos(id,alias) VALUES(?,?) ON CONFLICT(alias) DO NOTHING").run(id, alias);
      const fila = this.db.query("SELECT id FROM proyectos_logicos WHERE alias=?").get(alias) as { id: string };
      this.db.query("INSERT INTO vinculos_proyecto(proyecto_local_id,proyecto_logico_id) VALUES(?,?) ON CONFLICT(proyecto_local_id) DO UPDATE SET proyecto_logico_id=excluded.proyecto_logico_id").run(proyectoLocalId, fila.id);
    })();
  }

  desvincularProyecto(proyectoLocalId: string): void {
    this.db.query("DELETE FROM vinculos_proyecto WHERE proyecto_local_id=?").run(proyectoLocalId);
  }

  registrarConversacion(entrada: { id: string; proveedor: string; proyectoLocalId: string; titulo?: string; modelo?: string }, ahora = Date.now()): void {
    this.db.query(`INSERT INTO conversaciones(id,proveedor,proyecto_local_id,titulo,modelo,usada_en)
      VALUES($id,$proveedor,$proyecto,$titulo,$modelo,$ahora)
      ON CONFLICT(id,proveedor) DO UPDATE SET
      titulo=COALESCE(excluded.titulo,conversaciones.titulo),modelo=COALESCE(excluded.modelo,conversaciones.modelo),usada_en=excluded.usada_en`)
      .run({ $id: entrada.id, $proveedor: entrada.proveedor, $proyecto: entrada.proyectoLocalId, $titulo: entrada.titulo ?? null, $modelo: entrada.modelo ?? null, $ahora: ahora });
  }

  listarConversacionesProyecto(proyectoLocalId: string): ConversacionRegistrada[] {
    return this.db.query(`SELECT c.id,c.proveedor,c.proyecto_local_id AS proyectoLocalId,v.proyecto_logico_id AS proyectoLogicoId,
      c.titulo,c.modelo,c.usada_en AS usadaEn,c.favorita,c.archivada,c.principal,p.ruta_raiz AS rutaOrigen,
      CASE WHEN o.expira_en > $ahora THEN 1 ELSE 0 END AS ocupada
      FROM conversaciones c
      JOIN proyectos_locales p ON p.id=c.proyecto_local_id
      LEFT JOIN vinculos_proyecto v ON v.proyecto_local_id=c.proyecto_local_id
      LEFT JOIN ocupaciones o ON o.conversacion_id=c.id AND o.proveedor=c.proveedor
      WHERE c.proyecto_local_id=$proyecto OR v.proyecto_logico_id=(SELECT proyecto_logico_id FROM vinculos_proyecto WHERE proyecto_local_id=$proyecto)
      ORDER BY CASE WHEN c.proyecto_local_id=$proyecto THEN 0 ELSE 1 END,c.principal DESC,c.usada_en DESC`)
      .all({ $proyecto: proyectoLocalId, $ahora: Date.now() })
      .map((r: any) => ({ ...r, favorita: Boolean(r.favorita), archivada: Boolean(r.archivada), principal: Boolean(r.principal), ocupada: Boolean(r.ocupada) })) as ConversacionRegistrada[];
  }

  actualizarEstado(id: string, proveedor: string, cambios: { favorita?: boolean; archivada?: boolean; principal?: boolean }, proyectoLocalId?: string): void {
    this.db.transaction(() => {
      if (cambios.principal && proyectoLocalId) this.db.query("UPDATE conversaciones SET principal=0 WHERE proyecto_local_id=? AND proveedor=?").run(proyectoLocalId, proveedor);
      const partes: string[] = []; const valores: (string | number)[] = [];
      for (const [k, v] of Object.entries(cambios)) { partes.push(`${k}=?`); valores.push(v ? 1 : 0); }
      if (partes.length) this.db.query(`UPDATE conversaciones SET ${partes.join(",")} WHERE id=? AND proveedor=?`).run(...valores, id, proveedor);
    })();
  }

  adquirirOcupacion(conversacionId: string, procesoId: string, ahora: number, ttlMs: number, proveedor = "qwen", pid = process.pid): boolean {
    return this.db.transaction(() => {
      this.db.query("DELETE FROM ocupaciones WHERE expira_en<=?").run(ahora);
      try {
        this.db.query("INSERT INTO ocupaciones(conversacion_id,proveedor,proceso_id,pid,adquirida_en,expira_en) VALUES(?,?,?,?,?,?)")
          .run(conversacionId, proveedor, procesoId, pid, ahora, ahora + ttlMs);
        return true;
      } catch { return false; }
    })();
  }

  renovarOcupacion(conversacionId: string, procesoId: string, ahora: number, ttlMs: number, proveedor = "qwen"): boolean {
    return this.db.query("UPDATE ocupaciones SET expira_en=? WHERE conversacion_id=? AND proveedor=? AND proceso_id=?")
      .run(ahora + ttlMs, conversacionId, proveedor, procesoId).changes > 0;
  }

  liberarOcupacion(conversacionId: string, procesoId: string, proveedor = "qwen"): void {
    this.db.query("DELETE FROM ocupaciones WHERE conversacion_id=? AND proveedor=? AND proceso_id=?").run(conversacionId, proveedor, procesoId);
  }

  contarOcupacionesActivas(ahora = Date.now()): number {
    return Number((this.db.query("SELECT COUNT(*) AS total FROM ocupaciones WHERE expira_en>?").get(ahora) as { total: number }).total);
  }

  adquirirEjecucion(procesoId: string, ahora: number, ttlMs: number, pid = process.pid, limite = 3): boolean {
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

  renovarEjecucion(procesoId: string, ahora: number, ttlMs: number): boolean {
    return this.db.query("UPDATE ejecuciones SET expira_en=? WHERE proceso_id=?")
      .run(ahora + ttlMs, procesoId).changes > 0;
  }

  liberarEjecucion(procesoId: string): void {
    this.db.query("DELETE FROM ejecuciones WHERE proceso_id=?").run(procesoId);
  }

  contarEjecucionesActivas(ahora = Date.now()): number {
    return Number((this.db.query("SELECT COUNT(*) AS total FROM ejecuciones WHERE expira_en>?").get(ahora) as { total: number }).total);
  }

  guardarPreferencias(proyectoLocalId: string, preferencias: { proveedor?: string; modelo?: string; razonamiento?: boolean; busquedaWeb?: boolean }): void {
    const actual = this.obtenerPreferencias(proyectoLocalId) ?? {};
    const final = { ...actual, ...preferencias };
    this.db.query(`INSERT INTO preferencias_proyecto(proyecto_local_id,proveedor,modelo,razonamiento,busqueda_web)
      VALUES($proyecto,$proveedor,$modelo,$razonamiento,$busqueda)
      ON CONFLICT(proyecto_local_id) DO UPDATE SET proveedor=excluded.proveedor,modelo=excluded.modelo,
      razonamiento=excluded.razonamiento,busqueda_web=excluded.busqueda_web`)
      .run({
        $proyecto: proyectoLocalId,
        $proveedor: final.proveedor ?? null,
        $modelo: final.modelo ?? null,
        $razonamiento: final.razonamiento == null ? null : final.razonamiento ? 1 : 0,
        $busqueda: final.busquedaWeb == null ? null : final.busquedaWeb ? 1 : 0,
      });
  }

  obtenerPreferencias(proyectoLocalId: string): { proveedor?: string; modelo?: string; razonamiento?: boolean; busquedaWeb?: boolean } | null {
    const fila = this.db.query("SELECT proveedor,modelo,razonamiento,busqueda_web AS busquedaWeb FROM preferencias_proyecto WHERE proyecto_local_id=?").get(proyectoLocalId) as any;
    if (!fila) return null;
    return {
      ...(fila.proveedor ? { proveedor: String(fila.proveedor) } : {}),
      ...(fila.modelo ? { modelo: String(fila.modelo) } : {}),
      ...(fila.razonamiento == null ? {} : { razonamiento: Boolean(fila.razonamiento) }),
      ...(fila.busquedaWeb == null ? {} : { busquedaWeb: Boolean(fila.busquedaWeb) }),
    };
  }

  diagnosticar(): { disponible: boolean; esquema: number; ocupacionesActivas: number } {
    const integridad = this.db.query("PRAGMA quick_check").get() as Record<string, string>;
    return { disponible: Object.values(integridad)[0] === "ok", esquema: 3, ocupacionesActivas: this.contarOcupacionesActivas() + this.contarEjecucionesActivas() };
  }
  cerrar(): void { this.db.close(); }
}
