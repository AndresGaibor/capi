import { defineCommand } from "citty";
import { listarEjecuciones } from "./durable";
export const comandoTareasListar=defineCommand({meta:{name:"listar",description:"Listar ejecuciones de chat durables"},args:{limite:{type:"string" as const,default:"100"}},run:({args})=>process.stdout.write(JSON.stringify(listarEjecuciones(Number(args.limite)))+"\n")});
