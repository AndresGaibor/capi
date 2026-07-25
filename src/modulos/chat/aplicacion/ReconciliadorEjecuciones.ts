import type { RepositorioContextoSqlite } from '../../../plataforma/persistencia/RepositorioContextoSqlite';
import { identidadProceso, procesoVivo } from '../../../plataforma/procesos/IdentidadProceso';
export class ReconciliadorEjecuciones { constructor(private repo:RepositorioContextoSqlite){} ejecutar(umbralMs=90_000,ahora=Date.now()){const actual=identidadProceso();return this.repo.reconciliarEjecucionesChat(e=>!!e.pid&&!!e.hostname&&!!e.bootId&&procesoVivo(e.pid,e.hostname,e.bootId,actual),umbralMs,ahora)} }
