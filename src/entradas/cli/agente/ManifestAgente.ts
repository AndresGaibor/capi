import { CAPACIDADES_MULTIMODALES } from "../../../nucleo/proveedores/CapacidadesMultimodales";

export interface EsquemaComandoAgente {
  name: string;
  description: string;
  examples?: string[];
  inputSchema: { type: "object"; properties: Record<string, any>; required: string[]; additionalProperties: boolean };
  behavior: { nonInteractive: boolean; streaming: boolean; idempotent: boolean; sideEffects: string[]; longRunning?: boolean; defaultTimeoutMs?: number };
  errors: Array<{ code: string; retryable: boolean; recovery: string }>;
}

const output = { type: "string", enum: ["human", "markdown", "json", "jsonl"], default: "human", description: "Formato estable de salida. Usa json o jsonl para agentes." };

const comandos: EsquemaComandoAgente[] = [
  {
    name: "chat.send", description: "Enviar un prompt con contexto automático del proyecto, recuperación de modelo y bloqueo de concurrencia.",
    examples: [
      'capi chat --proveedor qwen --modelo preview --output jsonl "Analiza el diff actual"',
      'capi chat --proveedor deepseek --modelo default --continuar --output json',
      'capi chat --proveedor qwen --background --output json "Investiga X"',
      'capi chat --proveedor qwen --dry-run --output json "Exploracion"',
    ],
    inputSchema: { type: "object", additionalProperties: false, required: ["prompt"], properties: {
       prompt: { type: "string", minLength: 1 }, provider: { type: "string", enum: ["qwen", "deepseek", "chatgpt"] }, model: { type: "string" }, conversationId: { type: "string" },
       newConversation: { type: "boolean", default: false }, continue: { type: "boolean", default: false, description: "Consultar una respuesta pendiente sin enviar otro mensaje." }, reasoning: { type: "boolean" }, webSearch: { type: "boolean" }, files: { type: "array", items: { type: "string" }, description: "Archivos, directorios o globs. Los textuales se empaquetan; imágenes y PDF se adjuntan nativamente." }, images: { type: "array", items: { type: "string" }, description: "Imágenes PNG, JPEG, WebP o GIF; nunca se convierten a texto." }, includeGitDiff: { type: "boolean", default: false }, automaticContext: { type: "boolean", default: false }, incrementalContext: { type: "boolean", default: false }, includeConversationSummary: { type: "boolean", default: false }, maxContextBytes: { type: "integer", minimum: 1024 }, bundleContext: { type: "boolean", default: true, description: "Combinar las fuentes en un único archivo antes de enviarlas." },
      fallback: { type: "boolean", default: true }, timeoutMs: { type: "integer", minimum: 1000 }, dryRun: { type: "boolean", default: false }, explain: { type: "boolean", default: false }, output,
    } },
    behavior: { nonInteractive: true, streaming: true, idempotent: false, sideEffects: ["navega una pestaña", "envía un mensaje", "actualiza historial local"], longRunning: true, defaultTimeoutMs: 1800000 },
    errors: [
      { code: "ALTA_DEMANDA", retryable: true, recovery: "CAPI reintenta y degrada el modelo; después sugiere otro proveedor." },
      { code: "TIMEOUT_PROVEEDOR", retryable: true, recovery: "Reintentar o usar el proveedor alternativo." },
      { code: "SESION_NAVEGADOR", retryable: true, recovery: "CAPI recrea la sesión WebBridge al navegar." },
      { code: "ARGUMENTOS_INVALIDOS", retryable: false, recovery: "Corrige los flags incompatibles; ver capi chat enviar --help." },
      { code: "RESPUESTA_VACIA", retryable: false, recovery: "Reintentar con --proveedor deepseek -m default o Qwen -m max." },
    ],
  },
  {
    name: "chat.wait", description: "Bloquear hasta que una tarea durable termine (completada, cancelada o fallida). Sin este comando el agente debe hacer polling manual con 'capi tareas estado <id>'.",
    examples: [
      'capi tareas esperar 4f445fc6-b933-4108-a585-901dbfe40a07 --timeout 7200000 --output json',
      'capi tareas esperar <id> --pollMs 2000 --output json',
    ],
    inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", description: "taskId devuelto por 'capi chat --background'." }, timeout: { type: "integer", default: 1800000, description: "Tiempo maximo de espera en ms (defecto 30 min)." }, pollMs: { type: "integer", default: 5000 }, output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["lee SQLite cada pollMs"], longRunning: true, defaultTimeoutMs: 1800000 },
    errors: [
      { code: "EJECUCION_NO_ENCONTRADA", retryable: false, recovery: "Comprueba el taskId con 'capi tareas listar'." },
      { code: "TIMEOUT_ESPERA", retryable: true, recovery: "Vuelve a invocar con --timeout mas alto o consulta 'capi tareas estado <id>'." },
    ],
  },
  {
    name: "context.pack", description: "Combinar archivos, directorios, globs y git diff en un único .txt seguro, cacheado y limitado por tamaño.",
    examples: [
      'capi contexto empaquetar --fuentes "src/**/*.ts" --diff --output json',
      'capi contexto empaquetar --fuentes "src/cli.ts,docs/" --limite 1048576 --output json',
    ],
    inputSchema: { type: "object", additionalProperties: false, required: ["sources"], properties: {
      sources: { type: "array", items: { type: "string" } }, includeGitDiff: { type: "boolean", default: false }, maxBytes: { type: "integer", minimum: 1024, default: 4194304 }, output,
    } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["crea o reutiliza un archivo de caché local"] },
    errors: [{ code: "CONTEXTO_INVALIDO", retryable: false, recovery: "Corrige rutas, globs o permisos de lectura." }],
  },
  {
    name: "context.explain", description: "Explicar presupuesto, selección, inclusiones, omisiones y truncamientos del contexto.",
    examples: ['capi contexto explicar --automatico --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { sources: { type: "array", items: { type: "string" } }, automatic: { type: "boolean", default: false }, includeGitDiff: { type: "boolean", default: false }, provider: { type: "string", enum: ["qwen", "deepseek"] }, model: { type: "string" }, maxBytes: { type: "integer", minimum: 1024 }, output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["crea o reutiliza un paquete de caché"] }, errors: [],
  },
  {
    name: "history.list", description: "Listar ejecuciones recientes del proyecto con modelo, conversación, rama y commit.",
    examples: ['capi historial listar --limite 20 --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { limit: { type: "integer", minimum: 1, maximum: 200, default: 20 }, output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "diagnostics.contracts", description: "Verificar disponibilidad y contratos reales de los proveedores.",
    examples: ['capi diagnostico contratos --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["navega páginas de proveedor"] }, errors: [],
  },
  {
    name: "diagnostics.page", description: "Diagnosticar la página activa de un proveedor (URL, capacidades, selectores).",
    examples: ['capi diagnostico pagina --proveedor chatgpt --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { provider: { type: "string", default: "deepseek" }, output: { type: "string", default: "json" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [{ code: "WEBBRIDGE", retryable: true, recovery: "Ejecuta 'capi doctor' y sigue data.sugerencias." }],
  },
  {
    name: "diagnostics.complete", description: "Diagnóstico global de proyecto, persistencia y proveedores.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { json: { type: "boolean" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "diagnostics.network", description: "Capturar o listar tráfico WebBridge saneado.",
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { accion: { type: "string", enum: ["iniciar", "detener", "listar"], default: "listar", description: "iniciar|detener|listar" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: false, sideEffects: [] },
    errors: [{ code: "ARGUMENTOS_INVALIDOS", retryable: false, recovery: "Usa --accion iniciar|detener|listar." }],
  },
  {
    name: "state.metrics", description: "Obtener métricas agregadas del proyecto por proveedor y modelo.",
    examples: ['capi estado metricas --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "state.clean", description: "Limpiar selectivamente cache, snapshots, historial, resumenes u ocupaciones.",
    examples: ['capi estado limpiar --capas cache,snapshots --confirmar --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: ["layers","confirm"], properties: { layers:{type:"array",items:{type:"string",enum:["cache","snapshots","historial","resumenes","ocupaciones"]}},confirm:{type:"boolean"},output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: false, sideEffects: ["elimina estado local"] },
    errors: [{ code: "ARGUMENTOS_INVALIDOS", retryable: false, recovery: "Especifica --capas y --confirmar." }],
  },
  {
    name: "state.export", description: "Exportar el estado portable del proyecto sin sesiones ni tokens.",
    examples: ['capi estado exportar --archivo ./capi-backup.json'],
    inputSchema: { type: "object", additionalProperties: false, required: ["file"], properties: { file:{type:"string"},output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["escribe un archivo JSON"] }, errors: [],
  },
  {
    name: "state.import", description: "Importar y fusionar un export capi.project.v1.",
    examples: ['capi estado importar --archivo ./capi-backup.json --confirmar'],
    inputSchema: { type: "object", additionalProperties: false, required: ["file","confirm"], properties: { file:{type:"string"},confirm:{type:"boolean"},output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["fusiona estado local"] },
    errors: [{ code: "ARGUMENTOS_INVALIDOS", retryable: false, recovery: "Anade --confirmar." }],
  },
  {
    name: "vision.analyze", description: "Analizar una imagen con salida JSON autosuficiente para agentes sin visión.",
    examples: ['capi vision analizar captura.png --tipo ui --output json', 'capi vision analizar /tmp/captura.png --tipo ocr --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: ["image"], properties: { image:{type:"string"}, type:{type:"string",enum:["descripcion","ocr","ui","diagrama","tabla"],default:"descripcion"}, instruction:{type:"string"}, provider:{type:"string",enum:["qwen","deepseek"],default:"qwen"}, model:{type:"string"}, timeoutMs:{type:"integer",minimum:1000}, output } },
    behavior: { nonInteractive: true, streaming: true, idempotent: false, sideEffects: ["adjunta una imagen", "envía un mensaje", "actualiza historial local"], longRunning: true, defaultTimeoutMs: 180000 },
    errors: [
      { code: "MODELO_NO_DISPONIBLE", retryable: true, recovery: "Usa Qwen max/preview/plus o DeepSeek vision." },
      { code: "ARGUMENTOS_INVALIDOS", retryable: false, recovery: "Elige un --tipo valido: descripcion, ocr, ui, diagrama o tabla." },
    ],
  },
  {
    name: "vision.compare", description: "Comparar dos imágenes con diferencias, mejoras, regresiones e incertidumbres en JSON.",
    examples: ['capi vision comparar antes.png despues.png --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: ["before","after"], properties: { before:{type:"string"},after:{type:"string"},instruction:{type:"string"},provider:{type:"string",enum:["qwen","deepseek"],default:"qwen"},model:{type:"string"},timeoutMs:{type:"integer",minimum:1000},output } },
    behavior: { nonInteractive: true, streaming: true, idempotent: false, sideEffects: ["adjunta dos imágenes", "envía un mensaje", "actualiza historial local"], longRunning: true, defaultTimeoutMs: 180000 },
    errors: [{ code: "MODELO_NO_DISPONIBLE", retryable: true, recovery: "Usa un modelo con modalidad image." }],
  },
  {
    name: "project.current", description: "Obtener el proyecto detectado y sus preferencias.",
    examples: ['capi proyecto actual --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["registra o actualiza el proyecto en SQLite"] }, errors: [],
  },
  {
    name: "project.configure", description: "Guardar preferencias predeterminadas del proyecto (proveedor, modelo, razonamiento, búsqueda).",
    examples: [
      'capi proyecto configurar -p qwen -m preview --razonamiento',
      'capi proyecto configurar -p deepseek -m default --sin-razonamiento',
    ],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { proveedor: { type: "string", alias: "p" }, modelo: { type: "string", alias: "m" }, razonamiento: { type: "boolean" }, sinRazonamiento: { type: "boolean" }, busqueda: { type: "boolean" }, sinBusqueda: { type: "boolean" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["actualiza preferencias locales"] }, errors: [],
  },
  {
    name: "conversations.list", description: "Listar conversaciones disponibles de un proveedor.",
    examples: ['capi conversaciones listar --proveedor deepseek --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { proveedor: { type: "string", alias: "p", default: "deepseek" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "conversations.project", description: "Listar historial de conversaciones del proyecto (incluye archivadas con --archivadas).",
    examples: ['capi conversaciones proyecto --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { archivadas: { type: "boolean", default: false }, output: { type: "string", default: "human" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "conversations.messages", description: "Mostrar mensajes de una conversación específica.",
    examples: ['capi conversaciones mensajes <conversacionId> --proveedor deepseek'],
    inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "positional", required: true }, proveedor: { type: "string", alias: "p", default: "deepseek" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [{ code: "PROVEEDOR_NO_ENCONTRADO", retryable: false, recovery: "Verifica -p qwen|deepseek|chatgpt." }],
  },
  {
    name: "doctor", description: "Diagnosticar proyecto, SQLite, WebBridge y proveedores. Devuelve data.sugerencias accionables cuando falla algo.",
    examples: ['capi doctor --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: ["puede navegar o evaluar páginas de proveedor"] },
    errors: [{ code: "WEBBRIDGE", retryable: true, recovery: "Ejecuta 'capi doctor' y sigue data.sugerencias para recrear la sesión del proveedor." }],
  },
  {
    name: "discover", description: "Descubrir comandos, proveedores, formatos, errores y ejemplos. Punto de partida canonico para un agente sin contexto.",
    examples: ['capi discover --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { output } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "schema", description: "Obtener el JSON Schema detallado de un comando (alias en espanol aceptados).",
    examples: ['capi schema chat.send --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { comando: { type: "string", description: "Nombre canonico en ingles (ej. chat.send) o ruta CLI (ej. chat enviar)." }, output: { type: "string", default: "json" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "tasks.list", description: "Listar tareas durables recientes con estado y metadatos.",
    examples: ['capi tareas listar --limite 50'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { limite: { type: "integer", default: 100 } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "tasks.state", description: "Snapshot completo de una tarea durable con duracion, ultimo progreso y propietario.",
    examples: ['capi tareas estado <id> --output json'],
    inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "positional", required: true } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
  {
    name: "models.list", description: "Listar modelos disponibles por proveedor.",
    examples: ['capi modelos listar --proveedor qwen'],
    inputSchema: { type: "object", additionalProperties: false, required: [], properties: { proveedor: { type: "string", alias: "p", default: "deepseek" } } },
    behavior: { nonInteractive: true, streaming: false, idempotent: true, sideEffects: [] }, errors: [],
  },
];

const TABLA_ERRORES: Array<{ code: string; nombre: string; retryable: boolean; recovery: string }> = [
  { code: "ALTA_DEMANDA", nombre: "Servidor ocupado del proveedor", retryable: true, recovery: "CAPI reintenta y degrada el modelo; usa la sugerencia alternativa del sobre de error." },
  { code: "TIMEOUT_PROVEEDOR", nombre: "Tiempo maximo excedido", retryable: true, recovery: "Reintenta o usa --proveedor deepseek -m default." },
  { code: "SESION_NAVEGADOR", nombre: "Sesion WebBridge cerrada o pestana desconocida", retryable: true, recovery: "CAPI recrea la sesion al navegar; ejecuta 'capi doctor' si persiste." },
  { code: "PAGINA_PROVEEDOR", nombre: "Error en la pagina del proveedor (selector, captcha, edicion)", retryable: false, recovery: "Verifica el mensaje.error; intenta con el proveedor alternativo." },
  { code: "MODELO_NO_DISPONIBLE", nombre: "Modelo no soportado o sin multimodal", retryable: true, recovery: "Consulta discover.providers[*].models y elige uno con la modalidad requerida." },
  { code: "PROVEEDOR_NO_ENCONTRADO", nombre: "Proveedor no registrado", retryable: false, recovery: "Usa -p qwen|deepseek|chatgpt." },
  { code: "PROVEEDOR_NO_DISPONIBLE", nombre: "Proveedor no responde", retryable: false, recovery: "Verifica connectivity y vuelve a intentar." },
  { code: "CAPACIDAD_NO_SOPORTADA", nombre: "Capacidad solicitada no disponible", retryable: false, recovery: "Usa el esquema correspondiente del comando." },
  { code: "CONTEXTO_INVALIDO", nombre: "Rutas o globs invalidos", retryable: false, recovery: "Corrige rutas, globs o permisos de lectura." },
  { code: "ENVIO_INCIERTO", nombre: "El envio anterior no fue confirmado", retryable: false, recovery: "Usa --continuar para observar sin reenviar." },
  { code: "ARGUMENTOS_INVALIDOS", nombre: "Combinacion de flags no permitida", retryable: false, recovery: "Sigue las sugerencias del sobre." },
  { code: "WEBBRIDGE", nombre: "Error general de WebBridge", retryable: true, recovery: "Ejecuta 'capi doctor' y sigue data.sugerencias." },
  { code: "WEBBRIDGE_TOOL_ERROR", nombre: "Herramienta de WebBridge rechazo la operacion", retryable: true, recovery: "Revisa el codigo de error en error.codigoExtension." },
  { code: "OPERACION_NO_PERMITIDA", nombre: "Operacion no soportada en el estado actual", retryable: false, recovery: "Espera a que termine o cancela con 'capi tareas cancelar <id>'." },
  { code: "EJECUCION_NO_ENCONTRADA", nombre: "Tarea durable no existe", retryable: false, recovery: "Lista con 'capi tareas listar'." },
  { code: "TIMEOUT_ESPERA", nombre: "capi tareas esperar alcanzo su timeout", retryable: true, recovery: "Vuelve a invocar con --timeout mas alto o usa 'capi tareas estado'." },
  { code: "ERROR_INTERNO", nombre: "Error no clasificado", retryable: false, recovery: "Captura el stack y abre un issue con el sobre completo." },
];

const QUICK_START: Array<{ paso: number; titulo: string; comando: string; razon: string }> = [
  { paso: 1, titulo: "Descubre el contrato", comando: "capi discover --output json", razon: "versionado y estable; punto de partida canonico." },
  { paso: 2, titulo: "Aprende un comando especifico", comando: 'capi schema chat.send --output json', razon: "devuelve inputSchema, behavior y errors con recovery." },
  { paso: 3, titulo: "Comprueba el entorno", comando: "capi doctor --output json", razon: "valida SQLite, WebBridge y los 3 proveedores." },
  { paso: 4, titulo: "Simula sin efectos", comando: 'capi chat --dry-run --output json "tu prompt"', razon: "lista las actions que ejecutaria sin navegar." },
  { paso: 5, titulo: "Lanza la tarea", comando: 'capi chat --proveedor qwen --modelo preview --output jsonl "tu prompt"', razon: "jsonl entrega eventos incrementales." },
  { paso: 6, titulo: "Si tarda mas de unos minutos", comando: 'capi chat --proveedor qwen --background --output json "tu prompt"', razon: "devuelve taskId; luego usa capi tareas esperar <id>." },
  { paso: 7, titulo: "Espera una tarea durable", comando: 'capi tareas esperar <taskId> --timeout 7200000 --output json', razon: "bloquea hasta que la tarea termine y devuelve followUp." },
  { paso: 8, titulo: "Ante cualquier error", comando: "consulta error.code en el sobre; sigue error.suggestions[].command", razon: "cada sugerencia es un comando listo para ejecutar." },
];

export function obtenerEsquemaComando(nombre: string): EsquemaComandoAgente | undefined { return comandos.find((c) => c.name === nombre); }

export function obtenerManifestAgente() {
  return {
    protocol: "capi.agent.v1" as const,
    version: "2.6.0",
    interfaces: ["cli", "mcp", "typescript-core"],
    outputFormats: ["human", "markdown", "json", "jsonl"],
    longRunning: { commands: comandos.filter((c) => c.behavior.longRunning).map((c) => c.name), defaultTimeoutMs: 1800000, helper: "capi tareas esperar <id> --timeout 7200000" },
    quickStart: QUICK_START,
    providers: [
      { id: "qwen", models: ["preview", "max", "plus"], visibleNames: ["Qwen3.8-Max-Preview", "Qwen3.7-Max", "Qwen3.7-Plus"], fallback: ["preview", "max", "plus"], files: true, vision: true, multimodal: CAPACIDADES_MULTIMODALES.filter(x => x.proveedor === "qwen") },
      { id: "deepseek", models: ["expert", "vision", "default"], fallback: ["expert", "default"], visualFallback: ["vision"], fallbackRequiresNewConversation: true, files: true, vision: true, multimodal: CAPACIDADES_MULTIMODALES.filter(x => x.proveedor === "deepseek") },
      { id: "chatgpt", models: ["auto"], fallback: [], files: true, vision: false, multimodal: [] },
    ],
    commands: comandos,
    errorTable: TABLA_ERRORES,
    exitCodes: { success: 0, generic: 1, timeout: 10, highDemand: 20, modelUnavailable: 21, browserSession: 30, providerPage: 40, webBridge: 50, providerUnavailable: 60, waitTimeout: 124, signalInterrupt: 130, signalTerm: 143 },
    skill: ".agents/skills/capi/SKILL.md",
    mcpCommand: "bun run src/mcp.ts",
    multimodal: { imagesNeverBundledAsText: true, preferredVisualProvider: "qwen", imageInputFormats: ["image/png","image/jpeg","image/webp","image/gif"], documentInputFormats: ["application/pdf"], agentWithoutVisionMustDelegate: true },
    contextFiles: { bundleByDefault: true, format: "txt", defaultMaxBytes: "resolved-by-provider-model", cacheByContentHash: true, incrementalSnapshots: true, automaticSelection: true, persistentSummaries: true, excludesSecretsAndBinaries: true },
    conventions: { stdout: "solo datos solicitados", stderr: "diagnóstico humano", jsonl: "un evento por línea", ansiInStructuredOutput: false, nonInteractiveByDefault: true },
  };
}
