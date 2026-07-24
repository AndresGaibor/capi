import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
export const comandoSesionImportar = defineCommand({
  meta: { name: "importar", description: "Importar sesión desde el navegador" },
  args: { proveedor: { type: "string", alias: "p", default: "deepseek" } },
  async run({ args }) {
    try { await crearAplicacion().importarSesion.ejecutar(String(args.proveedor)); consola.success("Sesión importada"); }
    catch (error) { consola.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  },
});
