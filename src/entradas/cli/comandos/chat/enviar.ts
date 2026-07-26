import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { RenderizadorStreaming } from "../../../../plataforma/consola/RenderizadorStreaming";
import { RenderizadorAgenteStreaming } from "../../agente/RenderizadorAgenteStreaming";
import { crearSobreError, crearSobreExito, codigoSalidaParaError, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
import { sugerenciaProveedorAlternativo } from "../../../../modulos/chat/aplicacion/PoliticaRecuperacionProveedor";
import { interpretarFuentesContexto } from "../../../../modulos/contexto/aplicacion/InterpretarFuentesContexto";
import { separarAdjuntosContexto } from "../../../../modulos/contexto/aplicacion/SepararAdjuntosContexto";
import { spawn } from "node:child_process";
import { identidadProceso } from "../../../../plataforma/procesos/IdentidadProceso";
import { CAPI_CONFIG } from "../../../../configuracion/ConstantesCapi";
import { ErrorArgumentosInvalidos } from "../../../../nucleo/errores/ErroresAplicacion";

function normalizarConversacionId(valor: string): string {
  try {
    const url = new URL(valor);
    if (url.hostname === "chat.qwen.ai" || url.hostname === "qwen.ai") {
      const match = url.pathname.match(/\/c\/([^/?#]+)/);
      if (match) return match[1]!;
    }
    if (url.hostname === "chat.deepseek.com" || url.hostname === "deepseek.com") {
      const match = url.pathname.match(/(?:\/chat\/|\/a\/chat\/s\/)([^/?#]+)/);
      if (match) return match[1]!;
    }
  } catch {}
  return valor;
}

export const argumentosChat = {
  prompt: { type: "positional" as const, required: false, description: "Prompt" },
  proveedor: { type: "string" as const, alias: "p" },
  conversacion: { type: "string" as const, alias: "c" },
  modelo: { type: "string" as const, alias: "m" },
  razonamiento: { type: "boolean" as const }, busqueda: { type: "boolean" as const }, archivo: { type: "string" as const, alias: "f", description: "Archivo, directorio, glob, JSON, lista por comas o @manifiesto" },
  imagen: { type: "string" as const, alias: "i", description: "Imagen; puede repetirse o aceptar coma, JSON y @manifiesto" },
  diff: { type: "boolean" as const, description: "Incluir git diff staged y unstaged" },
  limiteContexto: { type: "string" as const, description: "Máximo del paquete de contexto en bytes" },
  empaquetar: { type: "boolean" as const, default: true, description: "Combinar fuentes en un único archivo de contexto" },
  contextoAuto: { type: "boolean" as const, default: false, description: "Seleccionar automáticamente archivos Git, imports y pruebas relacionadas" },
  incremental: { type: "boolean" as const, default: false, description: "Omitir archivos sin cambios ya enviados a la conversación" },
  resumen: { type: "boolean" as const, default: false, description: "Adjuntar el resumen persistente de la conversación" },
  nueva: { type: "boolean" as const, description: "Forzar una conversación nueva" },
  continuar: { type: "boolean" as const, description: "Solo hacer polling de la conversación actual sin enviar mensaje" },
  background: { type: "boolean" as const, description: "Ejecutar el envío como tarea de fondo" },
  fallback: { type: "boolean" as const, default: true, description: "Permitir reintentos y degradación inteligente" },
  output: { type: "string" as const, alias: "o", default: "markdown", description: "markdown|human|json|jsonl" },
  requestId: { type: "string" as const, description: "Identificador correlacionable de la petición" },
  dryRun: { type: "boolean" as const, description: "Explicar la selección sin navegar ni enviar" },
  explain: { type: "boolean" as const, description: "Incluir decisiones de proyecto, conversación y recuperación" },
  timeout: { type: "string" as const, description: "Cancelar cooperativamente el envío después de N milisegundos" },
};

const formatos = new Set(["human", "markdown", "json", "jsonl"]);
export function resolverConversacionParaChat(entrada: {
  explicita?: string;
  persistida?: string;
  forzarNueva: boolean;
}): string | undefined {
  if (entrada.forzarNueva) return undefined;
  return entrada.explicita ?? entrada.persistida;
}


export function recogerImagenesArgumentos(args: Record<string, unknown>, argv = process.argv.slice(2)): string[] {
  const valores: string[] = [];
  if (Array.isArray(args.imagenes)) valores.push(...args.imagenes.map(String));
  if (args.imagen) valores.push(String(args.imagen));
  for (let i = 0; i < argv.length; i++) {
    const actual = argv[i]!;
    if ((actual === "--imagen" || actual === "-i") && argv[i + 1]) valores.push(argv[++i]!);
    else if (actual.startsWith("--imagen=")) valores.push(actual.slice("--imagen=".length));
  }
  return [...new Set(valores.flatMap(valor => interpretarFuentesContexto(valor)))];
}


export async function ejecutarChat(args: Record<string, unknown>): Promise<void> {
  const formato = String(args.output ?? "human") as FormatoSalida;
  const requestId = args.requestId ? String(args.requestId) : crypto.randomUUID();
  if (!formatos.has(formato)) throw new ErrorArgumentosInvalidos(`Formato no soportado: ${formato}. Usa human, markdown, json o jsonl.`,[{command:"capi chat enviar \"texto\" --output jsonl",reason:"formato valido para agentes"}]);
  const tareaId = process.env.CAPI_TASK_ID;
  const app = crearAplicacion();
  const proyecto = app.gestorContexto.proyectoActual();
  const preferencias = app.repositorioContexto.obtenerPreferencias(proyecto.id);
  const proveedor = args.proveedor ? String(args.proveedor) : preferencias?.proveedor ?? "deepseek";
  const modelo = args.modelo ? String(args.modelo) : preferencias?.modelo;
  const continuar = Boolean(args.continuar);
  const prompt = String(args.prompt ?? "").trim();
  if (!continuar && !prompt) throw new ErrorArgumentosInvalidos("Debes proporcionar un prompt o usa --continuar para consultar una respuesta pendiente.",[{command:'capi chat enviar "tu prompt" --output jsonl',reason:"enviar un prompt"},{command:"capi chat --continuar -p <proveedor> --output json",reason:"solo hacer polling de una respuesta existente"}]);
  if (args.nueva && (args.conversacion || continuar)) throw new ErrorArgumentosInvalidos("--nueva no se puede combinar con --conversacion ni --continuar.",[{command:'capi chat enviar "tu prompt" --nueva',reason:"forzar nueva conversacion sin id"},{command:'capi chat enviar "tu prompt" --conversacion <id>',reason:"reanudar una conversacion existente"}]);
  if (continuar && (prompt || args.nueva || args.archivo || args.imagen)) throw new ErrorArgumentosInvalidos("--continuar solo hace polling: no acepta prompt, archivos, imágenes ni --nueva.",[{command:"capi chat --continuar -p <proveedor> --output json",reason:"observar sin enviar nuevo prompt"}]);
  const conversacionExplicita = args.conversacion ? normalizarConversacionId(String(args.conversacion)) : undefined;
  const seleccion = app.gestorContexto.seleccionar(proveedor, conversacionExplicita).seleccion;
  const conversacionId = resolverConversacionParaChat({
    explicita: conversacionExplicita,
    persistida: seleccion.conversacionId,
    forzarNueva: Boolean(args.nueva),
  });
  const imagenes = continuar ? [] : recogerImagenesArgumentos(args);

  if (continuar && !conversacionId) throw new ErrorArgumentosInvalidos("No se encontró una conversación activa. Usa --conversacion URL_O_ID.",[{command:"capi chat --continuar --conversacion https://chatgpt.com/c/<uuid>",reason:"reanudar la conversacion explicita"},{command:"capi conversaciones proyecto --output json",reason:"listar las conversaciones disponibles"}]);
  if (args.background && !process.env.CAPI_TASK_CHILD) {
    const id = crypto.randomUUID();
    const identidad = identidadProceso();
    const argumentos = process.argv.slice(2).filter((argumento) => argumento !== "--background" && !argumento.startsWith("--background="));
    app.repositorioContexto.crearEjecucionChat({ id, proyectoLocalId: proyecto.id, proveedor, modelo, conversacionId, estado: "creada", propietarioId: identidad.propietarioId, pid: identidad.pid, hostname: identidad.hostname, bootId: identidad.bootId, modo: "background", comandoJson: JSON.stringify(argumentos) });
    app.repositorioContexto.anexarEventoEjecucion(id,"tarea_background_creada",{argumentos:argumentos.map((a)=>a.startsWith("--")?a:"[ARG]")});
    app.repositorioContexto.cerrar();
    const hijo = spawn(process.execPath, [process.argv[1]!, ...argumentos], { detached: true, stdio: "ignore", env: { ...process.env, CAPI_TASK_CHILD: "1", CAPI_TASK_ID: id } });
    hijo.unref();
    process.stdout.write(`${JSON.stringify({ taskId:id, estado:"creada", comando:`capi tareas estado ${id}` })}\n`);
    return;
  }

  if (args.dryRun) {
    const fuentes = continuar ? [] : interpretarFuentesContexto(args.archivo ? String(args.archivo) : undefined);
    const clasificacion = separarAdjuntosContexto([...fuentes, ...imagenes]);
    const plan = { project: proyecto, provider: proveedor, model: modelo ?? "auto", selection: args.nueva ? { motivo: "nueva" } : seleccion, fallback: Boolean(args.fallback), context: { sources: fuentes, images: imagenes, classification: { text: clasificacion.textuales, images: clasificacion.imagenes, documents: clasificacion.documentos, rejected: clasificacion.rechazados }, automatic: Boolean(args.contextoAuto), incremental: Boolean(args.incremental), includeSummary: Boolean(args.resumen), includeGitDiff: Boolean(args.diff), maxBytes: args.limiteContexto ? Number(args.limiteContexto) : undefined, bundledAsSingleTextFile: args.empaquetar !== false }, actions: continuar ? ["seleccionar conversación", "navegar proveedor", "polling respuesta"] : ["seleccionar conversación", "preparar contexto", "adquirir lease", "navegar proveedor", "enviar prompt", "registrar conversación"] };
    const sobre = crearSobreExito("chat.send.dry-run", plan, { requestId });
    process.stdout.write(serializarSalida(sobre, formato === "human" ? "markdown" : formato) + "\n");
    if (tareaId) {
      const identidad = identidadProceso();
      const ahora = Date.now();
      app.repositorioContexto.actualizarEjecucionChat(tareaId,{estado:"completada",completadaEn:ahora,cancelacionSolicitada:false,propietarioId:identidad.propietarioId,pid:identidad.pid,hostname:identidad.hostname,bootId:identidad.bootId},ahora);
      app.repositorioContexto.anexarEventoEjecucion(tareaId,"dry_run_completado",{},ahora);
    }
    app.repositorioContexto.cerrar();
    return;
  }

  try {
    const promptEnvio = continuar ? "continuar" : prompt;
    const eventos = app.enviarMensaje.ejecutar(proveedor, {
      conversacionId, prompt: promptEnvio, modelo,
      archivos: continuar ? undefined : interpretarFuentesContexto(args.archivo ? String(args.archivo) : undefined),
      imagenes,
      contexto: { incluirDiff: Boolean(args.diff), maxBytes: args.limiteContexto ? Number(args.limiteContexto) : undefined, empaquetar: args.empaquetar !== false, automatico: Boolean(args.contextoAuto), incremental: Boolean(args.incremental), incluirResumen: Boolean(args.resumen) },
      forzarNueva: Boolean(args.nueva), permitirFallback: Boolean(args.fallback), timeoutMs: args.timeout ? Number(args.timeout) : CAPI_CONFIG.TIMEOUTS_MS.CHAT_POR_DEFECTO_MS,
      opciones: { razonamiento: args.razonamiento === undefined ? preferencias?.razonamiento : Boolean(args.razonamiento), busquedaWeb: args.busqueda === undefined ? preferencias?.busquedaWeb : Boolean(args.busqueda) },
      soloPoll: continuar,
    });
    if (formato === "human") {
      const renderizador = new RenderizadorStreaming();
      if (args.explain) consola.info(`Proyecto=${proyecto.nombre}; proveedor=${proveedor}; modelo=${modelo ?? "predeterminado"}; selección=${seleccion.motivo}${continuar ? " (solo polling)" : ""}`);
      let pausada = false;
      for await (const evento of eventos) { pausada ||= evento.tipo === "pausado"; renderizador.renderizar(evento); }
    } else {
      const renderizador = new RenderizadorAgenteStreaming("chat.send", formato, requestId);
      let pausada = false;
      for await (const evento of eventos) { pausada ||= evento.tipo === "pausado"; renderizador.renderizar(evento); }
    }
  } catch (error) {
    if (tareaId) {
      const ahora = Date.now();
      const actual = app.repositorioContexto.obtenerEjecucionChat(tareaId);
      if (actual?.estado !== "cancelada") {
        app.repositorioContexto.actualizarEjecucionChat(tareaId,{estado:"fallida",completadaEn:ahora,errorDetalle:error instanceof Error?error.message:String(error)},ahora);
        app.repositorioContexto.anexarEventoEjecucion(tareaId,"fallo_temprano",{mensaje:error instanceof Error?error.message:String(error)},ahora);
      }
    }
    if (formato === "human") { consola.error(error instanceof Error ? error.message : String(error)); consola.info(sugerenciaProveedorAlternativo(proveedor)); }
    else {
      const alternativa = proveedor === "qwen" ? "deepseek" : "qwen";
      const rawPrompt = String(args.prompt || "").trim();
      const sugerenciaPrompt = (rawPrompt && rawPrompt.toLowerCase() !== "send") ? rawPrompt : "tu mensaje";
      const sobre = crearSobreError("chat.send", error, { requestId, suggestions: [{ command: `capi chat -p ${alternativa} --output jsonl ${JSON.stringify(sugerenciaPrompt)}`, reason: "usar el proveedor alternativo" }] });
      process.stdout.write(serializarSalida(sobre, formato === "jsonl" ? "jsonl" : formato) + "\n");
      process.exitCode = codigoSalidaParaError(sobre.error?.code);
    }
  }
}

export const comandoChatEnviar = defineCommand({ meta: { name: "enviar", description: "Enviar un mensaje con contexto y contrato agent-first" }, args: argumentosChat, run: ({ args }) => ejecutarChat(args) });
