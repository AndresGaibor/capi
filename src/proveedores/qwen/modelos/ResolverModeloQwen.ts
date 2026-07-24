const ALIASES: Record<string, string> = {
  plus: "Qwen3.7-Plus", "3.7-plus": "Qwen3.7-Plus",
  preview: "Qwen3.8-Max-Preview", "max-preview": "Qwen3.8-Max-Preview", "3.8-max-preview": "Qwen3.8-Max-Preview",
  max: "Qwen3.7-Max", "3.7-max": "Qwen3.7-Max",
};
export function resolverModeloQwen(modelo?: string): string | undefined {
  if (!modelo) return undefined;
  const limpio = modelo.trim();
  return ALIASES[limpio.toLowerCase()] ?? limpio;
}
