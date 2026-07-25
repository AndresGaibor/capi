import { Database } from "bun:sqlite";

export class RepositorioPreferencias {
  constructor(private readonly db: Database) {}

  guardar(proyectoLocalId: string, preferencias: { proveedor?: string; modelo?: string; razonamiento?: boolean; busquedaWeb?: boolean }): void {
    const actual = this.obtener(proyectoLocalId) ?? {};
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

  obtener(proyectoLocalId: string): { proveedor?: string; modelo?: string; razonamiento?: boolean; busquedaWeb?: boolean } | null {
    const fila = this.db.query("SELECT proveedor,modelo,razonamiento,busqueda_web AS busquedaWeb FROM preferencias_proyecto WHERE proyecto_local_id=?").get(proyectoLocalId) as any;
    if (!fila) return null;
    return {
      ...(fila.proveedor ? { proveedor: String(fila.proveedor) } : {}),
      ...(fila.modelo ? { modelo: String(fila.modelo) } : {}),
      ...(fila.razonamiento == null ? {} : { razonamiento: Boolean(fila.razonamiento) }),
      ...(fila.busquedaWeb == null ? {} : { busquedaWeb: Boolean(fila.busquedaWeb) }),
    };
  }
}
