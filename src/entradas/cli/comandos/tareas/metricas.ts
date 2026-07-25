import{defineCommand}from'citty';import{crearAplicacion}from'../../composicion/crearAplicacion';
export const comandoTareasMetricas=defineCommand({meta:{name:'metricas',description:'Métricas de tareas durables'},run(){const a=crearAplicacion();try{process.stdout.write(JSON.stringify(a.repositorioContexto.metricasEjecucionesChat())+'\n')}finally{a.repositorioContexto.cerrar()}}});
