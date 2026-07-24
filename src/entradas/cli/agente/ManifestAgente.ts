export interface EsquemaComandoAgente {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, any>; required: string[]; additionalProperties: boolean };
  behavior: { nonInteractive: boolean; streaming: boolean; idempotent: boolean; sideEffects: string[] };
  errors: Array<{ code: string; retryable: boolean; recovery: string }>;
}

const output = { type: "string", enum: ["human", "markdown", "json", "jsonl"], default: "human", description: "Formato estable de salida. Usa json o jsonl para agentes." };

const comandos: EsquemaComandoAgente[] = [
  {
    name: "chat.send", description: "Enviar un prompt con contexto automático del proyecto, recuperación de modelo y bloqueo de concurrencia.",
    inputSchema: { type: "object", additionalProperties: false, required: ["prompt"], properties: {
      prompt: { type: "string", minLength: 1 }, provider: { type: "string", enum: ["qwen", "deepseek"] }, model: { type: "string" }, conversationId: { type: "string" },
      newConversation: { type: "boolean", default: false }, reasoning: { type: "boolean" }, webSearch: { type: "boolean" }, files: { type: "array", items: { type: "string" } },
      fallback: { type: "boolean", default: true }, dryRun: { type: "boolean", default: false }, explain: { type: "boolean", default: false }, output,
    } },
    behavior: { nonInteractive: true, streaming: true, idempotent: false, sideEffects: ["navega una pestaña", "envía un mensaje", "actualiza historial local"] },
    errors: [
      { code: "ALTA_DEMANDA", retryable: true, recovery: "CAPI reintenta y degrada el modelo; después sugiere otro proveedor." },
      { code: "TIMEOUT_PROVEEDOR", retryable: true, recovery: "Reintentar o usar el proveedor alternativo." },
      { code: "SESION_NAVEGADOR", retryable: true, recovery: "CAPI recrea la sesión WebBridge al navegar." },
    ],
  },
  {
    name: "project.current", description: "Obtener el proyecto detectado y sus preferencias.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["registra o actualiza el proyecto en SQLite"] }, errors: [],
  },
  {
    name: "conversations.project", description: "Listar conversaciones locales y compartidas del proyecto.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { includeArchived: { type: "boolean", default: false }, output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "doctor", description: "Diagnosticar proyecto, SQLite, WebBridge y proveedores.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["puede navegar o evaluar páginas de proveedor"] }, errors: [],
  },
  {
    name: "discover", description: "Descubrir comandos, proveedores, formatos y códigos de salida.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
];

export function obtenerEsquemaComando(nombre: string): EsquemaComandoAgente | undefined { return comandos.find((c) => c.name === nombre); }

export function obtenerManifestAgente() {
  return {
    protocol: "capi.agent.v1" as const,
    version: "2.2.0",
    interfaces: ["cli", "mcp", "typescript-core"],
    outputFormats: ["human", "markdown", "json", "jsonl"],
    providers: [
      { id: "qwen", models: ["preview", "max", "plus"], fallback: ["preview", "max", "plus"] },
      { id: "deepseek", models: ["expert", "vision", "default"], fallback: ["expert", "default"], fallbackRequiresNewConversation: true },
    ],
    commands: comandos,
    exitCodes: { success: 0, generic: 1, timeout: 10, highDemand: 20, modelUnavailable: 21, browserSession: 30, providerPage: 40, webBridge: 50, providerUnavailable: 60 },
    skill: ".agents/skills/capi/SKILL.md",
    mcpCommand: "bun run src/mcp.ts",
    conventions: { stdout: "solo datos solicitados", stderr: "diagnóstico humano", jsonl: "un evento por línea", ansiInStructuredOutput: false, nonInteractiveByDefault: true },
  };
}
