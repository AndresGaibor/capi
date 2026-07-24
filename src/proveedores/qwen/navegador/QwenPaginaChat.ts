import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { ModeloChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { QwenEnvio } from "./QwenEnvio";
import { QwenModelos } from "./QwenModelos";
import { QwenNavegacion } from "./QwenNavegacion";
import { QwenStreaming } from "./QwenStreaming";

export class QwenPaginaChat {
  private readonly navegacion: QwenNavegacion;
  private readonly modelos: QwenModelos;
  private readonly envio: QwenEnvio;
  private readonly streaming: QwenStreaming;

  constructor(transporte: TransporteNavegador) {
    this.navegacion = new QwenNavegacion(transporte);
    this.modelos = new QwenModelos(transporte);
    this.envio = new QwenEnvio(transporte);
    this.streaming = new QwenStreaming(transporte);
  }

  verificarDisponibilidad(): Promise<void> { return this.navegacion.verificarDisponibilidad(); }
  abrirConversacion(id?: string): Promise<void> { return this.navegacion.abrirConversacion(id); }
  listarModelos(): Promise<ModeloChat[]> { return this.modelos.listar(); }
  seleccionarModelo(modelo: string): Promise<ModeloChat> { return this.modelos.seleccionar(modelo); }
  enviarPrompt(prompt: string): Promise<void> { return this.envio.enviar(prompt); }
  observarStreaming(): AsyncGenerator<EventoStreaming> { return this.streaming.observar(); }
}
