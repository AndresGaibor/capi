import { existsSync, readFileSync } from "node:fs";

export function interpretarFuentesContexto(valor?: string | string[]): string[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.flatMap((v) => interpretarFuentesContexto(v));
  const limpio = valor.trim();
  if (!limpio) return [];
  if (limpio.startsWith("[") && limpio.endsWith("]")) {
    try {
      const datos = JSON.parse(limpio);
      if (Array.isArray(datos) && datos.every((x) => typeof x === "string")) return datos;
    } catch { /* cae a lista normal */ }
  }
  if (limpio.startsWith("@") && existsSync(limpio.slice(1))) {
    return readFileSync(limpio.slice(1), "utf8").split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith("#"));
  }
  return limpio.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
}
