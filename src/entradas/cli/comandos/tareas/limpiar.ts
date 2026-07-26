import { defineCommand } from "citty";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { crearSobreExito, crearSobreError, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
import { ErrorArgumentosInvalidos } from "../../../../nucleo/errores/ErroresAplicacion";

const duracion = (v: string) => {
  const m = v.match(/^(\d+)(d|h|m)$/);
  if (!m) throw new ErrorArgumentosInvalidos("Duración inválida; usa 30d, 12h o 10m", [{ command: "capi tareas limpiar --anteriores-a 30d --confirmar", reason: "formato valido: <numero>d|h|m" }]);
  const n = Number(m[1]);
  return n * (m[2] === "d" ? 86400000 : m[2] === "h" ? 3600000 : 60000);
};

export const comandoTareasLimpiar = defineCommand({
  meta: { name: "limpiar", description: "Eliminar ejecuciones terminales antiguas" },
  args: {
    anterioresA: { type: "string" as const, default: "30d", description: "Eliminar ejecuciones anteriores a esta duración (30d, 12h, 10m)" },
    confirmar: { type: "boolean" as const, default: false, description: "Ejecutar la limpieza sin confirmación" },
    output: { type: "string" as const, default: "json", description: "json|markdown|human" },
  },
  run({ args }) {
    const formato = String(args.output ?? "json") as FormatoSalida;
    const app = crearAplicacion();
    try {
      const umbralMs = Date.now() - duracion(String(args.anterioresA));
      const todas = app.repositorioContexto.listarEjecucionesChat();
      const candidatas = todas.filter((e) => e.creadaEn < umbralMs);
      if (!args.confirmar) {
        const preview = {
          anterioresA: String(args.anterioresA),
          umbralMs,
          totalEjecuciones: todas.length,
          candidatasEliminables: candidatas.length,
          ejemplo: candidatas.slice(0, 5).map((e) => ({ id: e.id, estado: e.estado, proveedor: e.proveedor, modelo: e.modelo, creadaEn: new Date(e.creadaEn).toISOString() })),
          siguientePaso: candidatas.length > 0 ? "capi tareas limpiar --anteriores-a " + String(args.anterioresA) + " --confirmar" : "Nada que limpiar",
        };
        process.stdout.write(serializarSalida(crearSobreExito("tasks.clean.dry-run", preview), formato === "human" ? "markdown" : formato) + "\n");
        return;
      }
      const eliminadas = app.repositorioContexto.limpiarEjecucionesChat(umbralMs);
      process.stdout.write(serializarSalida(crearSobreExito("tasks.clean", { anterioresA: String(args.anterioresA), eliminadas, restantes: todas.length - eliminadas }), formato === "human" ? "markdown" : formato) + "\n");
    } catch (error) {
      if (error instanceof ErrorArgumentosInvalidos) {
        process.stdout.write(serializarSalida(crearSobreError("tasks.clean", error), formato === "human" ? "markdown" : formato) + "\n");
        process.exitCode = 1;
        return;
      }
      throw error;
    } finally {
      app.repositorioContexto.cerrar();
    }
  },
});
