import { defineCommand } from "citty";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { crearSobreError, crearSobreExito, codigoSalidaParaError, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
export const comandoDoctor = defineCommand({
 meta:{name:"doctor",description:"Diagnóstico estructurado de CAPI"},args:{output:{type:"string",alias:"o",default:"json"}},
 async run({args}){const f=String(args.output) as FormatoSalida;try{const data=await crearAplicacion().diagnosticarCompleto.ejecutar();process.stdout.write(serializarSalida(crearSobreExito("doctor",data),f)+"\n");if(!data.proyecto.ok||!data.persistencia.ok||data.proveedores.some(p=>!p.ok))process.exitCode=1;}catch(e){const s=crearSobreError("doctor",e);process.stdout.write(serializarSalida(s,f)+"\n");process.exitCode=codigoSalidaParaError(s.error?.code);}}
});
