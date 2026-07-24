import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../../nucleo/chat/PeticionChat";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
import type { RepositorioContextoSqlite } from "../../../plataforma/persistencia/RepositorioContextoSqlite";
import type { GestorContextoProyecto } from "../../conversaciones/aplicacion/GestorContextoProyecto";
import type { EmpaquetadorContexto, ResultadoPaqueteContexto } from "../../contexto/aplicacion/EmpaquetadorContexto";
import { obtenerDiffGit } from "../../contexto/aplicacion/ObtenerDiffGit";
import { seleccionarContextoAutomatico } from "../../contexto/aplicacion/SeleccionarContextoAutomatico";
import { resolverPresupuestoContexto } from "../../contexto/aplicacion/ResolverPresupuestoContexto";
import { filtrarContextoIncremental } from "../../contexto/aplicacion/FiltrarContextoIncremental";
import { construirIntentosRecuperacion, esErrorTransitorioProveedor, sugerenciaProveedorAlternativo } from "./PoliticaRecuperacionProveedor";

function git(cwd: string, args: string[]): string | undefined {
  const r = Bun.spawnSync(["git", "-C", cwd, ...args], { stdout: "pipe", stderr: "ignore" });
  return r.exitCode === 0 ? r.stdout.toString().trim() || undefined : undefined;
}

export class EnviarMensajeConContexto {
  constructor(
    private readonly proveedores: RegistroProveedores,
    private readonly gestor: GestorContextoProyecto,
    private readonly repositorio: RepositorioContextoSqlite,
    private readonly empaquetador?: EmpaquetadorContexto,
  ) {}

