import { defineCommand } from "citty";
import { crearSobreError, crearSobreExito, codigoSalidaParaError, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
import { obtenerEsquemaComando, obtenerManifestAgente } from "../../agente/ManifestAgente";
export const comandoSchema = defineCommand({
  meta:{name:"schema",description:"Mostrar JSON Schema y comportamiento de un comando"},
  args:{comando:{type:"positional",required:false},output:{type:"string",alias:"o",default:"json"}},
  run:({args})=>{const f=String(args.output) as FormatoSalida;const nombre=args.comando?String(args.comando):undefined;const data=nombre?obtenerEsquemaComando(nombre):obtenerManifestAgente().commands;if(!data){const s=crearSobreError("schema",new Error(`Comando desconocido: ${nombre}`));process.stdout.write(serializarSalida(s,f)+"\n");process.exitCode=codigoSalidaParaError(s.error?.code);return;}process.stdout.write(serializarSalida(crearSobreExito("schema",data),f)+"\n");},
});
