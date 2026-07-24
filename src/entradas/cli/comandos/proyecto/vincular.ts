import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { ejecutarComando } from "../../soporte/ejecutarComando";

export const comandoProyectoVincular = defineCommand({
  meta: { name: "vincular", description: "Vincular esta ruta a un proyecto lógico" },
  args: { alias: { type: "positional", required: true, description: "Alias compartido" } },
  run: ({ args }) => ejecutarComando(() => {
    const app = crearAplicacion();
    const proyecto = app.gestorContexto.proyectoActual();
    app.repositorioContexto.vincularProyecto(proyecto.id, String(args.alias));
    consola.success(`${proyecto.rutaRaiz} vinculada a ${String(args.alias)}`);
  }, "capi conversaciones proyecto"),
});
