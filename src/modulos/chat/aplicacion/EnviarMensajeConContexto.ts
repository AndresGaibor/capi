import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../../nucleo/chat/PeticionChat";
import type { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
import type { RepositorioContextoSqlite } from "../../../plataforma/persistencia/RepositorioContextoSqlite";
import type { GestorContextoProyecto } from "../../conversaciones/aplicacion/GestorContextoProyecto";
import type { EmpaquetadorContexto } from "../../contexto/aplicacion/EmpaquetadorContexto";
import { intentosMultimodales } from "../../modelos/aplicacion/SeleccionarModeloMultimodal";
import { construirIntentosRecuperacion } from "./PoliticaRecuperacionProveedor";
import { ControlEjecucionChat } from "./ControlEjecucionChat";
import { RegistroChatHistorial } from "./RegistroChatHistorial";
import { prepararContextoChat, obtenerGit } from "./PrepararContextoChat";
import { EjecutarIntentosChat } from "./EjecutarIntentosChat";
import { SupervisorEjecucionChat } from "./SupervisorEjecucionChat";
import { esErrorEjecucionCancelada } from "./ErrorEjecucionCancelada";
import { identidadProceso } from "../../../plataforma/procesos/IdentidadProceso";
import { createHash } from "node:crypto";
import { CAPI_CONFIG } from "../../../configuracion/ConstantesCapi";

export class EnviarMensajeConContexto {
  private readonly control: ControlEjecucionChat;
  private readonly historial: RegistroChatHistorial;

  constructor(
    private readonly proveedores: RegistroProveedores,
    private readonly gestor: GestorContextoProyecto,
    private readonly repositorio: RepositorioContextoSqlite,
    private readonly empaquetador?: EmpaquetadorContexto,
  ) {
    this.control = new ControlEjecucionChat(repositorio);
    this.historial = new RegistroChatHistorial(repositorio);
  }

  async *ejecutar(
    proveedorId: string,
    peticion: PeticionChat,
  ): AsyncGenerator<EventoStreaming> {
    const proveedor = this.proveedores.obtener(proveedorId);
    const { proyecto, seleccion } = this.gestor.seleccionar(
      proveedorId,
      peticion.conversacionId,
    );
    const idSeleccionado = peticion.forzarNueva
      ? undefined
      : seleccion.conversacionId;
    const cwd = peticion.contexto?.cwd ?? proyecto.rutaRaiz ?? process.cwd();
    const ejecucionId = process.env.CAPI_TASK_ID || crypto.randomUUID();
    const identidad = identidadProceso();
    const supervisor = new SupervisorEjecucionChat(this.repositorio, { id: ejecucionId, proyectoLocalId: proyecto.id, proveedor: proveedorId, propietarioId: identidad.propietarioId, pid: identidad.pid, hostname: identidad.hostname, bootId: identidad.bootId, modo: process.env.CAPI_TASK_CHILD ? "background" : "foreground", prompt: peticion.prompt, modelo: peticion.modelo, conversacionId: idSeleccionado, guardarContenido: process.env.CAPI_NO_GUARDAR_RESPUESTAS !== "1" });
    supervisor.iniciar();
    yield { tipo: "ejecucion", id: ejecucionId };
    supervisor.estado("preparando");

    const preparado = await prepararContextoChat(
      peticion,
      proyecto.id,
      proveedorId,
      idSeleccionado,
      this.repositorio,
      this.empaquetador,
    );
    const {
      paquete,
      peticion: peticionPreparada,
      fuentes,
      adjuntosNativos,
      sinCambios,
      modelo: modeloMultimodal,
    } = preparado;

    if (paquete) {
      yield {
        tipo: "contexto",
        ruta: paquete.ruta,
        bytes: paquete.bytes,
        tokensEstimados: paquete.tokensEstimados,
        archivosIncluidos: paquete.archivosIncluidos,
        omitidos: paquete.omitidos.length + sinCambios.length,
        truncados: paquete.truncados.length,
        desdeCache: paquete.desdeCache,
      };
    }

    const historialId = crypto.randomUUID();
    const archivosFinales = [
      ...(paquete?.archivos?.map((a) => a.ruta) ?? fuentes),
      ...adjuntosNativos,
    ];
    const huellaEnvio = createHash("sha256").update(JSON.stringify({ ejecucionId, proveedorId, conversacionId:idSeleccionado??null, prompt:peticion.prompt, archivos:[...archivosFinales].sort() })).digest("hex");
    const envioExistente = this.repositorio.obtenerEnvioIdempotente?.(huellaEnvio);
    if (envioExistente && !peticion.soloPoll && this.repositorio.debeEvitarReenvio?.(huellaEnvio)) {
      const error=new Error("El estado del envío anterior es incierto o ya fue confirmado. Usa --continuar para observar sin reenviar.");
      Object.assign(error,{codigo:"ENVIO_INCIERTO"}); supervisor.marcarFallo(error,"ENVIO_INCIERTO"); throw error;
    }
    if (!envioExistente && !peticion.soloPoll) this.repositorio.registrarEnvioIdempotente?.({huella:huellaEnvio,proveedor:proveedorId,conversacionId:idSeleccionado,promptHash:createHash("sha256").update(peticion.prompt).digest("hex"),archivosHash:createHash("sha256").update([...archivosFinales].sort().join("\n")).digest("hex"),estado:"preparado"});

    let idFinal = idSeleccionado;
    const controlResultado = this.control.iniciar({
      proyectoId: proyecto.id,
      proveedorId,
      conversacionId: idSeleccionado,
    });

    if (controlResultado.ocupacionFallida) {
      this.control.liberar();
      throw new Error(
        `La conversación ${idSeleccionado} está siendo usada por otro proceso. No se creará una conversación nueva; reintenta cuando termine o usa --continuar.`,
      );
    }

    this.historial.iniciar({
      historialId,
      proyectoId: proyecto.id,
      proveedorId,
      modelo: modeloMultimodal,
      conversacionId: idFinal,
      ...obtenerGit(cwd),
      contextoHash: paquete?.hash,
      archivos: archivosFinales,
    });

    const candidatas = this.repositorio.listarConversacionesProyecto(
      proyecto.id,
    );
    const motivoFinal = idFinal
      ? seleccion.motivo
      : seleccion.conversacionId
        ? "nueva_por_ocupacion"
        : seleccion.motivo;
    yield {
      tipo: "inicio",
      mensaje: idFinal
        ? `Reutilizando conversación del proyecto (${motivoFinal})...`
        : `Creando conversación para ${proyecto.nombre} (${motivoFinal})...`,
    };

    let respuesta = "";
    let modeloFinal = modeloMultimodal;
    let conversacionFinal = idFinal;
    let errorFinal: unknown;
    let cancelada = false;
    let completado = false;
    let pausado = false;
    let pensamiento = "";
    let envioConfirmado = Boolean(envioExistente && /^confirmado_/.test(envioExistente.estado));

    try {
      if (!peticion.soloPoll && !envioConfirmado) this.repositorio.actualizarEnvioIdempotente?.(huellaEnvio,"intentando_enviar");
      const intentos = this.construirIntentos(
        proveedorId,
        peticion,
        modeloMultimodal,
        preparado.imagenesNativas > 0,
      );
      const intentosChat = new EjecutarIntentosChat();
      const intervaloHeartbeat = setInterval(() => supervisor.heartbeat({ respuestaCaracteres: respuesta.length, pensamientoCaracteres: pensamiento.length }), CAPI_CONFIG.TIMEOUTS_MS.HEARTBEAT_EJECUCION_MS);
      try {
        for await (const evento of intentosChat.ejecutar(proveedor, peticionPreparada, intentos, idFinal, candidatas.length)) {
          this.control.verificarLease();
          supervisor.verificarCancelacion();
          if (evento.tipo === "pausado") pausado = true;
          if (evento.tipo === "pensamiento") pensamiento += evento.contenido;
          supervisor.registrar(evento);
          if (!envioConfirmado && ["pensamiento","respuesta","conversacion"].includes(evento.tipo)) { envioConfirmado=true; this.repositorio.actualizarEnvioIdempotente?.(huellaEnvio,"confirmado_dom"); }
          yield evento;
        }
      } catch (error) {
        if (!idFinal || !this.esConversacionInvalida(error)) throw error;
        this.repositorio.marcarSaludConversacion?.(idFinal, proveedorId, "eliminada_remotamente", "CONVERSACION_INVALIDA");
        const recuperacion = new EjecutarIntentosChat();
        for await (const evento of recuperacion.ejecutar(proveedor, { ...peticionPreparada, nuevaPestana: true }, intentos.slice(0, 1), undefined, candidatas.length)) {
          this.control.verificarLease();
          supervisor.verificarCancelacion();
          if (evento.tipo === "pausado") pausado = true;
          if (evento.tipo === "pensamiento") pensamiento += evento.contenido;
          supervisor.registrar(evento);
          if (!envioConfirmado && ["pensamiento","respuesta","conversacion"].includes(evento.tipo)) { envioConfirmado=true; this.repositorio.actualizarEnvioIdempotente?.(huellaEnvio,"confirmado_dom"); }
          yield evento;
        }
        intentosChat.respuesta = recuperacion.respuesta;
        intentosChat.modelo = recuperacion.modelo;
        intentosChat.conversacionId = recuperacion.conversacionId;
      } finally {
        clearInterval(intervaloHeartbeat);
      }
      respuesta = intentosChat.respuesta;
      modeloFinal = intentosChat.modelo;
      conversacionFinal = intentosChat.conversacionId;
      completado = !pausado;

      if (conversacionFinal && (pausado || peticion.soloPoll)) {
        this.repositorio.guardarCheckpoint?.({ proyectoLocalId: proyecto.id, proveedor: proveedorId, conversacionId: conversacionFinal, motivo: pausado ? "streaming_pausado" : "continuacion_observada", pensamiento, respuesta, estado: pausado ? "pausado" : "completado" });
      }

      if (conversacionFinal) {
        this.historial.registrarConversacionYAdjuntos({
          conversacionId: conversacionFinal,
          proyectoId: proyecto.id,
          proveedorId,
          modelo: modeloFinal,
          archivos: archivosFinales,
          adjuntosNativos,
          paquete: paquete ? { archivos: paquete.archivos } : undefined,
          prompt: peticion.prompt,
          respuesta,
          hacerPrincipal: peticion.forzarNueva === true,
        });
      }
    } catch (error) {
      errorFinal = error;
      cancelada = esErrorEjecucionCancelada(error);
      if (!peticion.soloPoll && !envioConfirmado) this.repositorio.actualizarEnvioIdempotente?.(huellaEnvio,"desconocido");
      if (!cancelada) supervisor.marcarFallo(error);
      throw error;
    } finally {
      this.control.liberar();
      this.historial.finalizar({
        historialId,
        estado: completado ? "completada" : pausado ? "pausada" : cancelada ? "cancelada" : "fallida",
        conversacionId: conversacionFinal,
        modelo: modeloFinal,
        contextoHash: paquete?.hash,
        archivos: archivosFinales,
        respuestaCaracteres: respuesta.length,
        error: cancelada
          ? undefined
          : errorFinal instanceof Error
            ? errorFinal.message
            : errorFinal
              ? String(errorFinal)
              : undefined,
      });
    }
  }

  private esConversacionInvalida(error: unknown): boolean {
    return !!error && typeof error === "object" && "codigo" in error && (error as { codigo?: string }).codigo === "CONVERSACION_INVALIDA";
  }

  private construirIntentos(
    proveedorId: string,
    peticion: PeticionChat,
    modeloMultimodal: string | undefined,
    tieneImagenes: boolean,
  ) {
    const intentosBase = tieneImagenes
      ? intentosMultimodales(proveedorId, "image").map((modelo) => ({
          proveedor: proveedorId,
          modelo,
        }))
      : construirIntentosRecuperacion(proveedorId, modeloMultimodal);
    const inicioModelo = modeloMultimodal
      ? intentosBase.findIndex((i) => i.modelo === modeloMultimodal)
      : 0;
    const intentosOrdenados =
      inicioModelo > 0
        ? [
            ...intentosBase.slice(inicioModelo),
            ...intentosBase.slice(0, inicioModelo),
          ]
        : intentosBase;
    return peticion.permitirFallback === false
      ? intentosOrdenados.slice(0, 1)
      : intentosOrdenados;
  }
}
