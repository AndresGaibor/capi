import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
export const comandoModelosListar = defineCommand({
  meta: { name: "listar", description: "Listar modelos del proveedor" },
  args: { proveedor: { type: "string", alias: "p", default: "deepseek" } },
  async run({ args }) {
    try { for (const modelo of await crearAplicacion().listarModelos.ejecutar(String(args.proveedor))) consola.log(`${modelo.id}	${modelo.descripcion ?? modelo.nombre}`); }
    catch (error) { consola.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  },
});
