import type { Database } from "bun:sqlite";

export const ESQUEMA_CONTEXTO = 7;

export function migrarContextoSqlite(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proyectos_locales (id TEXT PRIMARY KEY, ruta_raiz TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, tipo_deteccion TEXT NOT NULL, usado_en INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS proyectos_logicos (id TEXT PRIMARY KEY, alias TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS vinculos_proyecto (proyecto_local_id TEXT PRIMARY KEY REFERENCES proyectos_locales(id) ON DELETE CASCADE, proyecto_logico_id TEXT NOT NULL REFERENCES proyectos_logicos(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS conversaciones (id TEXT NOT NULL, proveedor TEXT NOT NULL, proyecto_local_id TEXT NOT NULL REFERENCES proyectos_locales(id), titulo TEXT, modelo TEXT, usada_en INTEGER NOT NULL, favorita INTEGER NOT NULL DEFAULT 0, archivada INTEGER NOT NULL DEFAULT 0, principal INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, proveedor));
    CREATE TABLE IF NOT EXISTS ocupaciones (conversacion_id TEXT NOT NULL, proveedor TEXT NOT NULL, proceso_id TEXT NOT NULL, pid INTEGER NOT NULL, adquirida_en INTEGER NOT NULL, expira_en INTEGER NOT NULL, PRIMARY KEY (conversacion_id, proveedor));
    CREATE TABLE IF NOT EXISTS ejecuciones (proceso_id TEXT PRIMARY KEY, pid INTEGER NOT NULL, adquirida_en INTEGER NOT NULL, expira_en INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS preferencias_proyecto (proyecto_local_id TEXT PRIMARY KEY REFERENCES proyectos_locales(id) ON DELETE CASCADE, proveedor TEXT, modelo TEXT, razonamiento INTEGER, busqueda_web INTEGER);
    CREATE TABLE IF NOT EXISTS snapshots_contexto (proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, conversacion_id TEXT NOT NULL, ruta TEXT NOT NULL, hash TEXT NOT NULL, enviado_en INTEGER NOT NULL, PRIMARY KEY(proyecto_local_id, proveedor, conversacion_id, ruta));
    CREATE TABLE IF NOT EXISTS ejecuciones_historial (id TEXT PRIMARY KEY, proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, modelo TEXT, conversacion_id TEXT, rama TEXT, commit_git TEXT, iniciado_en INTEGER NOT NULL, finalizado_en INTEGER, estado TEXT NOT NULL, contexto_hash TEXT, archivos_json TEXT, respuesta_caracteres INTEGER NOT NULL DEFAULT 0, error TEXT);
    CREATE TABLE IF NOT EXISTS resumenes_conversacion (proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, conversacion_id TEXT NOT NULL, resumen TEXT NOT NULL, actualizado_en INTEGER NOT NULL, PRIMARY KEY(proyecto_local_id, proveedor, conversacion_id));
    CREATE TABLE IF NOT EXISTS cache_adjuntos (proyecto_local_id TEXT NOT NULL, proveedor TEXT NOT NULL, conversacion_id TEXT NOT NULL, hash TEXT NOT NULL, ruta TEXT NOT NULL, confirmado_en INTEGER NOT NULL, PRIMARY KEY(proyecto_local_id, proveedor, conversacion_id, hash));
    PRAGMA user_version=${ESQUEMA_CONTEXTO};
  `);
}
