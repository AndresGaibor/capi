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
    let completado = false;
    let pausado = false;

    try {
      const intentos = this.construirIntentos(
        proveedorId,
        peticion,
        modeloMultimodal,
        preparado.imagenesNativas > 0,
      );
      const intentosChat = new EjecutarIntentosChat();
      for await (const evento of intentosChat.ejecutar(
        proveedor,
        peticionPreparada,
        intentos,
        idFinal,
        candidatas.length,
      )) {
        if (evento.tipo === "pausado") pausado = true;
        yield evento;
      }
      respuesta = intentosChat.respuesta;
      modeloFinal = intentosChat.modelo;
      conversacionFinal = intentosChat.conversacionId;
      completado = !pausado;

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
      throw error;
    } finally {
      this.control.liberar();
      this.historial.finalizar({
        historialId,
        estado: completado ? "completada" : pausado ? "pausada" : "fallida",
        conversacionId: conversacionFinal,
        modelo: modeloFinal,
        contextoHash: paquete?.hash,
        archivos: archivosFinales,
        respuestaCaracteres: respuesta.length,
        error:
          errorFinal instanceof Error
            ? errorFinal.message
            : errorFinal
              ? String(errorFinal)
              : undefined,
      });
    }
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
