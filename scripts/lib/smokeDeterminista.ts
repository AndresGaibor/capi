import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ejecutarProcesoConTimeout } from "./ejecutarProcesoConTimeout";

export interface ResultadoProcesoSmoke { exitCode: number; timeout: boolean; stdout: string; stderr: string; }

export interface OpcionesSmokeProceso {
  cwd?: string;
  env?: Record<string, string>;
}

export type EjecutorSmoke = (
  comando: string[],
  timeoutMs: number,
  opciones?: OpcionesSmokeProceso,
) => Promise<ResultadoProcesoSmoke>;

export interface EntornoSmokeAislado {
  directorio: string;
  datos: string;
  env: Record<string, string>;
  limpiar(): void;
}

export function crearEntornoSmokeAislado(prefijo: string, uuid: () => string = () => crypto.randomUUID()): EntornoSmokeAislado {
  const directorio = mkdtempSync(join(tmpdir(), `capi-smoke-${prefijo}-`));
  const datos = join(directorio, "datos");
  mkdirSync(datos);
  return {
    directorio,
    datos,
    env: {
      CAPI_DATA_DIR: datos,
      CAPI_WEBBRIDGE_SESSION: `capi-smoke-${prefijo}-${uuid()}`,
    },
    limpiar: () => rmSync(directorio, { recursive: true, force: true }),
  };
}

export function crearMarcadorSmoke(tipo: string, uuid: () => string = () => crypto.randomUUID()): string {
  return `CAPI_${tipo}_${uuid().replaceAll("-", "").toUpperCase()}`;
}

export function evaluarSmoke(proveedor: string, marcador: string, resultado: ResultadoProcesoSmoke): { ok: true; proveedor: string; marcador: string } {
  if (resultado.timeout) throw new Error(`Smoke ${proveedor} excedió el timeout`);
  if (resultado.exitCode !== 0 || !resultado.stdout.includes(marcador)) throw new Error(`Smoke ${proveedor} no devolvió el marcador`);
  return { ok: true, proveedor, marcador };
}

export function rutaCliSmoke(): string {
  return resolve(import.meta.dir, "../../src/cli.ts");
}

export function obtenerConversacionSmokeJsonl(salida: string): string | undefined {
  for (const linea of salida.split("\n")) {
    try {
      const evento = JSON.parse(linea) as { event?: string; data?: { conversationId?: unknown } };
      if (evento.event === "conversation.selected" && typeof evento.data?.conversationId === "string") return evento.data.conversationId;
    } catch {
      // Los únicos datos consumidos son sobres JSONL completos; se ignoran líneas ajenas.
    }
  }
  return undefined;
}


export function obtenerConversacionProyectoJson(salida: string, proveedor: string): string | undefined {
  try {
    const sobre = JSON.parse(salida) as { data?: { conversations?: Array<{ id?: unknown; proveedor?: unknown; principal?: unknown; usadaEn?: unknown }> } };
    const candidatas = (sobre.data?.conversations ?? [])
      .filter((item) => item.proveedor === proveedor && typeof item.id === "string")
      .sort((a, b) => Number(Boolean(b.principal)) - Number(Boolean(a.principal)) || Number(b.usadaEn ?? 0) - Number(a.usadaEn ?? 0));
    return candidatas[0]?.id as string | undefined;
  } catch {
    return undefined;
  }
}

async function resolverConversacionSmoke(
  proveedor: string,
  salidaInicial: string,
  timeoutMs: number,
  ejecutar: EjecutorSmoke,
  entorno: EntornoSmokeAislado,
): Promise<string | undefined> {
  const evento = obtenerConversacionSmokeJsonl(salidaInicial);
  if (evento) return evento;
  const listado = await ejecutar(["bun", "run", rutaCliSmoke(), "conversaciones", "proyecto", "--output", "json"], timeoutMs, { cwd: entorno.directorio, env: entorno.env });
  if (listado.timeout || listado.exitCode !== 0) return undefined;
  return obtenerConversacionProyectoJson(listado.stdout, proveedor);
}

export async function archivarConversacionSmoke(
  proveedor: string,
  conversacionId: string,
  timeoutMs: number,
  ejecutar: EjecutorSmoke,
  entorno: EntornoSmokeAislado,
): Promise<void> {
  const resultado = await ejecutar(["bun", "run", rutaCliSmoke(), "conversaciones", "archivar", conversacionId, "--proveedor", proveedor], timeoutMs, { cwd: entorno.directorio, env: entorno.env });
  if (resultado.timeout || resultado.exitCode !== 0) throw new Error(`Smoke ${proveedor} no pudo archivar la conversación de prueba`);
}

export interface OpcionesSmokeTextoYContinuidad {
  proveedor: "qwen" | "deepseek";
  modelo: string;
  marcador?: string;
  timeoutMs?: number;
  ejecutar?: EjecutorSmoke;
}

export async function ejecutarSmokeTextoYContinuidad(opciones: OpcionesSmokeTextoYContinuidad): Promise<{
  ok: true;
  proveedor: string;
  marcador: string;
  conversacionId: string;
  archivada: true;
  limpiado: true;
}> {
  const marcador = opciones.marcador ?? crearMarcadorSmoke("TEXT");
  const timeout = opciones.timeoutMs ?? Number(process.env.CAPI_SMOKE_TIMEOUT_MS ?? (opciones.proveedor === "qwen" ? 3_900_000 : 180_000));
  const ejecutar = opciones.ejecutar ?? ((comando, limite, proceso) => ejecutarProcesoConTimeout(comando, limite, proceso));
  const entorno = crearEntornoSmokeAislado("text");
  let conversacionId: string | undefined;
  let archivada = false;
  try {
    const base = ["bun", "run", rutaCliSmoke(), "chat", "enviar", "--proveedor", opciones.proveedor, "--modelo", opciones.modelo, "--output", "jsonl"];
    const inicial = await ejecutar([...base, "--nueva", `Memoriza este marcador para el siguiente turno: ${marcador}. Responde solamente con el marcador exacto.`], timeout, { cwd: entorno.directorio, env: entorno.env });
    evaluarSmoke(opciones.proveedor, marcador, inicial);
    conversacionId = await resolverConversacionSmoke(opciones.proveedor, inicial.stdout, timeout, ejecutar, entorno);
    if (!conversacionId) throw new Error(`Smoke ${opciones.proveedor} no informó conversationId JSONL`);

    const continuidad = await ejecutar([...base, "--conversacion", conversacionId, `¿Qué marcador te pedí memorizar? Responde solamente con ${marcador}.`], timeout, { cwd: entorno.directorio, env: entorno.env });
    evaluarSmoke(opciones.proveedor, marcador, continuidad);

    await archivarConversacionSmoke(opciones.proveedor, conversacionId, timeout, ejecutar, entorno);
    archivada = true;
    return { ok: true, proveedor: opciones.proveedor, marcador, conversacionId, archivada: true, limpiado: true };
  } finally {
    if (conversacionId && !archivada) {
      await archivarConversacionSmoke(opciones.proveedor, conversacionId, timeout, ejecutar, entorno);
    }
    // La conversación se archiva antes de eliminar su SQLite temporal; nunca se toca el proyecto del usuario.
    entorno.limpiar();
  }
}
