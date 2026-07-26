import { defineCommand } from "citty";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { crearSobreExito, crearSobreError, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
import { ErrorArgumentosInvalidos } from "../../../../nucleo/errores/ErroresAplicacion";

const CAPAS_VALIDAS = new Set(["cache", "snapshots", "historial", "resumenes", "ocupaciones"]);

export const comandoEstadoLimpiar = defineCommand({
  meta: { name: "limpiar", description: "Limpiar capas locales del proyecto" },
  args: {
    capas: { type: "string", required: true, description: "cache,snapshots,historial,resumenes,ocupaciones" },
    confirmar: { type: "boolean", default: false, description: "Ejecutar la limpieza sin confirmación" },
    output: { type: "string", default: "json", description: "json|markdown|human" },
  },
  run({ args }) {
    const formato = String(args.output ?? "json") as FormatoSalida;
    const capas = String(args.capas).split(",").map((x) => x.trim()).filter(Boolean);
    const invalidas = capas.filter((c) => !CAPAS_VALIDAS.has(c));
    const app = crearAplicacion();
    const p = app.gestorContexto.proyectoActual();
    try {
      if (invalidas.length > 0) throw new ErrorArgumentosInvalidos(`Capas inválidas: ${invalidas.join(", ")}. Válidas: ${[...CAPAS_VALIDAS].join(", ")}`, [{ command: "capi estado limpiar --capas cache,snapshots --confirmar", reason: "capas validas" }]);
      const metricas = app.gestionarEstadoProyecto.metricas(p.id);
      if (!args.confirmar) {
        const preview = {
          proyecto: p.nombre,
          capasSeleccionadas: capas,
          metricasActuales: metricas,
          siguientePaso: `capi estado limpiar --capas ${capas.join(",")} --confirmar`,
        };
        process.stdout.write(serializarSalida(crearSobreExito("state.clean.dry-run", preview), formato === "human" ? "markdown" : formato) + "\n");
        return;
      }
      const resultado = app.gestionarEstadoProyecto.limpiar(p.id, capas);
      process.stdout.write(serializarSalida(crearSobreExito("state.clean", { capas: capas, eliminadas: resultado }), formato === "human" ? "markdown" : formato) + "\n");
    } catch (error) {
      if (error instanceof ErrorArgumentosInvalidos) {
        process.stdout.write(serializarSalida(crearSobreError("state.clean", error), formato === "human" ? "markdown" : formato) + "\n");
        process.exitCode = 1;
        return;
      }
      throw error;
    } finally {
      app.repositorioContexto.cerrar();
    }
  },
});
