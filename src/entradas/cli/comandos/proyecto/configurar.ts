import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { ejecutarComando } from "../../soporte/ejecutarComando";

export const comandoProyectoConfigurar = defineCommand({
  meta: { name: "configurar", description: "Guardar preferencias de chat para el proyecto actual" },
  args: {
    proveedor: { type: "string", alias: "p" },
    modelo: { type: "string", alias: "m" },
    razonamiento: { type: "boolean" },
    sinRazonamiento: { type: "boolean" },
    busqueda: { type: "boolean" },
    sinBusqueda: { type: "boolean" },
  },
  run: ({ args }) => ejecutarComando(() => {
    const app = crearAplicacion();
    const proyecto = app.gestorContexto.proyectoActual();
    const cambios: { proveedor?: string; modelo?: string; razonamiento?: boolean; busquedaWeb?: boolean } = {};
    if (args.proveedor) cambios.proveedor = String(args.proveedor);
    if (args.modelo) cambios.modelo = String(args.modelo);
    if (args.razonamiento) cambios.razonamiento = true;
    if (args.sinRazonamiento) cambios.razonamiento = false;
    if (args.busqueda) cambios.busquedaWeb = true;
    if (args.sinBusqueda) cambios.busquedaWeb = false;
    app.repositorioContexto.guardarPreferencias(proyecto.id, cambios);
    const preferencias = app.repositorioContexto.obtenerPreferencias(proyecto.id);
    consola.success(`Preferencias guardadas para ${proyecto.nombre}`);
    consola.log(JSON.stringify(preferencias, null, 2));
  }, "capi chat \"tu mensaje\""),
});

export const comandoProyectoPreferencias = defineCommand({
  meta: { name: "preferencias", description: "Mostrar preferencias del proyecto actual" },
  run: () => ejecutarComando(() => {
    const app = crearAplicacion();
    const proyecto = app.gestorContexto.proyectoActual();
    const preferencias = app.repositorioContexto.obtenerPreferencias(proyecto.id);
    consola.log(preferencias ? JSON.stringify(preferencias, null, 2) : "No hay preferencias configuradas.");
  }),
});
