import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export interface ResultadoFiltroIncremental {
  fuentes: string[];
  sinCambios: string[];
  hashes: Record<string, string>;
}

export function filtrarContextoIncremental(cwd: string, fuentes: string[], anteriores: Record<string, string>): ResultadoFiltroIncremental {
  const nuevas: string[] = [];
  const sinCambios: string[] = [];
  const hashes: Record<string, string> = {};
  for (const fuente of fuentes) {
    const absoluta = isAbsolute(fuente) ? fuente : resolve(cwd, fuente);
    if (!existsSync(absoluta) || !statSync(absoluta).isFile()) { nuevas.push(fuente); continue; }
    const ruta = relative(cwd, absoluta).replaceAll("\\", "/");
    const hash = new Bun.CryptoHasher("sha256").update(readFileSync(absoluta)).digest("hex");
    hashes[ruta] = hash;
    if (anteriores[ruta] === hash) sinCambios.push(ruta); else nuevas.push(fuente);
  }
  return { fuentes: nuevas, sinCambios, hashes };
}
