import type { Database } from "bun:sqlite";

export const ESQUEMA_CONTEXTO = 9;

export function migrarContextoSqlite(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proyectos_locales (id TEXT PRIMARY KEY, ruta_raiz TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, tipo_deteccion TEXT NOT NULL, usado_en INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS proyectos_logicos (id TEXT PRIMARY KEY, alias TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS vinculos_proyecto (proyecto_local_id TEXT PRIMARY KEY REFERENCES proyectos_locales(id) ON DELETE CASCADE, proyecto_logico_id TEXT NOT NULL REFERENCES proyectos_logicos(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS conversaciones (id TEXT NOT NULL, proveedor TEXT NOT NULL, proyecto_local_id TEXT NOT NULL REFERENCES proyectos_locales(id), titulo TEXT, modelo TEXT, usada_en INTEGER NOT NULL, favorita INTEGER NOT NULL DEFAULT 0, archivada INTEGER NOT NULL DEFAULT 0, principal INTEGER NOT NULL DEFAULT 0, estado_salud TEXT NOT NULL DEFAULT 'activa', motivo_salud TEXT, fecha_salud INTEGER, PRIMARY KEY (id, proveedor));
    CREATE TABLE IF NOT EXISTS ocupaciones (conversacion_id TEXT NOT NULL, proveedor TEXT NOT NULL, proceso_id TEXT NOT NULL, pid INTEGER NOT NULL, adquirida_en INTEGER NOT NULL, expira_en INTEGER NOT NULL, PRIMARY KEY (conversacion_id, proveedor));
    CREATE TABLE IF NOT EXISTS ejecuciones (proceso_id TEXT PRIMARY KEY, pid INTEGER NOT NULL, adquirida_en INTEGER NOT NULL, expira_en INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS preferencias_proyecto (proyecto_local_id TEXT PRIMARY KEY REFERENCES proyectos_locales(id) ON DELETE CASCADE, proveedor TEXT, modelo TEXT, razonamiento INTEGER, busqueda_web INTEGER);
    CREATE TABLE IF NOT EXISTS snapshots_contexto (proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, conversacion_id TEXT NOT NULL, ruta TEXT NOT NULL, hash TEXT NOT NULL, enviado_en INTEGER NOT NULL, PRIMARY KEY(proyecto_local_id, proveedor, conversacion_id, ruta));
    CREATE TABLE IF NOT EXISTS ejecuciones_historial (id TEXT PRIMARY KEY, proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, modelo TEXT, conversacion_id TEXT, rama TEXT, commit_git TEXT, iniciado_en INTEGER NOT NULL, finalizado_en INTEGER, estado TEXT NOT NULL, contexto_hash TEXT, archivos_json TEXT, respuesta_caracteres INTEGER NOT NULL DEFAULT 0, error TEXT);
    CREATE TABLE IF NOT EXISTS resumenes_conversacion (proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, conversacion_id TEXT NOT NULL, resumen TEXT NOT NULL, actualizado_en INTEGER NOT NULL, PRIMARY KEY(proyecto_local_id, proveedor, conversacion_id));
    CREATE TABLE IF NOT EXISTS cache_adjuntos (proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, conversacion_id TEXT NOT NULL, hash TEXT NOT NULL, ruta TEXT NOT NULL, confirmado_en INTEGER NOT NULL, PRIMARY KEY(proyecto_local_id, proveedor, conversacion_id, hash));
    CREATE TABLE IF NOT EXISTS checkpoints_chat (proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, conversacion_id TEXT NOT NULL, motivo TEXT NOT NULL, pensamiento TEXT NOT NULL DEFAULT '', respuesta TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL, actualizado_en INTEGER NOT NULL, PRIMARY KEY(proyecto_local_id, proveedor, conversacion_id));
    PRAGMA user_version=${ESQUEMA_CONTEXTO};
  `);
  const columnas = db.query("PRAGMA table_info(conversaciones)").all() as Array<{ name: string }>;
  if (!columnas.some((columna) => columna.name === "estado_salud"))
    db.exec("ALTER TABLE conversaciones ADD COLUMN estado_salud TEXT NOT NULL DEFAULT 'activa'");
  if (!columnas.some((columna) => columna.name === "motivo_salud"))
    db.exec("ALTER TABLE conversaciones ADD COLUMN motivo_salud TEXT");
  if (!columnas.some((columna) => columna.name === "fecha_salud"))
    db.exec("ALTER TABLE conversaciones ADD COLUMN fecha_salud INTEGER");
}
