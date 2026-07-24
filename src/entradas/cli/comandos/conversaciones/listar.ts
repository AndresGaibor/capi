import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
export const comandoConversacionesListar = defineCommand({
  meta: { name: "listar", description: "Listar conversaciones" },
  args: { proveedor: { type: "string", alias: "p", default: "deepseek" } },
  async run({ args }) {
    try { for (const c of await crearAplicacion().listarConversaciones.ejecutar(String(args.proveedor))) consola.log(`${c.id}	${c.titulo}	${c.modelo ?? ""}`); }
    catch (error) { consola.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  },
});
