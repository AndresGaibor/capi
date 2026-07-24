import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { ModeloChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { QwenEnvio } from "./QwenEnvio";
import { QwenModelos } from "./QwenModelos";
import { QwenNavegacion } from "./QwenNavegacion";
import { QwenStreaming } from "./QwenStreaming";
import type { ResultadoAdjuntos } from "../../../nucleo/archivos/EstrategiaAdjuntos";
import type { GestorPestanas } from "../../../plataforma/webbridge/GestorPestanas";

export class QwenPaginaChat {
  private readonly navegacion: QwenNavegacion;
  private readonly modelos: QwenModelos;
  private readonly envio: QwenEnvio;
  private readonly streaming: QwenStreaming;

  constructor(transporte: TransporteNavegador, gestorPestanas?: GestorPestanas) {
    this.navegacion = new QwenNavegacion(transporte, undefined, gestorPestanas);
    this.modelos = new QwenModelos(transporte);
    this.envio = new QwenEnvio(transporte);
    this.streaming = new QwenStreaming(transporte);
  }

  verificarDisponibilidad(): Promise<void> { return this.navegacion.verificarDisponibilidad(); }
  abrirConversacion(id?: string, nuevaPestana = false): Promise<void> { return this.navegacion.abrirConversacion(id, nuevaPestana); }
  listarModelos(): Promise<ModeloChat[]> { return this.modelos.listar(); }
  seleccionarModelo(modelo: string): Promise<ModeloChat> { return this.modelos.seleccionar(modelo); }
  adjuntar(rutas: string[] = []): Promise<ResultadoAdjuntos> { return this.envio.adjuntar(rutas); }
  enviarPrompt(prompt: string): Promise<void> { return this.envio.enviar(prompt); }
  observarStreaming(): AsyncGenerator<EventoStreaming> { return this.streaming.observar(); }
  async obtenerConversacionActual(): Promise<string | null> { return this.navegacion.obtenerConversacionActual(); }
}
