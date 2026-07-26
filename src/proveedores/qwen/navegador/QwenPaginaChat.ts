import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { ModeloChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { QwenEnvio } from "./QwenEnvio";
import { QwenModelos } from "./QwenModelos";
import { QwenNavegacion } from "./QwenNavegacion";
import { QwenStreaming } from "./QwenStreaming";
import { QwenConversaciones } from "./QwenConversaciones";
import { QwenOpciones } from "./QwenOpciones";
import type { ResultadoAdjuntos } from "../../../nucleo/archivos/EstrategiaAdjuntos";
import type { GestorPestanas } from "../../../plataforma/webbridge/GestorPestanas";
import type { ResumenConversacionQwen } from "./QwenConversaciones";
import { scriptDiagnosticarPagina } from "../../preflight/scriptDiagnosticarPagina";

export class QwenPaginaChat {
  private readonly transporte: TransporteNavegador;
  private readonly navegacion: QwenNavegacion;
  private readonly modelos: QwenModelos;
  private readonly envio: QwenEnvio;
  private readonly streaming: QwenStreaming;
  private readonly conversaciones: QwenConversaciones;
  private readonly opciones: QwenOpciones;

  constructor(transporte: TransporteNavegador, gestorPestanas?: GestorPestanas) {
    this.transporte = transporte;
    this.navegacion = new QwenNavegacion(transporte, undefined, gestorPestanas);
    this.modelos = new QwenModelos(transporte);
    this.envio = new QwenEnvio(transporte);
    this.streaming = new QwenStreaming(transporte);
    this.conversaciones = new QwenConversaciones(transporte);
    this.opciones = new QwenOpciones(transporte);
  }

  verificarDisponibilidad(): Promise<void> { return this.navegacion.verificarDisponibilidad(); }
  abrirConversacion(id?: string, nuevaPestana = false): Promise<void> { return this.navegacion.abrirConversacion(id, nuevaPestana); }
  listarModelos(): Promise<ModeloChat[]> { return this.modelos.listar(); }
  seleccionarModelo(modelo: string): Promise<ModeloChat> { return this.modelos.seleccionar(modelo); }
  configurarRazonamiento(activar: boolean): Promise<void> { return this.opciones.configurarRazonamiento(activar); }
  adjuntar(rutas: string[] = []): Promise<ResultadoAdjuntos> { return this.envio.adjuntar(rutas); }
  enviarPrompt(prompt: string): Promise<void> { return this.envio.enviar(prompt); }
  observarStreaming(conversacionId?: string): AsyncGenerator<EventoStreaming> { return this.streaming.observar(conversacionId); }
  async obtenerConversacionActual(intentos = 1): Promise<string | null> { return this.navegacion.obtenerConversacionActual(intentos); }
  listarConversaciones(): Promise<ResumenConversacionQwen[]> { return this.conversaciones.listar(); }
  async diagnosticar(): Promise<Record<string, unknown>> { return (await this.transporte.evaluar<Record<string, unknown>>(scriptDiagnosticarPagina("qwen"))).value ?? { proveedor: "qwen", ok: false, codigo: "PAGINA_NO_COMPATIBLE" }; }
}
