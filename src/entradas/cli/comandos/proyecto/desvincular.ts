import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { ejecutarComando } from "../../soporte/ejecutarComando";

export const comandoProyectoDesvincular = defineCommand({
  meta: { name: "desvincular", description: "Separar esta ruta de su proyecto lógico" },
  run: () => ejecutarComando(() => {
    const app = crearAplicacion();
    const proyecto = app.gestorContexto.proyectoActual();
    app.repositorioContexto.desvincularProyecto(proyecto.id);
    consola.success("Ruta desvinculada");
  }),
});
