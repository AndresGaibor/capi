import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
export const comandoDiagnosticoPagina = defineCommand({
  meta: { name: "pagina", description: "Diagnosticar la página activa" },
  args: { proveedor: { type: "string", alias: "p", default: "deepseek" } },
  async run({ args }) {
    try { consola.log(JSON.stringify(await crearAplicacion().diagnosticarPagina.ejecutar(String(args.proveedor)), null, 2)); }
    catch (error) { consola.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  },
});
