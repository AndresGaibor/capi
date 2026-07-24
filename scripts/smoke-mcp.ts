import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "bun", args: ["run", "src/mcp.ts"], cwd: process.cwd(), stderr: "pipe" });
const client = new Client({ name: "capi-smoke", version: "1.0.0" }, { capabilities: {} });
try {
  await client.connect(transport);
  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name);
  for (const required of ["capi_discover", "capi_schema", "capi_project_current", "capi_conversations_project", "capi_doctor", "capi_context_pack", "capi_chat"]) {
    if (!names.includes(required)) throw new Error(`Falta herramienta MCP: ${required}`);
  }
  const result = await client.callTool({ name: "capi_discover", arguments: {} });
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content.find((item: { type?: string; text?: string }) => item.type === "text")?.text ?? "";
  if (!text.includes("capi.agent.v1")) throw new Error("capi_discover no devolvió el protocolo esperado");
  console.log(JSON.stringify({ ok: true, tools: names, protocol: "capi.agent.v1" }));
} finally {
  await client.close();
}
