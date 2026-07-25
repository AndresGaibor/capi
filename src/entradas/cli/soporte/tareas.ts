import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface TareaChat {
  id: string;
  estado: "pendiente" | "ejecutando" | "pausada" | "completada" | "fallida";
  creadaEn: number;
  actualizadaEn: number;
  conversacionId?: string;
  error?: string;
}

const directorio = () => join(process.env.CAPI_DATA_DIR ?? join(homedir(), ".local", "share", "capi"), "tareas");
const rutaTarea = (id: string) => join(directorio(), `${id}.json`);

export function crearTarea(): TareaChat {
  const ahora = Date.now();
  const tarea: TareaChat = { id: crypto.randomUUID(), estado: "pendiente", creadaEn: ahora, actualizadaEn: ahora };
  mkdirSync(directorio(), { recursive: true });
  writeFileSync(rutaTarea(tarea.id), JSON.stringify(tarea));
  return tarea;
}

export function actualizarTarea(id: string, cambios: Partial<TareaChat>): void {
  const actual = obtenerTarea(id);
  if (!actual) return;
  writeFileSync(rutaTarea(id), JSON.stringify({ ...actual, ...cambios, actualizadaEn: Date.now() }));
}

export function obtenerTarea(id: string): TareaChat | null {
  try { return JSON.parse(readFileSync(rutaTarea(id), "utf8")) as TareaChat; } catch { return null; }
}

export function listarTareas(): TareaChat[] {
  try { return readdirSync(directorio()).filter((archivo) => archivo.endsWith(".json")).map((archivo) => obtenerTarea(archivo.slice(0, -5))).filter((tarea): tarea is TareaChat => Boolean(tarea)).sort((a, b) => b.creadaEn - a.creadaEn); } catch { return []; }
}
