import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { crearAplicacion } from "../cli/composicion/crearAplicacion";
import { obtenerManifestAgente, obtenerEsquemaComando } from "../cli/agente/ManifestAgente";
import { obtenerDiffGit } from "../../modulos/contexto/aplicacion/ObtenerDiffGit";
import { seleccionarContextoAutomatico } from "../../modulos/contexto/aplicacion/SeleccionarContextoAutomatico";
import { resolverPresupuestoContexto } from "../../modulos/contexto/aplicacion/ResolverPresupuestoContexto";
import { explicarContexto } from "../../modulos/contexto/aplicacion/ExplicarContexto";

function textoJson(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> }; }

export function crearServidorMcp(): McpServer {
  const server = new McpServer({ name: "capi", version: "2.4.0" });

  server.registerTool("capi_discover", {
    description: "Descubre todas las capacidades de CAPI, modelos, fallbacks, formatos, errores y comandos. Úsala primero cuando no conozcas la interfaz.", inputSchema: {},
  }, async () => textoJson(obtenerManifestAgente()));

  server.registerTool("capi_schema", {
    description: "Obtiene el contrato exacto de un comando CAPI antes de invocarlo. Evita inventar argumentos o asumir efectos.",
    inputSchema: { command: z.string().describe("Nombre canónico, por ejemplo chat.send, doctor o project.current") },
  }, async ({ command }) => { const schema = obtenerEsquemaComando(command); return schema ? textoJson(schema) : { isError: true, content: [{ type: "text" as const, text: `Comando desconocido: ${command}` }] }; });

  server.registerTool("capi_project_current", {
    description: "Devuelve el proyecto detectado desde el directorio de trabajo y sus preferencias persistidas. No abre el navegador.", inputSchema: {},
  }, async () => { const app = crearAplicacion(); const project = app.gestorContexto.proyectoActual(); return textoJson({ project, preferences: app.repositorioContexto.obtenerPreferencias(project.id) }); });

  server.registerTool("capi_conversations_project", {
    description: "Lista conversaciones del proyecto actual. Prioriza la ruta actual y luego rutas vinculadas; informa principal, favorita, archivada y ocupada.",
    inputSchema: { includeArchived: z.boolean().optional().default(false) },
  }, async ({ includeArchived }) => { const app = crearAplicacion(); const project = app.gestorContexto.proyectoActual(); const conversations = app.repositorioContexto.listarConversacionesProyecto(project.id).filter(c => includeArchived || !c.archivada); return textoJson({ project, conversations }); });

  server.registerTool("capi_doctor", {
    description: "Diagnostica proyecto, SQLite, bloqueos, WebBridge, Qwen y DeepSeek. Úsala antes de culpar al proveedor o modificar selectores.", inputSchema: {},
  }, async () => textoJson(await crearAplicacion().diagnosticarCompleto.ejecutar()));


  server.registerTool("capi_context_pack", {
    description: "Combina archivos, directorios, globs y opcionalmente git diff en un único .txt seguro, cacheado y con límite estricto. Úsala para inspeccionar el contexto antes de enviarlo.",
    inputSchema: {
      sources: z.array(z.string()).min(1).describe("Rutas o globs relativos al proyecto"),
      includeGitDiff: z.boolean().optional().default(false),
      maxBytes: z.number().int().min(1024).optional().default(4 * 1024 * 1024),
    },
  }, async ({ sources, includeGitDiff, maxBytes }) => {
    const app = crearAplicacion();
    const project = app.gestorContexto.proyectoActual();
    const diff = includeGitDiff ? obtenerDiffGit(project.rutaRaiz) : "";
    const bundle = await app.empaquetadorContexto.empaquetar({
      cwd: project.rutaRaiz,
      fuentes: sources,
      maxBytes,
      contenidoAdicional: diff ? [{ nombre: "git-diff.patch", contenido: diff }] : undefined,
    });
    return textoJson({ project: project.nombre, bundle });
  });

  server.registerTool("capi_context_explain", {
    description: "Explica presupuesto, selección automática, inclusiones, omisiones y truncamientos antes de enviar contexto.",
    inputSchema: { sources: z.array(z.string()).optional().default([]), automatic: z.boolean().optional().default(false), includeGitDiff: z.boolean().optional().default(false), provider: z.enum(["qwen", "deepseek"]).optional().default("deepseek"), model: z.string().optional(), maxBytes: z.number().int().min(1024).optional() },
  }, async ({ sources, automatic, includeGitDiff, provider, model, maxBytes }) => {
    const app = crearAplicacion(); const project = app.gestorContexto.proyectoActual();
    const auto = automatic ? seleccionarContextoAutomatico(project.rutaRaiz) : { fuentes: [], motivos: {} };
    const selected = [...new Set([...sources, ...auto.fuentes])];
    const budget = resolverPresupuestoContexto(provider, model, maxBytes);
    const diff = includeGitDiff ? obtenerDiffGit(project.rutaRaiz) : "";
    const bundle = await app.empaquetadorContexto.empaquetar({ cwd: project.rutaRaiz, fuentes: selected, maxBytes: budget.maxBytes, motivos: auto.motivos, contenidoAdicional: diff ? [{ nombre: "git-diff.patch", contenido: diff }] : undefined });
    return textoJson({ project, budget, automaticSelection: auto, explanation: explicarContexto(bundle) });
  });

  server.registerTool("capi_history_project", {
    description: "Lista ejecuciones recientes con proveedor, modelo, conversación, rama, commit, contexto y estado.",
    inputSchema: { limit: z.number().int().min(1).max(200).optional().default(20) },
  }, async ({ limit }) => textoJson(crearAplicacion().consultarHistorialProyecto.ejecutar(limit)));

  server.registerTool("capi_diagnostics_contracts", {
    description: "Comprueba contratos reales de disponibilidad y modelos de Qwen y DeepSeek.", inputSchema: {},
  }, async () => textoJson(await crearAplicacion().verificarContratosProveedor.ejecutar()));

  server.registerTool("capi_chat", {
    description: "Envía un prompt al proveedor con contexto automático por proyecto. Reutiliza conversaciones libres, usa leases, reintenta alta demanda y degrada modelos. En DeepSeek cualquier degradación abre obligatoriamente un chat nuevo.",
    inputSchema: {
      prompt: z.string().min(1).describe("Instrucción completa y autosuficiente"),
      provider: z.enum(["qwen", "deepseek"]).optional(), model: z.string().optional(), conversationId: z.string().optional(),
      newConversation: z.boolean().optional().default(false), reasoning: z.boolean().optional(), webSearch: z.boolean().optional(),
      files: z.array(z.string()).optional().describe("Archivos, directorios o globs; CAPI los empaqueta en un solo .txt"), automaticContext: z.boolean().optional().default(false), incrementalContext: z.boolean().optional().default(false), includeConversationSummary: z.boolean().optional().default(false), includeGitDiff: z.boolean().optional().default(false), maxContextBytes: z.number().int().min(1024).optional().default(4 * 1024 * 1024), fallback: z.boolean().optional().default(true), dryRun: z.boolean().optional().default(false),
    },
  }, async (input) => {
    const app = crearAplicacion(); const project = app.gestorContexto.proyectoActual(); const prefs = app.repositorioContexto.obtenerPreferencias(project.id);
    const provider = input.provider ?? prefs?.proveedor ?? "deepseek"; const model = input.model ?? prefs?.modelo;
    const selection = app.gestorContexto.seleccionar(provider, input.conversationId).seleccion;
    if (input.dryRun) return textoJson({ dryRun: true, project, provider, model: model ?? "default", selection: input.newConversation ? { motivo: "nueva" } : selection, fallback: input.fallback, context: { sources: input.files ?? [], automatic: input.automaticContext, incremental: input.incrementalContext, includeConversationSummary: input.includeConversationSummary, includeGitDiff: input.includeGitDiff, maxBytes: input.maxContextBytes, bundledAsSingleTextFile: true } });
    let response = "", reasoning = "", activeModel: string | undefined, conversationId: string | undefined; let context: Record<string, unknown> | undefined; const progress: string[] = [];
    try {
      for await (const event of app.enviarMensaje.ejecutar(provider, { prompt: input.prompt, modelo: model, conversacionId: input.conversationId, forzarNueva: input.newConversation, permitirFallback: input.fallback, archivos: input.files, contexto: { incluirDiff: input.includeGitDiff, maxBytes: input.maxContextBytes, automatico: input.automaticContext, incremental: input.incrementalContext, incluirResumen: input.includeConversationSummary }, opciones: { razonamiento: input.reasoning ?? prefs?.razonamiento, busquedaWeb: input.webSearch ?? prefs?.busquedaWeb } })) {
        if (event.tipo === "respuesta") response += event.contenido; else if (event.tipo === "pensamiento") reasoning += event.contenido; else if (event.tipo === "modelo") activeModel = event.nombre; else if (event.tipo === "conversacion") conversationId = event.id; else if (event.tipo === "contexto") context = { path: event.ruta, bytes: event.bytes, estimatedTokens: event.tokensEstimados, includedFiles: event.archivosIncluidos, omittedFiles: event.omitidos, truncatedFiles: event.truncados, fromCache: event.desdeCache }; else if (event.tipo === "inicio" && event.mensaje) progress.push(event.mensaje);
      }
      return textoJson({ response, reasoning: reasoning || undefined, provider, model: activeModel ?? model, conversationId, project: project.nombre, context, progress });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error); const alternative = provider === "qwen" ? "deepseek" : "qwen";
      return { isError: true, content: [{ type: "text" as const, text: `${message}\nSugerencia: vuelve a invocar capi_chat con provider=${alternative}.` }] };
    }
  });
  return server;
}

export async function iniciarServidorMcp(): Promise<void> { const server = crearServidorMcp(); await server.connect(new StdioServerTransport()); }
