import { Database } from "bun:sqlite";
import type { ProyectoDetectado } from "../../nucleo/proyectos/Proyecto";

export class RepositorioProyectos {
  constructor(private readonly db: Database) {}

  registrar(proyecto: ProyectoDetectado, ahora = Date.now()): void {
    this.db.query(`INSERT INTO proyectos_locales(id,ruta_raiz,nombre,tipo_deteccion,usado_en)
      VALUES($id,$ruta,$nombre,$tipo,$ahora)
      ON CONFLICT(id) DO UPDATE SET ruta_raiz=excluded.ruta_raiz,nombre=excluded.nombre,tipo_deteccion=excluded.tipo_deteccion,usado_en=excluded.usado_en`)
      .run({ $id: proyecto.id, $ruta: proyecto.rutaRaiz, $nombre: proyecto.nombre, $tipo: proyecto.tipoDeteccion, $ahora: ahora });
  }

  vincular(proyectoLocalId: string, alias: string): void {
    const id = Bun.hash(alias.trim().toLowerCase()).toString(16);
    this.db.transaction(() => {
      this.db.query("INSERT INTO proyectos_logicos(id,alias) VALUES(?,?) ON CONFLICT(alias) DO NOTHING").run(id, alias);
      const fila = this.db.query("SELECT id FROM proyectos_logicos WHERE alias=?").get(alias) as { id: string };
      this.db.query("INSERT INTO vinculos_proyecto(proyecto_local_id,proyecto_logico_id) VALUES(?,?) ON CONFLICT(proyecto_local_id) DO UPDATE SET proyecto_logico_id=excluded.proyecto_logico_id").run(proyectoLocalId, fila.id);
    })();
  }

  desvincular(proyectoLocalId: string): void {
    this.db.query("DELETE FROM vinculos_proyecto WHERE proyecto_local_id=?").run(proyectoLocalId);
  }
}
