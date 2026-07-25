import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { crearAplicacion } from "../../cli/composicion/crearAplicacion";

function textoJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function registrarHerramientasChat(server: McpServer): void {
  server.registerTool(
    "capi_chat",
    {
      description:
        "Envía un prompt al proveedor con contexto automático por proyecto. Reutiliza conversaciones libres, usa leases, reintenta alta demanda y degrada modelos. En DeepSeek cualquier degradación abre obligatoriamente un chat nuevo.",
      inputSchema: {
        prompt: z
          .string()
          .min(1)
          .describe("Instrucción completa y autosuficiente"),
        provider: z.enum(["qwen", "deepseek", "chatgpt"]).optional(),
        model: z.string().optional(),
        conversationId: z.string().optional(),
        newConversation: z.boolean().optional().default(false),
        reasoning: z.boolean().optional(),
        webSearch: z.boolean().optional(),
        files: z
          .array(z.string())
          .optional()
          .describe(
            "Archivos, directorios o globs; solo los textuales se empaquetan",
          ),
        images: z
          .array(z.string())
          .max(10)
          .optional()
          .describe("Imágenes PNG, JPEG, WebP o GIF enviadas nativamente"),
        automaticContext: z.boolean().optional().default(false),
        incrementalContext: z.boolean().optional().default(false),
        includeConversationSummary: z.boolean().optional().default(false),
        includeGitDiff: z.boolean().optional().default(false),
        maxContextBytes: z
          .number()
          .int()
          .min(1024)
          .optional()
          .default(4 * 1024 * 1024),
        fallback: z.boolean().optional().default(true),
        timeoutMs: z.number().int().min(1000).max(86400000).optional(),
        dryRun: z.boolean().optional().default(false),
      },
    },
    async (input) => {
      const app = crearAplicacion();
      const project = app.gestorContexto.proyectoActual();
      const prefs = app.repositorioContexto.obtenerPreferencias(project.id);
      const provider = input.provider ?? prefs?.proveedor ?? "deepseek";
      const model = input.model ?? prefs?.modelo;
      const selection = app.gestorContexto.seleccionar(
        provider,
        input.conversationId,
      ).seleccion;
      if (input.dryRun)
        return textoJson({
          dryRun: true,
          project,
          provider,
          model: model ?? "default",
          selection: input.newConversation ? { motivo: "nueva" } : selection,
          fallback: input.fallback,
          context: {
            sources: input.files ?? [],
            images: input.images ?? [],
            automatic: input.automaticContext,
            incremental: input.incrementalContext,
            includeConversationSummary: input.includeConversationSummary,
            includeGitDiff: input.includeGitDiff,
            maxBytes: input.maxContextBytes,
            bundledAsSingleTextFile: true,
          },
        });
      let response = "",
        reasoning = "",
        activeModel: string | undefined,
        conversationId: string | undefined;
      let context: Record<string, unknown> | undefined;
      const progress: string[] = [];
      try {
        for await (const event of app.enviarMensaje.ejecutar(provider, {
          prompt: input.prompt,
          modelo: model,
          conversacionId: input.conversationId,
          forzarNueva: input.newConversation,
          permitirFallback: input.fallback,
          timeoutMs: input.timeoutMs,
          archivos: input.files,
          imagenes: input.images,
          contexto: {
            incluirDiff: input.includeGitDiff,
            maxBytes: input.maxContextBytes,
            automatico: input.automaticContext,
            incremental: input.incrementalContext,
            incluirResumen: input.includeConversationSummary,
          },
          opciones: {
            razonamiento: input.reasoning ?? prefs?.razonamiento,
            busquedaWeb: input.webSearch ?? prefs?.busquedaWeb,
          },
        })) {
          if (event.tipo === "respuesta") response += event.contenido;
          else if (event.tipo === "pensamiento") reasoning += event.contenido;
          else if (event.tipo === "modelo") activeModel = event.nombre;
          else if (event.tipo === "conversacion") conversationId = event.id;
          else if (event.tipo === "contexto")
            context = {
              path: event.ruta,
              bytes: event.bytes,
              estimatedTokens: event.tokensEstimados,
              includedFiles: event.archivosIncluidos,
              omittedFiles: event.omitidos,
              truncatedFiles: event.truncados,
              fromCache: event.desdeCache,
            };
          else if (event.tipo === "inicio" && event.mensaje)
            progress.push(event.mensaje);
        }
        return textoJson({
          response,
          reasoning: reasoning || undefined,
          provider,
          model: activeModel ?? model,
          conversationId,
          project: project.nombre,
          context,
          progress,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const alternative = provider === "qwen" ? "deepseek" : "qwen";
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `${message}\nSugerencia: vuelve a invocar capi_chat con provider=${alternative}.`,
            },
          ],
        };
      }
    },
  );
}
