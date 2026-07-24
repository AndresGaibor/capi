import { mkdirSync, readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface OmisionContexto { ruta: string; motivo: string }
export interface ArchivoIncluidoContexto { ruta: string; hash: string; bytes: number; motivo: string }
export interface ResultadoPaqueteContexto {
  ruta: string;
  hash: string;
  bytes: number;
  tokensEstimados: number;
  archivosIncluidos: number;
  archivos: ArchivoIncluidoContexto[];
  omitidos: OmisionContexto[];
  truncados: string[];
  desdeCache: boolean;
}

export interface SolicitudPaqueteContexto {
  cwd: string;
  fuentes: string[];
  maxBytes?: number;
  contenidoAdicional?: Array<{ nombre: string; contenido: string }>;
  motivos?: Record<string, string[]>;
  caracteresPorToken?: number;
}

const DIRECTORIOS_IGNORADOS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".nuxt", ".turbo", ".cache", "target", "vendor"]);
const EXTENSIONES_BINARIAS = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|rar|7z|mp[34]|mov|avi|mkv|woff2?|ttf|otf|exe|dll|so|dylib|class|jar|wasm|sqlite|db)$/i;
const NOMBRES_SECRETOS = /(^|\/)(\.env(?:\..*)?|.*\.(pem|key|p12|pfx)|credentials(?:\..*)?|secrets?(?:\..*)?|id_(rsa|ed25519))$/i;
const PATRONES_GLOB = /[*?{}[\]]/;

function normalizarRuta(cwd: string, ruta: string): string {
  const absoluta = isAbsolute(ruta) ? resolve(ruta) : resolve(cwd, ruta);
  return absoluta;
}

function esIgnorada(absoluta: string, cwd: string): string | null {
  const rel = relative(cwd, absoluta).split(sep).join("/");
  const segmentos = rel.split("/");
  if (segmentos.some((s) => DIRECTORIOS_IGNORADOS.has(s))) return "directorio ignorado";
  if (NOMBRES_SECRETOS.test(rel)) return "archivo sensible";
  if (EXTENSIONES_BINARIAS.test(rel)) return "archivo binario";
  return null;
}

function pareceBinario(buffer: Buffer): boolean {
  const muestra = buffer.subarray(0, Math.min(buffer.length, 8192));
  return muestra.includes(0);
}

function sanearTexto(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/((?:api[_-]?key|token|password|secret|authorization)\s*[:=]\s*)[^\s"']+/gi, "$1[REDACTADO]")
    .replace(/[ \t]+$/gm, "");
}

async function expandirFuentes(cwd: string, fuentes: string[]): Promise<string[]> {
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

export class EmpaquetadorContexto {
  constructor(private readonly directorioCache: string) { mkdirSync(directorioCache, { recursive: true }); }

  async empaquetar(solicitud: SolicitudPaqueteContexto): Promise<ResultadoPaqueteContexto> {
    const cwd = resolve(solicitud.cwd);
    const maxBytes = Math.max(1024, solicitud.maxBytes ?? 4 * 1024 * 1024);
    const omitidos: OmisionContexto[] = [];
    const truncados: string[] = [];
    const archivos: ArchivoIncluidoContexto[] = [];
    const entradas: Array<{ nombre: string; contenido: string }> = [];
    const rutas = await expandirFuentes(cwd, solicitud.fuentes);

    for (const absoluta of rutas) {
      const nombre = relative(cwd, absoluta).split(sep).join("/") || basename(absoluta);
      const motivo = esIgnorada(absoluta, cwd);
      if (motivo) { omitidos.push({ ruta: nombre, motivo }); continue; }
      try {
        const buffer = readFileSync(absoluta);
        if (pareceBinario(buffer)) { omitidos.push({ ruta: nombre, motivo: "contenido binario" }); continue; }
        entradas.push({ nombre, contenido: sanearTexto(buffer.toString("utf8")) });
      } catch (error) {
        omitidos.push({ ruta: nombre, motivo: error instanceof Error ? error.message : "no legible" });
      }
    }
    for (const extra of solicitud.contenidoAdicional ?? []) entradas.push({ nombre: extra.nombre, contenido: sanearTexto(extra.contenido) });
    entradas.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const indice = entradas.map((e) => `- ${e.nombre}`).join("\n");
    let salida = `CAPI CONTEXT BUNDLE v1\nROOT: ${cwd}\nFILES: ${entradas.length}\n\nINDEX\n${indice}\n`;
    let incluidos = 0;
    for (const entrada of entradas) {
      const inicio = `\n===== FILE: ${entrada.nombre} =====\n`;
      const fin = `\n===== END FILE: ${entrada.nombre} =====\n`;
      const disponible = maxBytes - Buffer.byteLength(salida) - Buffer.byteLength(inicio) - Buffer.byteLength(fin);
      if (disponible <= 64) { omitidos.push({ ruta: entrada.nombre, motivo: "límite del paquete" }); continue; }
      let contenido = entrada.contenido;
      if (Buffer.byteLength(contenido) > disponible) {
        contenido = Buffer.from(contenido).subarray(0, Math.max(0, disponible - 48)).toString("utf8") + "\n[TRUNCADO POR CAPI]";
        truncados.push(entrada.nombre);
      }
      salida += inicio + contenido + fin;
      const hashArchivo = new Bun.CryptoHasher("sha256").update(entrada.contenido).digest("hex");
      archivos.push({ ruta: entrada.nombre, hash: hashArchivo, bytes: Buffer.byteLength(contenido), motivo: solicitud.motivos?.[entrada.nombre]?.join(", ") ?? "fuente solicitada" });
      incluidos++;
    }
    if (omitidos.length) salida += `\n===== OMITIDOS =====\n${omitidos.map((o) => `- ${o.ruta}: ${o.motivo}`).join("\n")}\n`;
    if (Buffer.byteLength(salida) > maxBytes) salida = Buffer.from(salida).subarray(0, maxBytes).toString("utf8");

    const hash = new Bun.CryptoHasher("sha256").update(salida).digest("hex");
    const ruta = join(this.directorioCache, `contexto-${hash.slice(0, 20)}.txt`);
    const desdeCache = existsSync(ruta);
    if (!desdeCache) await Bun.write(ruta, salida);
    const bytes = Buffer.byteLength(salida);
    return { ruta, hash, bytes, tokensEstimados: Math.ceil(salida.length / (solicitud.caracteresPorToken ?? 4)), archivosIncluidos: incluidos, archivos, omitidos, truncados, desdeCache };
  }
}
