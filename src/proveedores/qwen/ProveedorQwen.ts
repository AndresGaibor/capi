import type { EventoStreaming } from "../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../nucleo/chat/PeticionChat";
import type { CapacidadesProveedor } from "../../nucleo/proveedores/CapacidadesProveedor";
import type { ModeloChat, ProveedorChat } from "../../nucleo/proveedores/ProveedorChat";
import { QwenPaginaChat } from "./navegador/QwenPaginaChat";

export class ProveedorQwen implements ProveedorChat {
  readonly id = "qwen";
  readonly capacidades: CapacidadesProveedor = { cambioModelo: true, listarModelos: true, conversaciones: false, mensajes: false, sesion: false, archivos: false, razonamiento: true, busquedaWeb: false };
  constructor(private readonly pagina: QwenPaginaChat) {}
  verificarDisponibilidad(): Promise<void> { return this.pagina.verificarDisponibilidad(); }
  async listarModelos(): Promise<ModeloChat[]> {
    await this.verificarDisponibilidad();
    await this.pagina.abrirConversacion();
    return this.pagina.listarModelos();
  }
  seleccionarModelo(modelo: string): Promise<ModeloChat> { return this.pagina.seleccionarModelo(modelo); }
  async *enviarMensaje(peticion: PeticionChat): AsyncGenerator<EventoStreaming> {
    yield { tipo: "inicio", mensaje: "Verificando Qwen..." };
    await this.verificarDisponibilidad();
    yield { tipo: "inicio", mensaje: peticion.conversacionId ? "Abriendo conversación..." : "Creando chat nuevo..." };
    await this.pagina.abrirConversacion(peticion.conversacionId);
    if (peticion.modelo) {
      yield { tipo: "inicio", mensaje: `Seleccionando modelo ${peticion.modelo}...` };
      const modelo = await this.seleccionarModelo(peticion.modelo);
      yield { tipo: "modelo", nombre: modelo.nombre };
    }
    yield { tipo: "inicio", mensaje: "Enviando prompt..." };
    await this.pagina.enviarPrompt(peticion.prompt);
    yield { tipo: "inicio", mensaje: "Recibiendo respuesta..." };
    yield* this.pagina.observarStreaming();
  }
}
