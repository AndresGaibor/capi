import { basename, resolve } from "node:path";
import type { ProyectoDetectado } from "../../../nucleo/proyectos/Proyecto";
import { crearIdProyecto } from "../../../nucleo/proyectos/Proyecto";

export type ResolverRaizGit = (ruta: string) => string | null;

export function detectarProyectoDesdeRuta(ruta: string, resolverRaizGit: ResolverRaizGit): ProyectoDetectado {
  const absoluta = resolve(ruta);
  const raizGit = resolverRaizGit(absoluta);
  const rutaRaiz = resolve(raizGit ?? absoluta);
  return {
    id: crearIdProyecto(rutaRaiz),
    rutaRaiz,
    nombre: basename(rutaRaiz) || rutaRaiz,
    tipoDeteccion: raizGit ? "git" : "ruta",
  };
}

export function detectarProyectoActual(ruta = process.cwd()): ProyectoDetectado {
  return detectarProyectoDesdeRuta(ruta, (directorio) => {
    const proceso = Bun.spawnSync(["git", "-C", directorio, "rev-parse", "--show-toplevel"], { stderr: "ignore" });
    if (proceso.exitCode !== 0) return null;
    const salida = proceso.stdout.toString().trim();
    return salida || null;
  });
}
