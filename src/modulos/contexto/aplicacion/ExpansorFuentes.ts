import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { normalizarRuta, DIRECTORIOS_IGNORADOS } from "./PoliticasFiltradoContexto";

const PATRONES_GLOB = /[*?{}[\]]/;

export async function expandirFuentes(cwd: string, fuentes: string[]): Promise<string[]> {
  const rutas = new Set<string>();
  for (const fuenteCruda of fuentes) {
    const fuente = fuenteCruda.trim();
    if (!fuente) continue;
    if (PATRONES_GLOB.test(fuente)) {
      const glob = new Bun.Glob(fuente);
      for await (const coincidencia of glob.scan({ cwd, onlyFiles: true, dot: true, followSymlinks: false })) rutas.add(resolve(cwd, coincidencia));
      continue;
    }
    const absoluta = normalizarRuta(cwd, fuente);
    if (!existsSync(absoluta)) continue;
    const estado = statSync(absoluta);
    if (estado.isFile()) { rutas.add(absoluta); continue; }
    if (estado.isDirectory()) {
      const recorrer = (directorio: string) => {
        for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
          if (entrada.isDirectory() && DIRECTORIOS_IGNORADOS.has(entrada.name)) continue;
          const ruta = join(directorio, entrada.name);
          if (entrada.isDirectory()) recorrer(ruta);
          else if (entrada.isFile()) rutas.add(ruta);
        }
      };
      recorrer(absoluta);
    }
  }
  return [...rutas].sort((a, b) => relative(cwd, a).localeCompare(relative(cwd, b)));
}
