import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
function antiguedad(fecha:number){const m=Math.max(0,Math.floor((Date.now()-fecha)/60000));if(m<60)return`hace ${m} min`;const h=Math.floor(m/60);return h<24?`hace ${h} h`:`hace ${Math.floor(h/24)} d`;}
export const comandoConversacionesProyecto=defineCommand({
 meta:{name:"proyecto",description:"Listar historial de conversaciones del proyecto"},args:{output:{type:"string",alias:"o",default:"human"},archivadas:{type:"boolean"}},
 run:({args})=>{const app=crearAplicacion();const project=app.gestorContexto.proyectoActual();const conversations=app.repositorioContexto.listarConversacionesProyecto(project.id).filter(c=>args.archivadas||!c.archivada);const f=String(args.output) as FormatoSalida;if(f!=="human"){process.stdout.write(serializarSalida(crearSobreExito("conversations.project",{project,conversations}),f)+"\n");return;}if(!conversations.length){consola.info(`No hay conversaciones registradas para ${project.nombre}.`);return;}consola.log(`Conversaciones de ${project.nombre}\n`);for(const c of conversations){const marcas=`${c.principal?"●":" "}${c.favorita?"⭐":"  "}${c.ocupada?"🔒":"  "}`;const origen=c.proyectoLocalId===project.id?"esta ruta":c.rutaOrigen;consola.log(`${marcas} ${c.id}\t${c.titulo??"Sin título"}\t${c.proveedor}\t${c.modelo??""}\t${antiguedad(c.usadaEn)}\t${origen}`);}},
});
