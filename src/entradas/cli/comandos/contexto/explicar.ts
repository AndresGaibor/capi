import { defineCommand } from "citty";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { interpretarFuentesContexto } from "../../../../modulos/contexto/aplicacion/InterpretarFuentesContexto";
import { seleccionarContextoAutomatico } from "../../../../modulos/contexto/aplicacion/SeleccionarContextoAutomatico";
import { resolverPresupuestoContexto } from "../../../../modulos/contexto/aplicacion/ResolverPresupuestoContexto";
import { explicarContexto } from "../../../../modulos/contexto/aplicacion/ExplicarContexto";
import { obtenerDiffGit } from "../../../../modulos/contexto/aplicacion/ObtenerDiffGit";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";

export const comandoContextoExplicar = defineCommand({
  meta: { name: "explicar", description: "Explicar qué contexto se incluiría, omitiría o truncaría" },
  args: {
    fuentes: { type: "positional", default: "", description: "Rutas, globs, JSON o @manifiesto" },
    automatico: { type: "boolean", default: false },
    diff: { type: "boolean", default: false },
    proveedor: { type: "string", alias: "p", default: "deepseek" },
    modelo: { type: "string", alias: "m" },
    limite: { type: "string" },
    output: { type: "string", alias: "o", default: "human" },
  },
  async run({ args }) {
    const app = crearAplicacion();
    const proyecto = app.gestorContexto.proyectoActual();
    const auto = args.automatico ? seleccionarContextoAutomatico(proyecto.rutaRaiz) : { fuentes: [], motivos: {} };
    const fuentes = [...new Set([...interpretarFuentesContexto(String(args.fuentes ?? "")), ...auto.fuentes])];
    const presupuesto = resolverPresupuestoContexto(String(args.proveedor), args.modelo ? String(args.modelo) : undefined, args.limite ? Number(args.limite) : undefined);
    const diff = args.diff ? obtenerDiffGit(proyecto.rutaRaiz) : "";
    const paquete = await app.empaquetadorContexto.empaquetar({ cwd: proyecto.rutaRaiz, fuentes, maxBytes: presupuesto.maxBytes, motivos: auto.motivos, contenidoAdicional: diff ? [{ nombre: "git-diff.patch", contenido: diff }] : undefined });
    const resultado = { proyecto, presupuesto, seleccionAutomatica: auto, explicacion: explicarContexto(paquete) };
    const formato = String(args.output) as FormatoSalida;
    if (formato === "human") {
      process.stdout.write(`Presupuesto: ${presupuesto.maxBytes} bytes (${presupuesto.origen})\nIncluidos: ${paquete.archivos.length}; omitidos: ${paquete.omitidos.length}; truncados: ${paquete.truncados.length}\n${paquete.archivos.map(a => `+ ${a.ruta}: ${a.motivo}`).join("\n")}\n${paquete.omitidos.map(a => `- ${a.ruta}: ${a.motivo}`).join("\n")}\n`);
      return;
    }
    process.stdout.write(serializarSalida(crearSobreExito("context.explain", resultado), formato) + "\n");
  },
});
