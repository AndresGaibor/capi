import { defineCommand } from "citty";
import { diagnosticarEjecucion } from "./durable";
export const comandoTareasEstado=defineCommand({meta:{name:"estado",description:"Consultar una ejecución durable"},args:{id:{type:"positional" as const,required:true}},run:({args})=>{const e=diagnosticarEjecucion(String(args.id));if(!e){process.stderr.write(`Ejecución no encontrada: ${String(args.id)}\n`);process.exitCode=1;return;}process.stdout.write(JSON.stringify(e)+"\n");}});
