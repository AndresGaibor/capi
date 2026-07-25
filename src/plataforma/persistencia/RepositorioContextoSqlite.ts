import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  ESQUEMA_CONTEXTO,
  migrarContextoSqlite,
} from "./MigradorContextoSqlite";
import { RepositorioProyectos } from "./RepositorioProyectos";
import { RepositorioConversaciones } from "./RepositorioConversaciones";
import type { ConversacionRegistrada, EstadoSaludConversacion } from "./RepositorioConversaciones";
import { RepositorioOcupaciones } from "./RepositorioOcupaciones";
import { RepositorioEjecuciones } from "./RepositorioEjecuciones";
import { RepositorioPreferencias } from "./RepositorioPreferencias";
import { RepositorioHistorial } from "./RepositorioHistorial";
import { RepositorioCache } from "./RepositorioCache";

export { type ConversacionRegistrada } from "./RepositorioConversaciones";

export class RepositorioContextoSqlite {
  readonly proyectos: RepositorioProyectos;
  readonly conversaciones: RepositorioConversaciones;
  readonly ocupaciones: RepositorioOcupaciones;
  readonly ejecuciones: RepositorioEjecuciones;
  readonly preferencias: RepositorioPreferencias;
  readonly historial: RepositorioHistorial;
  readonly cache: RepositorioCache;

  private readonly db: Database;

  constructor(ruta: string) {
    mkdirSync(dirname(ruta), { recursive: true });
    this.db = new Database(ruta, { create: true });
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    migrarContextoSqlite(this.db);

    this.proyectos = new RepositorioProyectos(this.db);
    this.conversaciones = new RepositorioConversaciones(this.db);
    this.ocupaciones = new RepositorioOcupaciones(this.db);
    this.ejecuciones = new RepositorioEjecuciones(this.db);
    this.preferencias = new RepositorioPreferencias(this.db);
    this.historial = new RepositorioHistorial(this.db);
    this.cache = new RepositorioCache(this.db);
  }

  registrarProyecto(
    proyecto: import("../../nucleo/proyectos/Proyecto").ProyectoDetectado,
    ahora = Date.now(),
  ): void {
    this.proyectos.registrar(proyecto, ahora);
  }

  vincularProyecto(proyectoLocalId: string, alias: string): void {
    this.proyectos.vincular(proyectoLocalId, alias);
  }

  desvincularProyecto(proyectoLocalId: string): void {
    this.proyectos.desvincular(proyectoLocalId);
  }

  registrarConversacion(
    entrada: {
      id: string;
      proveedor: string;
      proyectoLocalId: string;
      titulo?: string;
      modelo?: string;
    },
    ahora = Date.now(),
  ): void {
    this.conversaciones.registrar(entrada, ahora);
  }

  listarConversacionesProyecto(
    proyectoLocalId: string,
  ): ConversacionRegistrada[] {
    return this.conversaciones.listarProyecto(proyectoLocalId);
  }

  marcarConversacionPrincipal(id: string, proveedor: string, proyectoLocalId: string): void {
    this.conversaciones.marcarPrincipal(id, proveedor, proyectoLocalId);
  }

  actualizarEstado(
    id: string,
    proveedor: string,
    cambios: { favorita?: boolean; archivada?: boolean; principal?: boolean },
    proyectoLocalId?: string,
  ): void {
    this.conversaciones.actualizarEstado(
      id,
      proveedor,
      cambios,
      proyectoLocalId,
    );
  }

  marcarSaludConversacion(
    id: string,
    proveedor: string,
    estado: EstadoSaludConversacion,
    motivo?: string,
    fecha = Date.now(),
  ): void {
    this.conversaciones.marcarSalud(id, proveedor, estado, motivo, fecha);
  }

  adquirirOcupacion(
    conversacionId: string,
    procesoId: string,
    ahora: number,
    ttlMs: number,
    proveedor = "qwen",
    pid = process.pid,
  ): boolean {
    return this.ocupaciones.adquirir(
      conversacionId,
      procesoId,
      ahora,
      ttlMs,
      proveedor,
      pid,
    );
  }

