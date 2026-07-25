import type { PeticionChat } from "../../../nucleo/chat/PeticionChat";
import type { RepositorioContextoSqlite } from "../../../plataforma/persistencia/RepositorioContextoSqlite";
import type {
  EmpaquetadorContexto,
  ResultadoPaqueteContexto,
} from "../../contexto/aplicacion/EmpaquetadorContexto";
import { obtenerDiffGit } from "../../contexto/aplicacion/ObtenerDiffGit";
import { seleccionarContextoAutomatico } from "../../contexto/aplicacion/SeleccionarContextoAutomatico";
import { resolverPresupuestoContexto } from "../../contexto/aplicacion/ResolverPresupuestoContexto";
import { filtrarContextoIncremental } from "../../contexto/aplicacion/FiltrarContextoIncremental";
import { separarAdjuntosContexto } from "../../contexto/aplicacion/SepararAdjuntosContexto";
import { seleccionarModeloMultimodal } from "../../modelos/aplicacion/SeleccionarModeloMultimodal";

export interface ContextoChatPreparado {
  paquete?: ResultadoPaqueteContexto;
  peticion: PeticionChat;
  fuentes: string[];
  adjuntosNativos: string[];
  imagenesNativas: number;
  sinCambios: string[];
  modelo: string | undefined;
  motivos?: Record<string, string[]>;
}

interface FuentesChat {
  cwd: string;
  fuentes: string[];
  motivos?: Record<string, string[]>;
}

function git(cwd: string, args: string[]): string | undefined {
  const resultado = Bun.spawnSync(["git", "-C", cwd, ...args], {
    stdout: "pipe",
    stderr: "ignore",
  });
  return resultado.exitCode === 0
    ? resultado.stdout.toString().trim() || undefined
    : undefined;
}

export async function prepararContextoChat(
  peticion: PeticionChat,
  proyectoId: string,
  proveedorId: string,
  conversacionId: string | undefined,
  repositorio: RepositorioContextoSqlite,
  empaquetador?: EmpaquetadorContexto,
): Promise<ContextoChatPreparado> {
  const seleccion = seleccionarFuentesChat(peticion);
  let fuentes = seleccion.fuentes;
  const separados = separarAdjuntosYModelo(fuentes, peticion, proveedorId);
  if (separados.rechazados.length) {
    throw new Error(
      `Adjuntos rechazados: ${separados.rechazados.map((a) => `${a.ruta}: ${a.motivo}`).join("; ")}`,
    );
  }

  const { adjuntosNativos, modelo } = separados;
  fuentes = separados.textuales;
  const presupuesto = resolverPresupuestoContexto(
    proveedorId,
    modelo,
    peticion.contexto?.maxBytes,
  );
  let sinCambios: string[] = [];

  if (peticion.contexto?.incremental && conversacionId) {
    const anteriores = repositorio.obtenerHashesContexto(
      proyectoId,
      proveedorId,
      conversacionId,
    );
    const filtro = filtrarContextoIncremental(
      seleccion.cwd,
      fuentes,
      anteriores,
    );
    fuentes = filtro.fuentes;
    sinCambios = filtro.sinCambios;
  }

  const extras = construirExtras(
    seleccion.cwd,
    peticion,
    repositorio,
    proyectoId,
    proveedorId,
    conversacionId,
    sinCambios,
  );
  const debeEmpaquetar =
    empaquetador &&
    peticion.contexto?.empaquetar !== false &&
    (fuentes.length || extras.length);
  if (!debeEmpaquetar) {
    return {
      peticion: {
        ...peticion,
        modelo,
        archivos: [...fuentes, ...adjuntosNativos],
        imagenes: undefined,
      },
      fuentes,
      adjuntosNativos,
      imagenesNativas: separados.imagenes.length,
      sinCambios,
      modelo,
      motivos: seleccion.motivos,
    };
  }

  const paquete = await empaquetador.empaquetar({
    cwd: seleccion.cwd,
    fuentes,
    maxBytes: presupuesto.maxBytes,
    caracteresPorToken: presupuesto.caracteresPorToken,
    contenidoAdicional: extras,
    motivos: seleccion.motivos,
  });
  return {
    paquete,
    peticion: {
      ...peticion,
      modelo,
      archivos: [paquete.ruta, ...adjuntosNativos],
      imagenes: undefined,
    },
    fuentes,
    adjuntosNativos,
    imagenesNativas: separados.imagenes.length,
    sinCambios,
    modelo,
    motivos: seleccion.motivos,
  };
}

function seleccionarFuentesChat(peticion: PeticionChat): FuentesChat {
  const cwd = peticion.contexto?.cwd ?? process.cwd();
  const fuentesIniciales = [
    ...(peticion.archivos ?? []),
    ...(peticion.imagenes ?? []),
  ];
  if (!peticion.contexto?.automatico) return { cwd, fuentes: fuentesIniciales };

  const automatico = seleccionarContextoAutomatico(cwd, peticion.prompt);
  return {
    cwd,
    fuentes: [...new Set([...fuentesIniciales, ...automatico.fuentes])],
    motivos: automatico.motivos,
  };
}

function separarAdjuntosYModelo(
  fuentes: string[],
  peticion: PeticionChat,
  proveedorId: string,
) {
  const separados = separarAdjuntosContexto(fuentes);
  const adjuntosNativos = [...separados.imagenes, ...separados.documentos];
  // El modelo se resuelve antes del presupuesto porque cada modalidad tiene límites distintos.
  const modelo = adjuntosNativos.length
    ? seleccionarModeloMultimodal(
        proveedorId,
        peticion.modelo,
        separados.imagenes.length ? "image" : "document",
        separados.detectados
          .filter(
            (a) =>
              a.categoria ===
              (separados.imagenes.length ? "imagen" : "documento"),
          )
          .map((a) => a.mime),
        peticion.permitirFallback === false,
      )
    : peticion.modelo;
  return { ...separados, adjuntosNativos, modelo };
}

function construirExtras(
  cwd: string,
  peticion: PeticionChat,
  repositorio: RepositorioContextoSqlite,
  proyectoId: string,
  proveedorId: string,
  conversacionId: string | undefined,
  sinCambios: string[],
): Array<{ nombre: string; contenido: string }> {
  const extras: Array<{ nombre: string; contenido: string }> = [];
  if (peticion.contexto?.incluirDiff) {
    const diff = obtenerDiffGit(cwd);
    if (diff) extras.push({ nombre: "git-diff.patch", contenido: diff });
  }
  if (peticion.contexto?.incluirResumen && conversacionId) {
    const resumen = repositorio.obtenerResumenConversacion(
      proyectoId,
      proveedorId,
      conversacionId,
    );
    if (resumen)
      extras.push({ nombre: "resumen-conversacion.md", contenido: resumen });
  }
  if (sinCambios.length)
    extras.push({
      nombre: "contexto-incremental.txt",
      contenido: `Archivos sin cambios omitidos:\n${sinCambios.map((x) => `- ${x}`).join("\n")}`,
    });
  return extras;
}

export function obtenerGit(cwd: string): { rama?: string; commitGit?: string } {
  return {
    rama: git(cwd, ["branch", "--show-current"]),
    commitGit: git(cwd, ["rev-parse", "HEAD"]),
  };
}
