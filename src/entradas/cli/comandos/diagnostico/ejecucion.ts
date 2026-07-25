import { defineCommand } from "citty";
import { diagnosticarEjecucion } from "../tareas/durable";
export const comandoDiagnosticoEjecucion=defineCommand({meta:{name:"ejecucion",description:"Diagnosticar una ejecución durable"},args:{id:{type:"positional" as const,required:true},output:{type:"string" as const,default:"json"}},run({args}){const d=diagnosticarEjecucion(String(args.id));if(!d){process.stderr.write(`Ejecución no encontrada: ${String(args.id)}\n`);process.exitCode=1;return;}process.stdout.write(JSON.stringify(d,null,args.output==="human"?2:0)+"\n");}});
