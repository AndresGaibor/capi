import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
export const comandoProyectoActual = defineCommand({
  meta:{name:"actual",description:"Mostrar el proyecto detectado y sus preferencias"},args:{output:{type:"string",alias:"o",default:"markdown"}},
  run:({args})=>{const app=crearAplicacion();const project=app.gestorContexto.proyectoActual();const data={project,preferences:app.repositorioContexto.obtenerPreferencias(project.id)};const f=String(args.output) as FormatoSalida;if(f==="human")consola.log(`${project.nombre}\n${project.rutaRaiz}\nDetección: ${project.tipoDeteccion}`);else process.stdout.write(serializarSalida(crearSobreExito("project.current",data),f)+"\n");},
});
