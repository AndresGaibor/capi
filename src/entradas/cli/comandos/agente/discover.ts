import { defineCommand } from "citty";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
import { obtenerManifestAgente } from "../../agente/ManifestAgente";
export const comandoDiscover = defineCommand({
  meta:{name:"discover",description:"Descubrir contratos, capacidades y códigos para agentes"},
  args:{output:{type:"string",alias:"o",default:"markdown"}},
  run:({args})=>{const f=String(args.output) as FormatoSalida;process.stdout.write(serializarSalida(crearSobreExito("discover",obtenerManifestAgente()),f)+"\n");},
});
