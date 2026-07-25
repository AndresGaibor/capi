import { Database } from "bun:sqlite";

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

export class RepositorioConversaciones {
  constructor(private readonly db: Database) {}

  registrar(entrada: { id: string; proveedor: string; proyectoLocalId: string; titulo?: string; modelo?: string }, ahora = Date.now()): void {
    this.db.query(`INSERT INTO conversaciones(id,proveedor,proyecto_local_id,titulo,modelo,usada_en)
      VALUES($id,$proveedor,$proyecto,$titulo,$modelo,$ahora)
      ON CONFLICT(id,proveedor) DO UPDATE SET
      titulo=COALESCE(excluded.titulo,conversaciones.titulo),modelo=COALESCE(excluded.modelo,conversaciones.modelo),usada_en=excluded.usada_en`)
      .run({ $id: entrada.id, $proveedor: entrada.proveedor, $proyecto: entrada.proyectoLocalId, $titulo: entrada.titulo ?? null, $modelo: entrada.modelo ?? null, $ahora: ahora });
  }

  listarProyecto(proyectoLocalId: string): ConversacionRegistrada[] {
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
}
