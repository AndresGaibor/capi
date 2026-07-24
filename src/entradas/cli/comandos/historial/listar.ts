import { defineCommand } from "citty";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";

export const comandoHistorialListar = defineCommand({
  meta: { name: "listar", description: "Listar ejecuciones recientes del proyecto" },
  args: { limite: { type: "string", default: "20" }, output: { type: "string", alias: "o", default: "human" } },
  run({ args }) {
    const resultado = crearAplicacion().consultarHistorialProyecto.ejecutar(Number(args.limite));
    const formato = String(args.output) as FormatoSalida;
    if (formato === "human") {
      for (const e of resultado.ejecuciones) process.stdout.write(`${e.estado.padEnd(11)} ${e.proveedor.padEnd(9)} ${e.modelo ?? "default"} ${new Date(e.iniciadoEn).toISOString()} ${e.conversacionId ?? "sin-conversacion"}\n`);
      return;
    }
    process.stdout.write(serializarSalida(crearSobreExito("history.list", resultado), formato) + "\n");
  },
});
