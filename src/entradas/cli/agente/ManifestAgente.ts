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
      newConversation: { type: "boolean", default: false }, reasoning: { type: "boolean" }, webSearch: { type: "boolean" }, files: { type: "array", items: { type: "string" }, description: "Archivos, directorios o globs. CAPI los combina en un único .txt seguro." }, includeGitDiff: { type: "boolean", default: false }, automaticContext: { type: "boolean", default: false }, incrementalContext: { type: "boolean", default: false }, includeConversationSummary: { type: "boolean", default: false }, maxContextBytes: { type: "integer", minimum: 1024 }, bundleContext: { type: "boolean", default: true, description: "Combinar las fuentes en un único archivo antes de enviarlas." },
      fallback: { type: "boolean", default: true }, timeoutMs: { type: "integer", minimum: 1000 }, dryRun: { type: "boolean", default: false }, explain: { type: "boolean", default: false }, output,
    } },
    behavior: { nonInteractive: true, streaming: true, idempotent: false, sideEffects: ["navega una pestaña", "envía un mensaje", "actualiza historial local"] },
    errors: [
      { code: "ALTA_DEMANDA", retryable: true, recovery: "CAPI reintenta y degrada el modelo; después sugiere otro proveedor." },
      { code: "TIMEOUT_PROVEEDOR", retryable: true, recovery: "Reintentar o usar el proveedor alternativo." },
      { code: "SESION_NAVEGADOR", retryable: true, recovery: "CAPI recrea la sesión WebBridge al navegar." },
    ],
  },
  {
    name: "context.pack", description: "Combinar archivos, directorios, globs y git diff en un único .txt seguro, cacheado y limitado por tamaño.",
    inputSchema: { type: "object", additionalProperties: false, required: ["sources"], properties: {
      sources: { type: "array", items: { type: "string" } }, includeGitDiff: { type: "boolean", default: false }, maxBytes: { type: "integer", minimum: 1024, default: 4194304 }, output,
    } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["crea o reutiliza un archivo de caché local"] },
    errors: [{ code: "CONTEXTO_INVALIDO", retryable: false, recovery: "Corrige rutas, globs o permisos de lectura." }],
  },
  {
    name: "context.explain", description: "Explicar presupuesto, selección, inclusiones, omisiones y truncamientos del contexto.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { sources: { type: "array", items: { type: "string" } }, automatic: { type: "boolean", default: false }, includeGitDiff: { type: "boolean", default: false }, provider: { type: "string", enum: ["qwen", "deepseek"] }, model: { type: "string" }, maxBytes: { type: "integer", minimum: 1024 }, output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["crea o reutiliza un paquete de caché"] }, errors: [],
  },
  {
    name: "history.list", description: "Listar ejecuciones, modelos, commits, contexto y resultados del proyecto.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { limit: { type: "integer", minimum: 1, maximum: 200, default: 20 }, output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "diagnostics.contracts", description: "Verificar disponibilidad y contratos de modelos de los proveedores reales.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["navega páginas de proveedor"] }, errors: [],
  },
  {
    name: "state.metrics", description: "Obtener métricas agregadas del proyecto por proveedor y modelo.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "state.clean", description: "Limpiar selectivamente cache, snapshots, historial o resumenes.",
    inputSchema: { type: "object", additionalProperties: false, required: ["layers","confirm"], properties: { layers:{type:"array",items:{type:"string"}},confirm:{type:"boolean"},output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: false, sideEffects: ["elimina estado local"] }, errors: [],
  },
  {
    name: "state.export", description: "Exportar el estado portable del proyecto sin sesiones ni tokens.",
    inputSchema: { type: "object", additionalProperties: false, required: ["file"], properties: { file:{type:"string"},output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["escribe un archivo JSON"] }, errors: [],
  },
  {
    name: "state.import", description: "Importar y fusionar un export capi.project.v1.",
    inputSchema: { type: "object", additionalProperties: false, required: ["file","confirm"], properties: { file:{type:"string"},confirm:{type:"boolean"},output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["fusiona estado local"] }, errors: [],
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
    version: "2.5.0",
    interfaces: ["cli", "mcp", "typescript-core"],
    outputFormats: ["human", "markdown", "json", "jsonl"],
    providers: [
      { id: "qwen", models: ["preview", "max", "plus"], fallback: ["preview", "max", "plus"], files: true },
      { id: "deepseek", models: ["expert", "vision", "default"], fallback: ["expert", "default"], fallbackRequiresNewConversation: true, files: true },
    ],
    commands: comandos,
    exitCodes: { success: 0, generic: 1, timeout: 10, highDemand: 20, modelUnavailable: 21, browserSession: 30, providerPage: 40, webBridge: 50, providerUnavailable: 60 },
    skill: ".agents/skills/capi/SKILL.md",
    mcpCommand: "bun run src/mcp.ts",
    contextFiles: { bundleByDefault: true, format: "txt", defaultMaxBytes: "resolved-by-provider-model", cacheByContentHash: true, incrementalSnapshots: true, automaticSelection: true, persistentSummaries: true, excludesSecretsAndBinaries: true },
    conventions: { stdout: "solo datos solicitados", stderr: "diagnóstico humano", jsonl: "un evento por línea", ansiInStructuredOutput: false, nonInteractiveByDefault: true },
  };
}
