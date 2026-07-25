import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { crearAplicacion } from "../../cli/composicion/crearAplicacion";

function textoJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function registrarHerramientasEstado(server: McpServer): void {
  server.registerTool(
    "capi_doctor",
    {
      description:
        "Diagnostica proyecto, SQLite, bloqueos, WebBridge, Qwen y DeepSeek. Úsala antes de culpar al proveedor o modificar selectores.",
      inputSchema: {},
    },
    async () =>
      textoJson(await crearAplicacion().diagnosticarCompleto.ejecutar()),
  );

  server.registerTool(
    "capi_history_project",
    {
      description:
        "Lista ejecuciones recientes con proveedor, modelo, conversación, rama, commit, contexto y estado.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional().default(20),
      },
    },
    async ({ limit }) =>
      textoJson(crearAplicacion().consultarHistorialProyecto.ejecutar(limit)),
  );

  server.registerTool(
    "capi_diagnostics_contracts",
    {
      description:
        "Comprueba contratos reales de disponibilidad y modelos de Qwen y DeepSeek.",
      inputSchema: {},
    },
    async () =>
      textoJson(await crearAplicacion().verificarContratosProveedor.ejecutar()),
  );

  server.registerTool(
    "capi_state_metrics",
    {
      description:
        "Devuelve métricas agregadas del proyecto por proveedor y modelo.",
      inputSchema: {},
    },
    async () => {
      const app = crearAplicacion();
      const project = app.gestorContexto.proyectoActual();
      return textoJson({
        project,
        metrics: app.gestionarEstadoProyecto.metricas(project.id),
      });
    },
  );

  server.registerTool(
    "capi_state_clean",
    {
      description:
        "Limpia selectivamente caché, snapshots, historial o resúmenes del proyecto. Requiere confirm=true.",
      inputSchema: {
        layers: z
          .array(z.enum(["cache", "snapshots", "historial", "resumenes"]))
          .min(1),
        confirm: z.literal(true),
      },
    },
    async ({ layers }) => {
      const app = crearAplicacion();
      const project = app.gestorContexto.proyectoActual();
      return textoJson({
        project,
        deleted: app.gestionarEstadoProyecto.limpiar(project.id, layers),
      });
    },
  );

  server.registerTool(
    "capi_state_export",
    {
      description:
        "Devuelve un export JSON versionado del proyecto sin sesiones ni tokens.",
      inputSchema: {},
    },
    async () => {
      const app = crearAplicacion();
      const project = app.gestorContexto.proyectoActual();
      return textoJson(app.gestionarEstadoProyecto.exportar(project.id));
    },
  );

  server.registerTool(
    "capi_state_import",
    {
      description:
        "Importa y fusiona un export capi.project.v1. Requiere confirm=true.",
      inputSchema: {
        data: z.record(z.string(), z.unknown()),
        confirm: z.literal(true),
      },
    },
    async ({ data }) =>
      textoJson(crearAplicacion().gestionarEstadoProyecto.importar(data)),
  );
}
