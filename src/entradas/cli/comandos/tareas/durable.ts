import { crearAplicacion } from '../../composicion/crearAplicacion';
import { ReconciliadorEjecuciones } from '../../../../modulos/chat/aplicacion/ReconciliadorEjecuciones';
export const terminales=new Set(['completada','cancelada','fallida']);
function conRepo<T>(fn:(app:ReturnType<typeof crearAplicacion>)=>T):T{const app=crearAplicacion();try{new ReconciliadorEjecuciones(app.repositorioContexto).ejecutar();return fn(app)}finally{app.repositorioContexto.cerrar()}}
export function obtenerEjecucion(id:string){return conRepo(a=>a.repositorioContexto.obtenerEjecucionChat(id))}
export function listarEjecuciones(limite=100){return conRepo(a=>a.repositorioContexto.listarEjecucionesChat(limite))}
export function listarEventos(id:string,desde=0){return conRepo(a=>a.repositorioContexto.listarEventosEjecucion(id,desde))}
export function diagnosticarEjecucion(id:string,ahora=Date.now()){const e=obtenerEjecucion(id);if(!e)return null;return{...e,duracionMs:(e.completadaEn??ahora)-e.creadaEn,ultimoProgresoHaceMs:ahora-e.ultimoProgresoEn,ultimoSondeoHaceMs:e.ultimoSondeoEn?ahora-e.ultimoSondeoEn:undefined,terminal:terminales.has(e.estado),propietario:{id:e.propietarioId,pid:e.pid,hostname:e.hostname,bootId:e.bootId},privacidad:{respuestaPersistida:e.respuestaParcial.length>0,pensamientoPersistido:e.pensamientoParcial.length>0}}}
