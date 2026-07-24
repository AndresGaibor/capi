import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { RenderizadorStreaming } from "../../../../plataforma/consola/RenderizadorStreaming";
import { RenderizadorAgenteStreaming } from "../../agente/RenderizadorAgenteStreaming";
import { crearSobreError, crearSobreExito, codigoSalidaParaError, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
import { sugerenciaProveedorAlternativo } from "../../../../modulos/chat/aplicacion/PoliticaRecuperacionProveedor";
import { interpretarFuentesContexto } from "../../../../modulos/contexto/aplicacion/InterpretarFuentesContexto";

export const argumentosChat = {
  prompt: { type: "positional" as const, required: true, description: "Prompt" },
  proveedor: { type: "string" as const, alias: "p" },
  conversacion: { type: "string" as const, alias: "c" },
  modelo: { type: "string" as const, alias: "m" },
  razonamiento: { type: "boolean" as const }, busqueda: { type: "boolean" as const }, archivo: { type: "string" as const, alias: "f", description: "Archivo, directorio, glob, JSON, lista por comas o @manifiesto" },
  diff: { type: "boolean" as const, description: "Incluir git diff staged y unstaged" },
  limiteContexto: { type: "string" as const, description: "Máximo del paquete de contexto en bytes" },
  empaquetar: { type: "boolean" as const, default: true, description: "Combinar fuentes en un único archivo de contexto" },
  nueva: { type: "boolean" as const, description: "Forzar una conversación nueva" },
  fallback: { type: "boolean" as const, default: true, description: "Permitir reintentos y degradación inteligente" },
  output: { type: "string" as const, alias: "o", default: "human", description: "human|markdown|json|jsonl" },
  requestId: { type: "string" as const, description: "Identificador correlacionable de la petición" },
  dryRun: { type: "boolean" as const, description: "Explicar la selección sin navegar ni enviar" },
  explain: { type: "boolean" as const, description: "Incluir decisiones de proyecto, conversación y recuperación" },
};

const formatos = new Set(["human", "markdown", "json", "jsonl"]);

export async function ejecutarChat(args: Record<string, unknown>): Promise<void> {
  const formato = String(args.output ?? "human") as FormatoSalida;
  const requestId = args.requestId ? String(args.requestId) : crypto.randomUUID();
  if (!formatos.has(formato)) throw new Error(`Formato no soportado: ${formato}`);
  const app = crearAplicacion();
  const proyecto = app.gestorContexto.proyectoActual();
  const preferencias = app.repositorioContexto.obtenerPreferencias(proyecto.id);
  const proveedor = args.proveedor ? String(args.proveedor) : preferencias?.proveedor ?? "deepseek";
  const modelo = args.modelo ? String(args.modelo) : preferencias?.modelo;
  const conversacionId = args.conversacion ? String(args.conversacion) : undefined;
  const seleccion = app.gestorContexto.seleccionar(proveedor, conversacionId).seleccion;

  if (args.dryRun) {
    const fuentes = interpretarFuentesContexto(args.archivo ? String(args.archivo) : undefined);
    const plan = { project: proyecto, provider: proveedor, model: modelo ?? "default", selection: args.nueva ? { motivo: "nueva" } : seleccion, fallback: Boolean(args.fallback), context: { sources: fuentes, includeGitDiff: Boolean(args.diff), maxBytes: args.limiteContexto ? Number(args.limiteContexto) : 4 * 1024 * 1024, bundledAsSingleTextFile: args.empaquetar !== false }, actions: ["seleccionar conversación", "preparar contexto", "adquirir lease", "navegar proveedor", "enviar prompt", "registrar conversación"] };
    const sobre = crearSobreExito("chat.send.dry-run", plan, { requestId });
    process.stdout.write(serializarSalida(sobre, formato === "human" ? "markdown" : formato) + "\n");
    return;
  }

  try {
    const eventos = app.enviarMensaje.ejecutar(proveedor, {
      conversacionId, prompt: String(args.prompt), modelo,
      archivos: interpretarFuentesContexto(args.archivo ? String(args.archivo) : undefined),
      contexto: { incluirDiff: Boolean(args.diff), maxBytes: args.limiteContexto ? Number(args.limiteContexto) : undefined, empaquetar: args.empaquetar !== false },
      forzarNueva: Boolean(args.nueva), permitirFallback: Boolean(args.fallback),
      opciones: { razonamiento: args.razonamiento === undefined ? preferencias?.razonamiento : Boolean(args.razonamiento), busquedaWeb: args.busqueda === undefined ? preferencias?.busquedaWeb : Boolean(args.busqueda) },
    });
    if (formato === "human") {
      const renderizador = new RenderizadorStreaming();
      if (args.explain) consola.info(`Proyecto=${proyecto.nombre}; proveedor=${proveedor}; modelo=${modelo ?? "predeterminado"}; selección=${seleccion.motivo}`);
      for await (const evento of eventos) renderizador.renderizar(evento);
    } else {
      const renderizador = new RenderizadorAgenteStreaming("chat.send", formato, requestId);
      for await (const evento of eventos) renderizador.renderizar(evento);
    }
  } catch (error) {
    if (formato === "human") { consola.error(error instanceof Error ? error.message : String(error)); consola.info(sugerenciaProveedorAlternativo(proveedor)); }
    else {
      const alternativa = proveedor === "qwen" ? "deepseek" : "qwen";
      const sobre = crearSobreError("chat.send", error, { requestId, suggestions: [{ command: `capi chat -p ${alternativa} --output jsonl ${JSON.stringify(String(args.prompt))}`, reason: "usar el proveedor alternativo" }] });
      process.stdout.write(serializarSalida(sobre, formato === "jsonl" ? "jsonl" : formato) + "\n");
      process.exitCode = codigoSalidaParaError(sobre.error?.code);
    }
  }
}

export const comandoChatEnviar = defineCommand({ meta: { name: "enviar", description: "Enviar un mensaje con contexto y contrato agent-first" }, args: argumentosChat, run: ({ args }) => ejecutarChat(args) });
