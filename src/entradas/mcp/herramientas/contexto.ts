import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { crearAplicacion } from "../../cli/composicion/crearAplicacion";
import { obtenerDiffGit } from "../../../modulos/contexto/aplicacion/ObtenerDiffGit";
import { seleccionarContextoAutomatico } from "../../../modulos/contexto/aplicacion/SeleccionarContextoAutomatico";
import { resolverPresupuestoContexto } from "../../../modulos/contexto/aplicacion/ResolverPresupuestoContexto";
import { explicarContexto } from "../../../modulos/contexto/aplicacion/ExplicarContexto";

function textoJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function registrarHerramientasContexto(server: McpServer): void {
  server.registerTool(
    "capi_context_pack",
    {
      description:
        "Combina archivos, directorios, globs y opcionalmente git diff en un único .txt seguro, cacheado y con límite estricto. Úsala para inspeccionar el contexto antes de enviarlo.",
      inputSchema: {
        sources: z
          .array(z.string())
          .min(1)
          .describe("Rutas o globs relativos al proyecto"),
        includeGitDiff: z.boolean().optional().default(false),
        maxBytes: z
          .number()
          .int()
          .min(1024)
          .optional()
          .default(4 * 1024 * 1024),
      },
    },
    async ({ sources, includeGitDiff, maxBytes }) => {
      const app = crearAplicacion();
      const project = app.gestorContexto.proyectoActual();
      const diff = includeGitDiff ? obtenerDiffGit(project.rutaRaiz) : "";
      const bundle = await app.empaquetadorContexto.empaquetar({
        cwd: project.rutaRaiz,
        fuentes: sources,
        maxBytes,
        contenidoAdicional: diff
          ? [{ nombre: "git-diff.patch", contenido: diff }]
          : undefined,
      });
      return textoJson({ project: project.nombre, bundle });
    },
  );

  server.registerTool(
    "capi_context_explain",
    {
      description:
        "Explica presupuesto, selección automática, inclusiones, omisiones y truncamientos antes de enviar contexto.",
      inputSchema: {
        sources: z.array(z.string()).optional().default([]),
        automatic: z.boolean().optional().default(false),
        includeGitDiff: z.boolean().optional().default(false),
        provider: z.enum(["qwen", "deepseek", "chatgpt"]).optional().default("deepseek"),
        model: z.string().optional(),
        maxBytes: z.number().int().min(1024).optional(),
      },
    },
    async ({
      sources,
      automatic,
      includeGitDiff,
      provider,
      model,
      maxBytes,
    }) => {
      const app = crearAplicacion();
      const project = app.gestorContexto.proyectoActual();
      const auto = automatic
        ? seleccionarContextoAutomatico(project.rutaRaiz)
        : { fuentes: [], motivos: {} };
      const selected = [...new Set([...sources, ...auto.fuentes])];
      const budget = resolverPresupuestoContexto(provider, model, maxBytes);
      const diff = includeGitDiff ? obtenerDiffGit(project.rutaRaiz) : "";
      const bundle = await app.empaquetadorContexto.empaquetar({
        cwd: project.rutaRaiz,
        fuentes: selected,
        maxBytes: budget.maxBytes,
        caracteresPorToken: budget.caracteresPorToken,
        motivos: auto.motivos,
        contenidoAdicional: diff
          ? [{ nombre: "git-diff.patch", contenido: diff }]
          : undefined,
      });
      return textoJson({
        project,
        budget,
        automaticSelection: auto,
        explanation: explicarContexto(bundle),
      });
    },
  );
}
