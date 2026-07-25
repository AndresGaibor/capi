import { crearAplicacion } from "../../composicion/crearAplicacion";

export const terminales = new Set(["completada","cancelada","fallida","requiere_usuario"]);
export function obtenerEjecucion(id:string){ const app=crearAplicacion(); try { return app.repositorioContexto.obtenerEjecucionChat(id); } finally { app.repositorioContexto.cerrar(); } }
export function listarEjecuciones(limite=100){ const app=crearAplicacion(); try { return app.repositorioContexto.listarEjecucionesChat(limite); } finally { app.repositorioContexto.cerrar(); } }
export function listarEventos(id:string,desde=0){ const app=crearAplicacion(); try { return app.repositorioContexto.listarEventosEjecucion(id,desde); } finally { app.repositorioContexto.cerrar(); } }
export function diagnosticarEjecucion(id:string,ahora=Date.now()) { const e=obtenerEjecucion(id); if(!e) return null; return { ...e, duracionMs:(e.completadaEn??ahora)-e.creadaEn, ultimoProgresoHaceMs:ahora-e.ultimoProgresoEn, ultimoSondeoHaceMs:e.ultimoSondeoEn?ahora-e.ultimoSondeoEn:undefined, terminal:terminales.has(e.estado), lease:{propietarioId:e.propietarioId}, privacidad:{respuestaPersistida:e.respuestaParcial.length>0,pensamientoPersistido:e.pensamientoParcial.length>0} }; }