  renovarOcupacion(
    conversacionId: string,
    procesoId: string,
    ahora: number,
    ttlMs: number,
    proveedor = "qwen",
  ): boolean {
    return this.ocupaciones.renovar(
      conversacionId,
      procesoId,
      ahora,
      ttlMs,
      proveedor,
    );
  }

  liberarOcupacion(
    conversacionId: string,
    procesoId: string,
    proveedor = "qwen",
  ): void {
    this.ocupaciones.liberar(conversacionId, procesoId, proveedor);
  }

  contarOcupacionesActivas(ahora = Date.now()): number {
    return this.ocupaciones.contarActivas(ahora);
  }

  adquirirEjecucion(
    procesoId: string,
    ahora: number,
    ttlMs: number,
    pid = process.pid,
    limite = 3,
  ): boolean {
    return this.ejecuciones.adquirir(procesoId, ahora, ttlMs, pid, limite);
  }

  renovarEjecucion(procesoId: string, ahora: number, ttlMs: number): boolean {
    return this.ejecuciones.renovar(procesoId, ahora, ttlMs);
  }

  liberarEjecucion(procesoId: string): void {
    this.ejecuciones.liberar(procesoId);
  }

  contarEjecucionesActivas(ahora = Date.now()): number {
    return this.ejecuciones.contarActivas(ahora);
  }

  guardarPreferencias(
    proyectoLocalId: string,
    preferencias: {
      proveedor?: string;
      modelo?: string;
      razonamiento?: boolean;
      busquedaWeb?: boolean;
    },
  ): void {
    this.preferencias.guardar(proyectoLocalId, preferencias);
  }

  obtenerPreferencias(
    proyectoLocalId: string,
  ): {
    proveedor?: string;
    modelo?: string;
    razonamiento?: boolean;
    busquedaWeb?: boolean;
  } | null {
    return this.preferencias.obtener(proyectoLocalId);
  }

  obtenerHashesContexto(
    proyectoLocalId: string,
    proveedor: string,
    conversacionId: string,
  ): Record<string, string> {
    return this.historial.obtenerHashesContexto(
      proyectoLocalId,
      proveedor,
      conversacionId,
    );
  }

  guardarSnapshotContexto(
    proyectoLocalId: string,
    proveedor: string,
    conversacionId: string,
    archivos: Array<{ ruta: string; hash: string }>,
    ahora = Date.now(),
  ): void {
    this.historial.guardarSnapshot(
      proyectoLocalId,
      proveedor,
      conversacionId,
      archivos,
      ahora,
    );
  }

  iniciarEjecucionHistorial(
    entrada: {
      id: string;
      proyectoLocalId: string;
      proveedor: string;
      modelo?: string;
      conversacionId?: string;
      rama?: string;
      commitGit?: string;
      contextoHash?: string;
      archivos?: string[];
    },
    ahora = Date.now(),
  ): void {
    this.historial.iniciar(entrada, ahora);
  }

  finalizarEjecucionHistorial(
    id: string,
    entrada: {
      estado: "completada" | "pausada" | "fallida";
      conversacionId?: string;
      modelo?: string;
      contextoHash?: string;
      archivos?: string[];
      respuestaCaracteres?: number;
      error?: string;
    },
    ahora = Date.now(),
  ): void {
    this.historial.finalizar(id, entrada, ahora);
  }

  listarHistorialProyecto(proyectoLocalId: string, limite = 20): any[] {
    return this.historial.listar(proyectoLocalId, limite);
  }

  guardarResumenConversacion(
    proyectoLocalId: string,
    proveedor: string,
    conversacionId: string,
    resumen: string,
    ahora = Date.now(),
  ): void {
    this.historial.guardarResumen(
      proyectoLocalId,
      proveedor,
      conversacionId,
      resumen,
      ahora,
    );
  }

