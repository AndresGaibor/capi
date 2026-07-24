export interface IntentoProveedor {
  proveedor: string;
  modelo?: string;
}

const CADENAS_MODELOS: Record<string, Record<string, string[]>> = {
  qwen: {
    preview: ["preview", "max", "plus"],
    "qwen3.8-max-preview": ["preview", "max", "plus"],
    max: ["max", "plus"],
    "qwen3.7-max": ["max", "plus"],
    plus: ["plus"],
    "qwen3.7-plus": ["plus"],
  },
  deepseek: {
    expert: ["expert", "default"],
    vision: ["vision", "default"],
    default: ["default"],
  },
};

export function construirIntentosRecuperacion(proveedor: string, modelo?: string): IntentoProveedor[] {
  const proveedorNormalizado = proveedor.trim().toLowerCase();
  const modeloNormalizado = modelo?.trim().toLowerCase();
  const cadena = modeloNormalizado ? CADENAS_MODELOS[proveedorNormalizado]?.[modeloNormalizado] : undefined;
  const modelos = cadena ?? [modelo];
  return modelos.map((actual) => ({ proveedor: proveedorNormalizado, modelo: actual }));
}

export function esErrorTransitorioProveedor(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  return /alta demanda|high demand|server is busy|servidor ocupado|temporarily unavailable|try again later|inténtelo de nuevo|timeout|timed out|connection|conectando|no produjo respuesta/i.test(mensaje);
}

export function sugerenciaProveedorAlternativo(proveedor: string): string {
  return proveedor.toLowerCase() === "qwen"
    ? 'Prueba DeepSeek: capi chat -p deepseek -m default "tu mensaje"'
    : 'Prueba Qwen: capi chat -p qwen -m max "tu mensaje"';
}
