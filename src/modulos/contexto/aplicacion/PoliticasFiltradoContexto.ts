import { isAbsolute, resolve, relative, sep } from "node:path";

export const DIRECTORIOS_IGNORADOS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".nuxt", ".turbo", ".cache", "target", "vendor"]);

export const EXTENSIONES_BINARIAS = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|rar|7z|mp[34]|mov|avi|mkv|woff2?|ttf|otf|exe|dll|so|dylib|class|jar|wasm|sqlite|db)$/i;

export const NOMBRES_SECRETOS = /(^|\/)(\.env(?:\..*)?|.*\.(pem|key|p12|pfx)|credentials(?:\..*)?|secrets?(?:\..*)?|id_(rsa|ed25519))$/i;

export function normalizarRuta(cwd: string, ruta: string): string {
  return isAbsolute(ruta) ? resolve(ruta) : resolve(cwd, ruta);
}

export function esIgnorada(absoluta: string, cwd: string): string | null {
  const rel = relative(cwd, absoluta).split(sep).join("/");
  const segmentos = rel.split("/");
  if (segmentos.some((s) => DIRECTORIOS_IGNORADOS.has(s))) return "directorio ignorado";
  if (NOMBRES_SECRETOS.test(rel)) return "archivo sensible";
  if (EXTENSIONES_BINARIAS.test(rel)) return "archivo binario";
  return null;
}

export function pareceBinario(buffer: Buffer): boolean {
  const muestra = buffer.subarray(0, Math.min(buffer.length, 8192));
  return muestra.includes(0);
}

export function sanearTexto(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/((?:api[_-]?key|token|password|secret|authorization)\s*[:=]\s*)[^\s"']+/gi, "$1[REDACTADO]")
    .replace(/[ \t]+$/gm, "");
}
