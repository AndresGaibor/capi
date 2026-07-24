import { defineCommand } from "citty";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { interpretarFuentesContexto } from "../../../../modulos/contexto/aplicacion/InterpretarFuentesContexto";
import { obtenerDiffGit } from "../../../../modulos/contexto/aplicacion/ObtenerDiffGit";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";

export const comandoContextoEmpaquetar = defineCommand({
  meta: { name: "empaquetar", description: "Combinar archivos, directorios, globs y diff Git en un único .txt seguro" },
  args: {
    fuentes: { type: "positional", default: ".", description: "Lista separada por comas, JSON o @archivo-lista" },
    diff: { type: "boolean", description: "Incluir cambios staged y unstaged" },
    limite: { type: "string", description: "Máximo en bytes", default: String(4 * 1024 * 1024) },
    output: { type: "string", alias: "o", default: "human", description: "human|markdown|json" },
  },
  async run({ args }) {
    const app = crearAplicacion();
    const proyecto = app.gestorContexto.proyectoActual();
    const diff = args.diff ? obtenerDiffGit(proyecto.rutaRaiz) : "";
    const resultado = await app.empaquetadorContexto.empaquetar({
      cwd: proyecto.rutaRaiz,
      fuentes: interpretarFuentesContexto(String(args.fuentes)),
      maxBytes: Number(args.limite),
      contenidoAdicional: diff ? [{ nombre: "git-diff.patch", contenido: diff }] : undefined,
    });
    const formato = String(args.output) as FormatoSalida;
    if (formato === "human") {
      process.stdout.write(`${resultado.ruta}\n${resultado.archivosIncluidos} archivo(s), ${resultado.bytes} bytes, ~${resultado.tokensEstimados} tokens\n`);
      return;
    }
    process.stdout.write(serializarSalida(crearSobreExito("context.pack", resultado), formato) + "\n");
  },
});
