import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registrarHerramientasConsulta,
  registrarHerramientasContexto,
  registrarHerramientasEstado,
  registrarHerramientasVision,
  registrarHerramientasChat,
} from "./herramientas";

export function crearServidorMcp(): McpServer {
  const server = new McpServer({ name: "capi", version: "2.6.0" });

  registrarHerramientasConsulta(server);
  registrarHerramientasContexto(server);
  registrarHerramientasEstado(server);
  registrarHerramientasVision(server);
  registrarHerramientasChat(server);

  return server;
}

export async function iniciarServidorMcp(): Promise<void> {
  const server = crearServidorMcp();
  await server.connect(new StdioServerTransport());
}
