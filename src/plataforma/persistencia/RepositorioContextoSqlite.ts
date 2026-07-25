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
import { RepositorioCheckpointsChat, type CheckpointChat } from "./RepositorioCheckpointsChat";
import { RepositorioEjecucionesChat, type EjecucionChatDurable } from "./RepositorioEjecucionesChat";
import { RepositorioEnviosIdempotentes, type EnvioIdempotente, type EstadoEnvioIdempotente } from "./RepositorioEnviosIdempotentes";

export { type ConversacionRegistrada } from "./RepositorioConversaciones";

export class RepositorioContextoSqlite {
  readonly proyectos: RepositorioProyectos;
  readonly conversaciones: RepositorioConversaciones;
  readonly ocupaciones: RepositorioOcupaciones;
  readonly ejecuciones: RepositorioEjecuciones;
  readonly preferencias: RepositorioPreferencias;
  readonly historial: RepositorioHistorial;
  readonly cache: RepositorioCache;
  readonly checkpoints: RepositorioCheckpointsChat;
  readonly ejecucionesChat: RepositorioEjecucionesChat;
  readonly enviosIdempotentes: RepositorioEnviosIdempotentes;

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
    this.checkpoints = new RepositorioCheckpointsChat(this.db);
    this.ejecucionesChat = new RepositorioEjecucionesChat(this.db);
    this.enviosIdempotentes = new RepositorioEnviosIdempotentes(this.db);
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

  registrarEnvioIdempotente(entrada:Omit<EnvioIdempotente,"creadoEn"|"actualizadoEn">,ahora=Date.now()){this.enviosIdempotentes.registrar(entrada,ahora);}
  actualizarEnvioIdempotente(huella:string,estado:EstadoEnvioIdempotente,ahora=Date.now()){this.enviosIdempotentes.actualizar(huella,estado,ahora);}
  obtenerEnvioIdempotente(huella:string){return this.enviosIdempotentes.obtener(huella);}
  debeEvitarReenvio(huella:string){return this.enviosIdempotentes.debeEvitarReenvio(huella);}

  crearEjecucionChat(entrada: Parameters<RepositorioEjecucionesChat["crear"]>[0], ahora=Date.now()): void { this.ejecucionesChat.crear(entrada, ahora); }
  actualizarEjecucionChat(id:string, cambios:Partial<EjecucionChatDurable>, ahora=Date.now()): void { this.ejecucionesChat.actualizar(id,cambios,ahora); }
  obtenerEjecucionChat(id:string): EjecucionChatDurable|null { return this.ejecucionesChat.obtener(id); }
  listarEjecucionesChat(limite=100): EjecucionChatDurable[] { return this.ejecucionesChat.listar(limite); }
  anexarEventoEjecucion(id:string,tipo:string,datos:Record<string,unknown>,ahora=Date.now()){ return this.ejecucionesChat.anexarEvento(id,tipo,datos,ahora); }
  listarEventosEjecucion(id:string,desde=0){ return this.ejecucionesChat.listarEventos(id,desde); }
  solicitarCancelacionEjecucion(id:string,ahora=Date.now()){ this.ejecucionesChat.solicitarCancelacion(id,ahora); }
  marcarEjecucionReanudable(id:string,ahora=Date.now()){ this.ejecucionesChat.marcarReanudable(id,ahora); }

  obtenerMetricasProyecto(proyectoLocalId: string): any {
    return this.cache.obtenerMetricas(proyectoLocalId);
  }

  guardarCheckpoint(entrada: Omit<CheckpointChat, "actualizadoEn">, actualizadoEn = Date.now()): void {
    this.checkpoints.guardar(entrada, actualizadoEn);
  }

  obtenerCheckpoint(proyectoLocalId: string, proveedor: string, conversacionId: string): CheckpointChat | null {
    return this.checkpoints.obtener(proyectoLocalId, proveedor, conversacionId);
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