  async *ejecutar(proveedorId: string, peticion: PeticionChat): AsyncGenerator<EventoStreaming> {
    const proveedor = this.proveedores.obtener(proveedorId);
    const contextoProyecto = this.gestor.seleccionar(proveedorId, peticion.conversacionId);
    const proyecto = contextoProyecto.proyecto;
    const seleccion = peticion.forzarNueva ? { motivo: "nueva" as const } : contextoProyecto.seleccion;
    let idSeleccionado = peticion.forzarNueva ? undefined : seleccion.conversacionId;
    const cwd = peticion.contexto?.cwd ?? proyecto.rutaRaiz ?? process.cwd();
    let fuentes = [...(peticion.archivos ?? [])];
    let motivos: Record<string, string[]> | undefined;

    if (peticion.contexto?.automatico) {
      const auto = seleccionarContextoAutomatico(cwd, peticion.prompt);
      fuentes = [...new Set([...fuentes, ...auto.fuentes])];
      motivos = auto.motivos;
    }

    const presupuesto = resolverPresupuestoContexto(proveedorId, peticion.modelo, peticion.contexto?.maxBytes);
    let sinCambios: string[] = [];
    if (peticion.contexto?.incremental && idSeleccionado) {
      const anteriores = this.repositorio.obtenerHashesContexto?.(proyecto.id, proveedorId, idSeleccionado) ?? {};
      const filtro = filtrarContextoIncremental(cwd, fuentes, anteriores);
      fuentes = filtro.fuentes;
      sinCambios = filtro.sinCambios;
    }

    let paquete: ResultadoPaqueteContexto | undefined;
    let peticionPreparada = peticion;
    const extras: Array<{ nombre: string; contenido: string }> = [];
    if (peticion.contexto?.incluirDiff) {
      const diff = obtenerDiffGit(cwd);
      if (diff) extras.push({ nombre: "git-diff.patch", contenido: diff });
    }
    if (peticion.contexto?.incluirResumen && idSeleccionado) {
      const resumen = this.repositorio.obtenerResumenConversacion?.(proyecto.id, proveedorId, idSeleccionado);
      if (resumen) extras.push({ nombre: "resumen-conversacion.md", contenido: resumen });
    }
    if (sinCambios.length) extras.push({ nombre: "contexto-incremental.txt", contenido: `Archivos sin cambios omitidos:\n${sinCambios.map(x => `- ${x}`).join("\n")}` });

    const debeEmpaquetar = this.empaquetador && peticion.contexto?.empaquetar !== false && (fuentes.length || extras.length);
    if (debeEmpaquetar) {
      paquete = await this.empaquetador!.empaquetar({ cwd, fuentes, maxBytes: presupuesto.maxBytes, caracteresPorToken: presupuesto.caracteresPorToken, contenidoAdicional: extras, motivos });
      peticionPreparada = { ...peticion, archivos: [paquete.ruta] };
      yield {
        tipo: "contexto", ruta: paquete.ruta, bytes: paquete.bytes, tokensEstimados: paquete.tokensEstimados,
        archivosIncluidos: paquete.archivosIncluidos, omitidos: paquete.omitidos.length + sinCambios.length,
        truncados: paquete.truncados.length, desdeCache: paquete.desdeCache,
      };
    } else {
      peticionPreparada = { ...peticion, archivos: fuentes };
    }

    const procesoId = `${process.pid}-${crypto.randomUUID()}`;
    if (!this.repositorio.adquirirEjecucion(procesoId, Date.now(), 90_000, process.pid, 3)) {
      throw new Error("Ya existen 3 envíos simultáneos. Espera a que termine uno y vuelve a intentar.");
    }
    if (idSeleccionado && !this.repositorio.adquirirOcupacion(idSeleccionado, procesoId, Date.now(), 90_000, proveedorId)) {
      if (peticion.conversacionId) {
        this.repositorio.liberarEjecucion(procesoId);
        throw new Error(`La conversación ${idSeleccionado} está siendo usada por otro proceso.`);
      }
      idSeleccionado = undefined;
    }

    const historialId = crypto.randomUUID();
    this.repositorio.iniciarEjecucionHistorial?.({
      id: historialId, proyectoLocalId: proyecto.id, proveedor: proveedorId, modelo: peticion.modelo,
      conversacionId: idSeleccionado, rama: git(cwd, ["branch", "--show-current"]), commitGit: git(cwd, ["rev-parse", "HEAD"]),
      contextoHash: paquete?.hash, archivos: paquete?.archivos?.map(a => a.ruta) ?? fuentes,
    });

    const intervalo = setInterval(() => {
      this.repositorio.renovarEjecucion(procesoId, Date.now(), 90_000);
      if (idSeleccionado) this.repositorio.renovarOcupacion(idSeleccionado, procesoId, Date.now(), 90_000, proveedorId);
    }, 30_000);
    const candidatas = this.repositorio.listarConversacionesProyecto(proyecto.id);
    const motivoFinal = idSeleccionado ? seleccion.motivo : seleccion.conversacionId ? "nueva_por_ocupacion" : seleccion.motivo;
    yield { tipo: "inicio", mensaje: idSeleccionado ? `Reutilizando conversación del proyecto (${motivoFinal})...` : `Creando conversación para ${proyecto.nombre} (${motivoFinal})...` };

    let respuesta = "";
    let modeloFinal = peticion.modelo;
    let conversacionFinal = idSeleccionado;
    let errorFinal: unknown;
    let completado = false;
    try {
      const intentos = peticionPreparada.permitirFallback === false
        ? construirIntentosRecuperacion(proveedorId, peticionPreparada.modelo).slice(0, 1)
        : construirIntentosRecuperacion(proveedorId, peticionPreparada.modelo);
      let ultimoError: unknown;
      for (let indice = 0; indice < intentos.length; indice++) {
        const intento = intentos[indice]!;
        let emitioRespuesta = false;
        if (indice > 0) {
          yield { tipo: "inicio", mensaje: `Alta demanda detectada. Reintentando con ${intento.modelo ?? "modelo predeterminado"}...` };
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        try {
          const eventos = proveedor.enviarMensaje({
            ...peticionPreparada, modelo: intento.modelo,
            conversacionId: indice === 0 ? idSeleccionado : undefined,
            nuevaPestana: indice > 0 || (!idSeleccionado && candidatas.length > 0),
          });
          const iterador = eventos[Symbol.asyncIterator]();
          const limite = peticion.timeoutMs ? Date.now() + peticion.timeoutMs : undefined;
          while (true) {
            const restante = limite ? limite - Date.now() : undefined;
            if (restante != null && restante <= 0) { await iterador.return?.(undefined as never); throw new Error(`La operación excedió ${peticion.timeoutMs} ms`); }
            const siguiente = restante == null ? await iterador.next() : await Promise.race([
              iterador.next(),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`La operación excedió ${peticion.timeoutMs} ms`)), restante)),
            ]);
            if (siguiente.done) break;
            const evento = siguiente.value;
            if (evento.tipo === "respuesta") { emitioRespuesta = true; respuesta += evento.contenido; }
            if (evento.tipo === "modelo") modeloFinal = evento.nombre;
            yield evento;
          }
          completado = true;
          conversacionFinal = indice === 0 && idSeleccionado ? idSeleccionado : await proveedor.obtenerConversacionActual?.() ?? undefined;
          if (conversacionFinal) {
            this.repositorio.registrarConversacion({ id: conversacionFinal, proveedor: proveedorId, proyectoLocalId: proyecto.id, modelo: intento.modelo });
            if (paquete?.archivos?.length) {
              this.repositorio.guardarSnapshotContexto?.(proyecto.id, proveedorId, conversacionFinal, paquete.archivos);
              this.repositorio.registrarAdjuntosConfirmados?.(proyecto.id, proveedorId, conversacionFinal, paquete.archivos);
            }
            const resumenPrevio = this.repositorio.obtenerResumenConversacion?.(proyecto.id, proveedorId, conversacionFinal);
            const bloque = `## ${new Date().toISOString()}\n\n**Solicitud:** ${peticion.prompt.slice(0, 800)}\n\n**Resultado:** ${respuesta.slice(0, 2400)}\n\n**Archivos:** ${(paquete?.archivos?.map(a => a.ruta) ?? fuentes).join(", ") || "ninguno"}`;
            this.repositorio.guardarResumenConversacion?.(proyecto.id, proveedorId, conversacionFinal, `${resumenPrevio ? `${resumenPrevio}\n\n` : ""}${bloque}`.slice(-12000));
          }
          break;
        } catch (error) {
          ultimoError = error;
          if (emitioRespuesta || !esErrorTransitorioProveedor(error) || indice === intentos.length - 1) break;
        }
      }
      if (!completado) {
        const mensaje = ultimoError instanceof Error ? ultimoError.message : String(ultimoError);
        throw new Error(`${mensaje}\n${sugerenciaProveedorAlternativo(proveedorId)}`);
      }
    } catch (error) {
      errorFinal = error;
      throw error;
    } finally {
      clearInterval(intervalo);
      if (idSeleccionado) this.repositorio.liberarOcupacion(idSeleccionado, procesoId, proveedorId);
      this.repositorio.liberarEjecucion(procesoId);
      this.repositorio.finalizarEjecucionHistorial?.(historialId, {
        estado: completado ? "completada" : "fallida", conversacionId: conversacionFinal, modelo: modeloFinal,
        contextoHash: paquete?.hash, archivos: paquete?.archivos?.map(a => a.ruta) ?? fuentes,
        respuestaCaracteres: respuesta.length, error: errorFinal instanceof Error ? errorFinal.message : errorFinal ? String(errorFinal) : undefined,
      });
    }
  }
}
