import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const EXTENSIONES = [".ts", ".tsx", ".js", ".jsx", ".json", ".md"];

function ejecutar(cwd: string, args: string[]): string[] {
  const resultado = Bun.spawnSync(["git", "-C", cwd, ...args], { stdout: "pipe", stderr: "ignore" });
  if (resultado.exitCode !== 0) return [];
  return resultado.stdout.toString().split(/\r?\n/).map(x => x.trim()).filter(Boolean);
}

function resolverImportacion(origen: string, valor: string): string | null {
  if (!valor.startsWith(".")) return null;
  const base = resolve(dirname(origen), valor);
  const candidatos = [base, ...EXTENSIONES.map(ext => base + ext), ...EXTENSIONES.map(ext => join(base, `index${ext}`))];
  return candidatos.find(existsSync) ?? null;
}

export interface SeleccionContextoAutomatico {
  fuentes: string[];
  motivos: Record<string, string[]>;
}

export function seleccionarContextoAutomatico(cwd: string): SeleccionContextoAutomatico {
  const raiz = resolve(cwd);
  const cambiados = new Set([
    ...ejecutar(raiz, ["diff", "--name-only"]),
    ...ejecutar(raiz, ["diff", "--cached", "--name-only"]),
    ...ejecutar(raiz, ["ls-files", "--others", "--exclude-standard"]),
  ]);
  const motivos: Record<string, string[]> = {};
  const agregar = (ruta: string, motivo: string) => {
    const rel = relative(raiz, resolve(raiz, ruta)).replaceAll("\\", "/");
    if (!rel || rel.startsWith("..") || !existsSync(resolve(raiz, rel))) return;
    (motivos[rel] ??= []).push(motivo);
  };
  for (const ruta of cambiados) agregar(ruta, "archivo modificado");
  for (const ruta of [...cambiados]) {
    const absoluta = resolve(raiz, ruta);
    if (!existsSync(absoluta) || !/\.[cm]?[jt]sx?$/.test(absoluta)) continue;
    const texto = readFileSync(absoluta, "utf8");
    const re = /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
    for (const coincidencia of texto.matchAll(re)) {
      const resuelta = resolverImportacion(absoluta, coincidencia[1]!);
      if (resuelta) agregar(resuelta, `importado por ${ruta}`);
    }
    const sinExt = ruta.slice(0, -extname(ruta).length);
    for (const candidato of [`${sinExt}.test.ts`, `${sinExt}.test.tsx`, `${sinExt}.spec.ts`, `${sinExt}.spec.tsx`]) agregar(candidato, `prueba relacionada con ${ruta}`);
  }
  for (const fijo of ["README.md", "AGENTS.md", "package.json", "tsconfig.json"]) agregar(fijo, "archivo de contexto base");
  return { fuentes: Object.keys(motivos).sort(), motivos };
}
