import type { EventoStreaming } from "../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../nucleo/chat/PeticionChat";
import type { CapacidadesProveedor } from "../../nucleo/proveedores/CapacidadesProveedor";
import type { ModeloChat, ProveedorChat, ConversacionResumen } from "../../nucleo/proveedores/ProveedorChat";
import { QwenPaginaChat } from "./navegador/QwenPaginaChat";

export class ProveedorQwen implements ProveedorChat {
  readonly id = "qwen";
  readonly capacidades: CapacidadesProveedor = { cambioModelo: true, listarModelos: true, conversaciones: true, mensajes: false, sesion: false, archivos: true, razonamiento: true, busquedaWeb: false };
  constructor(private readonly pagina: QwenPaginaChat) {}
  verificarDisponibilidad(): Promise<void> { return this.pagina.verificarDisponibilidad(); }
  async listarModelos(): Promise<ModeloChat[]> {
    await this.verificarDisponibilidad();
    await this.pagina.abrirConversacion();
    return this.pagina.listarModelos();
  }
  seleccionarModelo(modelo: string): Promise<ModeloChat> { return this.pagina.seleccionarModelo(modelo); }
  async listarConversaciones(): Promise<ConversacionResumen[]> {
    await this.verificarDisponibilidad();
    const conversaciones = await this.pagina.listarConversaciones();
    return conversaciones.map(c => ({ id: c.id, titulo: c.titulo }));
  }
  async *enviarMensaje(peticion: PeticionChat): AsyncGenerator<EventoStreaming> {
    yield { tipo: "inicio", mensaje: "Verificando Qwen..." };
    await this.verificarDisponibilidad();
    yield { tipo: "inicio", mensaje: peticion.conversacionId ? "Abriendo conversación..." : "Creando chat nuevo..." };
    await this.pagina.abrirConversacion(peticion.conversacionId, peticion.nuevaPestana);
    if (peticion.modelo) {
      yield { tipo: "inicio", mensaje: `Seleccionando modelo ${peticion.modelo}...` };
      const modelo = await this.seleccionarModelo(peticion.modelo);
      yield { tipo: "modelo", nombre: modelo.nombre };
    }
    if (!peticion.soloPoll) {
      if (peticion.opciones?.razonamiento !== undefined) {
        yield { tipo: "inicio", mensaje: `Configurando modo ${peticion.opciones.razonamiento ? "Thinking" : "Fast"}...` };
        await this.pagina.configurarRazonamiento(peticion.opciones.razonamiento);
      }
      if (peticion.archivos?.length) {
        yield { tipo: "inicio", mensaje: `Adjuntando ${peticion.archivos.length} archivo(s)...` };
        await this.pagina.adjuntar(peticion.archivos);
      }
      yield { tipo: "inicio", mensaje: "Enviando prompt..." };
      await this.pagina.enviarPrompt(peticion.prompt);
    } else {
      yield { tipo: "inicio", mensaje: "Continuando polling..." };
    }
    const conversacionActual = await this.pagina.obtenerConversacionActual?.(peticion.conversacionId ? 1 : 40);
    if (conversacionActual && conversacionActual !== peticion.conversacionId) {
      yield { tipo: "conversacion", id: conversacionActual };
    }
    yield { tipo: "inicio", mensaje: "Recibiendo respuesta..." };
    yield* this.pagina.observarStreaming(conversacionActual ?? peticion.conversacionId);
  }
  obtenerConversacionActual(): Promise<string | null> { return this.pagina.obtenerConversacionActual(); }
  diagnosticarPagina(): Promise<Record<string, unknown>> { return this.pagina.diagnosticar(); }
}
