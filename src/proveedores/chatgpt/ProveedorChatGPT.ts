import type { EventoStreaming } from "../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../nucleo/chat/PeticionChat";
import type { CapacidadesProveedor } from "../../nucleo/proveedores/CapacidadesProveedor";
import type { ConversacionResumen, ModeloChat, ProveedorChat } from "../../nucleo/proveedores/ProveedorChat";
import { ChatGPTPaginaChat } from "./navegador/ChatGPTPaginaChat";

export class ProveedorChatGPT implements ProveedorChat {
  readonly id = "chatgpt";
  readonly capacidades: CapacidadesProveedor = { cambioModelo: false, listarModelos: true, conversaciones: true, mensajes: false, sesion: false, archivos: true, razonamiento: false, busquedaWeb: false };

  constructor(private readonly pagina: ChatGPTPaginaChat) {}

  verificarDisponibilidad(): Promise<void> { return this.pagina.verificarDisponibilidad(); }
  listarModelos(): Promise<ModeloChat[]> { return Promise.resolve(this.pagina.listarModelos()); }
  seleccionarModelo(modelo: string): Promise<ModeloChat> { return this.pagina.seleccionarModelo(modelo); }
  listarConversaciones(): Promise<ConversacionResumen[]> { return this.pagina.listarConversaciones(); }
  obtenerConversacionActual(): Promise<string | null> { return this.pagina.obtenerConversacionActual(); }
  async diagnosticarPagina(): Promise<Record<string, unknown>> { await this.verificarDisponibilidad(); return this.pagina.diagnosticar(); }

  async *enviarMensaje(peticion: PeticionChat): AsyncGenerator<EventoStreaming> {
    await this.verificarDisponibilidad();
    yield { tipo: "inicio", mensaje: peticion.conversacionId ? "Reutilizando conversación de ChatGPT..." : "Usando ChatGPT activo..." };
    await this.pagina.abrirConversacion(peticion.conversacionId, peticion.nuevaPestana);
    const adjuntos = [...(peticion.archivos ?? []), ...(peticion.imagenes ?? [])];
    if (adjuntos.length) {
      yield { tipo: "inicio", mensaje: `Adjuntando ${adjuntos.length} archivo(s) a ChatGPT...` };
      await this.pagina.adjuntar(adjuntos);
    }
    if (peticion.soloPoll) {
      yield { tipo: "inicio", mensaje: "Continuando polling de ChatGPT..." };
    } else {
      yield { tipo: "inicio", mensaje: "Enviando prompt a ChatGPT..." };
      await this.pagina.enviar(peticion.prompt);
    }
    const conversacionActual = await this.pagina.obtenerConversacionActual(peticion.conversacionId ? 1 : 40);
    if (conversacionActual && conversacionActual !== peticion.conversacionId) {
      yield { tipo: "conversacion", id: conversacionActual };
    }
    yield { tipo: "inicio", mensaje: "Recibiendo respuesta de ChatGPT..." };
    yield* this.pagina.observar(conversacionActual ?? peticion.conversacionId);
  }
}
