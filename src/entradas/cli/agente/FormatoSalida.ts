export type FormatoSalida = "human" | "markdown" | "json" | "jsonl";

export interface SugerenciaAgente {
  command: string;
  reason: string;
}

export interface ErrorAgente {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export interface SobreAgente<T = unknown> {
  protocol: "capi.agent.v1";
  ok: boolean;
  command: string;
  requestId: string;
  data?: T;
  error?: ErrorAgente;
  suggestions: SugerenciaAgente[];
}

const obtenerCodigo = (error: unknown): string => {
  if (!error) return "ERROR_INTERNO";
  if (typeof error === "object") {
    if ("codigo" in error && typeof (error as { codigo: unknown }).codigo === "string") return (error as { codigo: string }).codigo;
    if ("code" in error && typeof (error as { code: unknown }).code === "string") return (error as { code: string }).code;
    if (error instanceof Error && error.name === "WebBridgeError") return "WEBBRIDGE";
  }
  const mensaje = error instanceof Error ? error.message : String(error);
  if (/alta demanda|issue connecting|server is busy/i.test(mensaje)) return "ALTA_DEMANDA";
  if (/timeout|tiempo máximo|excedió/i.test(mensaje)) return "TIMEOUT_PROVEEDOR";
  if (/sesión|session|tab was closed|No tab with given id/i.test(mensaje)) return "SESION_NAVEGADOR";
  if (/modelo no disponible/i.test(mensaje)) return "MODELO_NO_DISPONIBLE";
  if (/WebBridge/i.test(mensaje)) return "WEBBRIDGE";
  return "ERROR_INTERNO";
};

const esReintentable = (error: unknown, codigo: string): boolean => {
  if (error && typeof error === "object" && "retryable" in error && typeof (error as { retryable: unknown }).retryable === "boolean") {
    return (error as { retryable: boolean }).retryable;
  }
  if (codigo.startsWith("WEBBRIDGE")) return true;
  return ["ALTA_DEMANDA", "TIMEOUT_PROVEEDOR", "SESION_NAVEGADOR", "WEBBRIDGE"].includes(codigo);
};

export function crearSobreExito<T>(command: string, data: T, opciones: { requestId?: string; suggestions?: SugerenciaAgente[] } = {}): SobreAgente<T> {
  return { protocol: "capi.agent.v1", ok: true, command, requestId: opciones.requestId ?? crypto.randomUUID(), data, suggestions: opciones.suggestions ?? [] };
}

interface ErrorAplicacionForma {
  codigo?: string;
  code?: string;
  retryable?: boolean;
  suggestions?: SugerenciaAgente[];
  details?: unknown;
  name?: string;
  message?: string;
}

export function crearSobreError(command: string, error: unknown, opciones: { requestId?: string; suggestions?: SugerenciaAgente[]; details?: unknown } = {}): SobreAgente {
  const code = obtenerCodigo(error);
  const mensaje = error instanceof Error ? error.message : String(error);
  const forma = (error && typeof error === "object" ? (error as ErrorAplicacionForma) : undefined);
  let suggestionsPropias: SugerenciaAgente[] = [];
  if (forma && Array.isArray(forma.suggestions)) {
    suggestionsPropias = (forma.suggestions || []).map((s) => ({ command: String(s.command), reason: String(s.reason) }));
  }
  let detallesCombinados: Record<string, unknown> | undefined = undefined;
  if (opciones.details !== undefined) detallesCombinados = opciones.details as Record<string, unknown>;
  else if (forma && forma.details !== undefined) detallesCombinados = { details: forma.details } as Record<string, unknown>;
  return {
    protocol: "capi.agent.v1", ok: false, command, requestId: opciones.requestId ?? crypto.randomUUID(),
    error: {
      code,
      message: mensaje,
      retryable: esReintentable(error, code),
      ...(detallesCombinados ? { details: detallesCombinados } : {}),
    },
    suggestions: opciones.suggestions ?? suggestionsPropias,
  };
}

export function codigoSalidaParaError(codigo?: string): number {
  if (!codigo) return 1;
  if (codigo === "TIMEOUT_PROVEEDOR") return 10;
  if (codigo === "ALTA_DEMANDA") return 20;
  if (codigo === "MODELO_NO_DISPONIBLE") return 21;
  if (codigo === "SESION_NAVEGADOR") return 30;
  if (codigo === "PAGINA_PROVEEDOR") return 40;
  if (codigo.startsWith("WEBBRIDGE")) return 50;
  if (codigo === "PROVEEDOR_NO_DISPONIBLE") return 60;
  return 1;
}

function markdownValor(valor: unknown, nivel = 0): string {
  if (valor === null || valor === undefined) return "`null`";
  if (typeof valor !== "object") return typeof valor === "string" ? valor : `\`${String(valor)}\``;
  if (Array.isArray(valor)) return valor.map((item) => `${"  ".repeat(nivel)}- ${markdownValor(item, nivel + 1)}`).join("\n") || "_Vacío_";
  return Object.entries(valor as Record<string, unknown>).map(([clave, item]) => `${"  ".repeat(nivel)}- **${clave}:** ${markdownValor(item, nivel + 1)}`).join("\n");
}

export function serializarSalida(sobre: SobreAgente, formato: FormatoSalida): string {
  if (formato === "json" || formato === "jsonl") return JSON.stringify(sobre);
  if (formato === "markdown") {
    const cuerpo = sobre.ok ? markdownValor(sobre.data) : `**${sobre.error?.code}:** ${sobre.error?.message}`;
    const sugerencias = sobre.suggestions.length ? `\n\n## Siguientes acciones\n${sobre.suggestions.map((s) => `- \`${s.command}\` — ${s.reason}`).join("\n")}` : "";
    return `# CAPI: ${sobre.command}\n\n- **Estado:** ${sobre.ok ? "éxito" : "error"}\n- **Request ID:** \`${sobre.requestId}\`\n\n${cuerpo}${sugerencias}`;
  }
  return sobre.ok ? String(typeof sobre.data === "string" ? sobre.data : JSON.stringify(sobre.data, null, 2)) : `${sobre.error?.code}: ${sobre.error?.message}`;
}
