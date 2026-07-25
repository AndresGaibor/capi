import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  obtenerManifestAgente,
  obtenerEsquemaComando,
} from "../../cli/agente/ManifestAgente";

function textoJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function registrarHerramientasConsulta(server: McpServer): void {
  server.registerTool(
    "capi_discover",
    {
      description:
        "Descubre todas las capacidades de CAPI, modelos, fallbacks, formatos, errores y comandos. Úsala primero cuando no conozcas la interfaz.",
      inputSchema: {},
    },
    async () => textoJson(obtenerManifestAgente()),
  );

  server.registerTool(
    "capi_schema",
    {
      description:
        "Obtiene el contrato exacto de un comando CAPI antes de invocarlo. Evita inventar argumentos o asumir efectos.",
      inputSchema: {
        command: z
          .string()
          .describe(
            "Nombre canónico, por ejemplo chat.send, doctor o project.current",
          ),
      },
    },
    async ({ command }) => {
      const schema = obtenerEsquemaComando(command);
      return schema
        ? textoJson(schema)
        : {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Comando desconocido: ${command}`,
              },
            ],
          };
    },
  );

  server.registerTool(
    "capi_project_current",
    {
      description:
        "Devuelve el proyecto detectado desde el directorio de trabajo y sus preferencias persistidas. No abre el navegador.",
      inputSchema: {},
    },
    async () => {
      const { crearAplicacion } = await import("../../cli/composicion/crearAplicacion");
      const app = crearAplicacion();
      const project = app.gestorContexto.proyectoActual();
      return textoJson({
        project,
        preferences: app.repositorioContexto.obtenerPreferencias(project.id),
      });
    },
  );

  server.registerTool(
    "capi_conversations_project",
    {
      description:
        "Lista conversaciones del proyecto actual. Prioriza la ruta actual y luego rutas vinculadas; informa principal, favorita, archivada y ocupada.",
      inputSchema: { includeArchived: z.boolean().optional().default(false) },
    },
    async ({ includeArchived }) => {
      const { crearAplicacion } = await import("../../cli/composicion/crearAplicacion");
      const app = crearAplicacion();
      const project = app.gestorContexto.proyectoActual();
      const conversations = app.repositorioContexto
        .listarConversacionesProyecto(project.id)
        .filter((c) => includeArchived || !c.archivada);
      return textoJson({ project, conversations });
    },
  );
}