  obtenerResumenConversacion(
    proyectoLocalId: string,
    proveedor: string,
    conversacionId: string,
  ): string | null {
    return this.historial.obtenerResumen(
      proyectoLocalId,
      proveedor,
      conversacionId,
    );
  }

  registrarAdjuntosConfirmados(
    proyectoLocalId: string,
    proveedor: string,
    conversacionId: string,
    archivos: Array<{ hash: string; ruta: string }>,
    ahora = Date.now(),
  ): void {
    this.cache.registrarAdjuntosConfirmados(
      proyectoLocalId,
      proveedor,
      conversacionId,
      archivos,
      ahora,
    );
  }

  listarHashesAdjuntos(
    proyectoLocalId: string,
    proveedor: string,
    conversacionId: string,
  ): string[] {
    return this.cache.listarHashesAdjuntos(
      proyectoLocalId,
      proveedor,
      conversacionId,
    );
  }

  obtenerMetricasProyecto(proyectoLocalId: string): any {
    return this.cache.obtenerMetricas(proyectoLocalId);
  }

  guardarCheckpoint(entrada: { proyectoLocalId: string; proveedor: string; conversacionId: string; motivo: string; pensamiento: string; respuesta: string; estado: "pausado" | "completado" }, actualizadoEn = Date.now()): void {
    this.db.query(`INSERT INTO checkpoints_chat(proyecto_local_id,proveedor,conversacion_id,motivo,pensamiento,respuesta,estado,actualizado_en) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(proyecto_local_id,proveedor,conversacion_id) DO UPDATE SET motivo=excluded.motivo,pensamiento=excluded.pensamiento,respuesta=excluded.respuesta,estado=excluded.estado,actualizado_en=excluded.actualizado_en`)
      .run(entrada.proyectoLocalId, entrada.proveedor, entrada.conversacionId, entrada.motivo, entrada.pensamiento, entrada.respuesta, entrada.estado, actualizadoEn);
  }

  obtenerCheckpoint(proyectoLocalId: string, proveedor: string, conversacionId: string): { proyectoLocalId: string; proveedor: string; conversacionId: string; motivo: string; pensamiento: string; respuesta: string; estado: "pausado" | "completado"; actualizadoEn: number } | null {
    const fila = this.db.query(`SELECT proyecto_local_id AS proyectoLocalId,proveedor,conversacion_id AS conversacionId,motivo,pensamiento,respuesta,estado,actualizado_en AS actualizadoEn FROM checkpoints_chat WHERE proyecto_local_id=? AND proveedor=? AND conversacion_id=?`).get(proyectoLocalId, proveedor, conversacionId);
    return (fila as any) ?? null;
  }

  limpiarProyecto(
    proyectoLocalId: string,
    capas: string[],
  ): Record<string, number> {
    const capasSinOcupaciones = capas.filter(c => c !== "ocupaciones");
    const resultado = capasSinOcupaciones.length > 0 ? this.cache.limpiar(proyectoLocalId, capasSinOcupaciones) : {};
    if (capas.includes("ocupaciones")) {
      resultado["ocupaciones"] = this.ocupaciones.limpiar();
    }
    return resultado;
  }

  exportarProyecto(proyectoLocalId: string): any {
    return this.cache.exportar(proyectoLocalId);
  }

  importarProyecto(datos: unknown): { proyectoLocalId: string; filas: number } {
    return this.cache.importar(datos);
  }

  diagnosticar(): {
    disponible: boolean;
    esquema: number;
    ocupacionesActivas: number;
  } {
    const integridad = this.db.query("PRAGMA quick_check").get() as Record<
      string,
      string
    >;
    return {
      disponible: Object.values(integridad)[0] === "ok",
      esquema: ESQUEMA_CONTEXTO,
      ocupacionesActivas:
        this.contarOcupacionesActivas() + this.contarEjecucionesActivas(),
    };
  }

  cerrar(): void {
    this.db.close();
  }
}
