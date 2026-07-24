import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../../nucleo/chat/PeticionChat";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
import type { RepositorioContextoSqlite } from "../../../plataforma/persistencia/RepositorioContextoSqlite";
import type { GestorContextoProyecto } from "../../conversaciones/aplicacion/GestorContextoProyecto";
import type { EmpaquetadorContexto } from "../../contexto/aplicacion/EmpaquetadorContexto";
import { obtenerDiffGit } from "../../contexto/aplicacion/ObtenerDiffGit";
import { construirIntentosRecuperacion, esErrorTransitorioProveedor, sugerenciaProveedorAlternativo } from "./PoliticaRecuperacionProveedor";

export class EnviarMensajeConContexto {
  constructor(
    private readonly proveedores: RegistroProveedores,
    private readonly gestor: GestorContextoProyecto,
    private readonly repositorio: RepositorioContextoSqlite,
    private readonly empaquetador?: EmpaquetadorContexto,
  ) {}

  async *ejecutar(proveedorId: string, peticion: PeticionChat): AsyncGenerator<EventoStreaming> {
    const proveedor = this.proveedores.obtener(proveedorId);
    const contexto = this.gestor.seleccionar(proveedorId, peticion.conversacionId);
    const proyecto = contexto.proyecto;
    const seleccion = peticion.forzarNueva ? { motivo: "nueva" as const } : contexto.seleccion;
    let peticionPreparada = peticion;
    const debeEmpaquetar = this.empaquetador && (peticion.archivos?.length || peticion.contexto?.incluirDiff) && peticion.contexto?.empaquetar !== false;
    if (debeEmpaquetar) {
      const diff = peticion.contexto?.incluirDiff ? obtenerDiffGit(peticion.contexto.cwd ?? proyecto.rutaRaiz ?? process.cwd()) : "";
      const paquete = await this.empaquetador!.empaquetar({
        cwd: peticion.contexto?.cwd ?? proyecto.rutaRaiz ?? process.cwd(),
        fuentes: peticion.archivos ?? [],
        maxBytes: peticion.contexto?.maxBytes,
        contenidoAdicional: diff ? [{ nombre: "git-diff.patch", contenido: diff }] : undefined,
      });
      peticionPreparada = { ...peticion, archivos: [paquete.ruta] };
      yield { tipo: "contexto", ruta: paquete.ruta, bytes: paquete.bytes, tokensEstimados: paquete.tokensEstimados, archivosIncluidos: paquete.archivosIncluidos, omitidos: paquete.omitidos.length, truncados: paquete.truncados.length, desdeCache: paquete.desdeCache };
    }
    const procesoId = `${process.pid}-${crypto.randomUUID()}`;
    if (!this.repositorio.adquirirEjecucion(procesoId, Date.now(), 90_000, process.pid, 3)) {
      throw new Error("Ya existen 3 envíos simultáneos. Espera a que termine uno y vuelve a intentar.");
    }
    let idSeleccionado = seleccion.conversacionId;
    if (idSeleccionado && !this.repositorio.adquirirOcupacion(idSeleccionado, procesoId, Date.now(), 90_000, proveedorId)) {
      if (peticion.conversacionId) {
        this.repositorio.liberarEjecucion(procesoId);
        throw new Error(`La conversación ${idSeleccionado} está siendo usada por otro proceso.`);
      }
      idSeleccionado = undefined;
    }
    const intervalo = setInterval(() => {
      this.repositorio.renovarEjecucion(procesoId, Date.now(), 90_000);
      if (idSeleccionado) this.repositorio.renovarOcupacion(idSeleccionado, procesoId, Date.now(), 90_000, proveedorId);
    }, 30_000);
    const candidatas = this.repositorio.listarConversacionesProyecto(proyecto.id);
    const motivoFinal = idSeleccionado ? seleccion.motivo : seleccion.conversacionId ? "nueva_por_ocupacion" : seleccion.motivo;
    yield { tipo: "inicio", mensaje: idSeleccionado ? `Reutilizando conversación del proyecto (${motivoFinal})...` : `Creando conversación para ${proyecto.nombre} (${motivoFinal})...` };
    try {
      const intentos = peticionPreparada.permitirFallback === false ? construirIntentosRecuperacion(proveedorId, peticionPreparada.modelo).slice(0, 1) : construirIntentosRecuperacion(proveedorId, peticionPreparada.modelo);
      let completado = false;
      let ultimoError: unknown;
      for (let indice = 0; indice < intentos.length; indice++) {
        const intento = intentos[indice]!;
        let emitioRespuesta = false;
        if (indice > 0) {
          yield { tipo: "inicio", mensaje: `Alta demanda detectada. Reintentando con ${intento.modelo ?? "modelo predeterminado"}...` };
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        try {
          const eventos = proveedor.enviarMensaje({
            ...peticionPreparada,
            modelo: intento.modelo,
            conversacionId: indice === 0 ? idSeleccionado : undefined,
            nuevaPestana: indice > 0 || (!idSeleccionado && candidatas.length > 0),
          });
          for await (const evento of eventos) {
            if (evento.tipo === "respuesta") emitioRespuesta = true;
            yield evento;
          }
          completado = true;
          const actual = indice === 0 && idSeleccionado ? idSeleccionado : await proveedor.obtenerConversacionActual?.();
          if (actual) this.repositorio.registrarConversacion({ id: actual, proveedor: proveedorId, proyectoLocalId: proyecto.id, modelo: intento.modelo });
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
    } finally {
      clearInterval(intervalo);
      if (idSeleccionado) this.repositorio.liberarOcupacion(idSeleccionado, procesoId, proveedorId);
      this.repositorio.liberarEjecucion(procesoId);
    }
  }
}
