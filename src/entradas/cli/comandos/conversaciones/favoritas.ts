import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { ejecutarComando } from "../../soporte/ejecutarComando";

export const comandoConversacionesFavoritas = defineCommand({
  meta: { name: "favoritas", description: "Listar conversaciones favoritas del proyecto" },
  run: () => ejecutarComando(() => {
    const app = crearAplicacion();
    const p = app.gestorContexto.proyectoActual();
    for (const c of app.repositorioContexto.listarConversacionesProyecto(p.id).filter((x) => x.favorita && !x.archivada)) consola.log(`${c.id}\t${c.titulo ?? "Sin título"}\t${c.proveedor}`);
  }),
});
