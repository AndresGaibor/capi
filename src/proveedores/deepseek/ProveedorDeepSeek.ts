import type { EventoStreaming } from "../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../nucleo/chat/PeticionChat";
import { ErrorPaginaProveedor, ErrorProveedorNoDisponible } from "../../nucleo/errores/ErroresAplicacion";
import type { CapacidadesProveedor } from "../../nucleo/proveedores/CapacidadesProveedor";
import type { ConversacionChat, ConversacionResumen, MensajeChat, ModeloChat, ProveedorChat } from "../../nucleo/proveedores/ProveedorChat";
import { obtenerServicioChatDeepSeek } from "../../di/deepseek";

export class ProveedorDeepSeek implements ProveedorChat {
  readonly id = "deepseek";
  readonly capacidades: CapacidadesProveedor = { cambioModelo: true, listarModelos: true, conversaciones: true, mensajes: true, sesion: true, archivos: true, razonamiento: true, busquedaWeb: true };
  private readonly servicio = obtenerServicioChatDeepSeek();

  async verificarDisponibilidad(): Promise<void> {
    const disponible = await fetch("http://127.0.0.1:10086", { method: "HEAD", signal: AbortSignal.timeout(3000) }).then(() => true).catch(() => false);
    if (!disponible) throw new ErrorProveedorNoDisponible(this.id);
  }

  async listarModelos(): Promise<ModeloChat[]> {
    return [
      { id: "default", nombre: "default" },
      { id: "expert", nombre: "expert" },
      { id: "vision", nombre: "vision" },
    ];
  }

  async seleccionarModelo(modelo: string): Promise<ModeloChat> { return { id: modelo, nombre: modelo }; }

  async *enviarMensaje(peticion: PeticionChat): AsyncGenerator<EventoStreaming> {
    await this.verificarDisponibilidad();
    const opciones = {
      modelo: peticion.modelo as "default" | "expert" | "vision" | undefined,
      deepThink: peticion.opciones?.razonamiento,
      search: peticion.opciones?.busquedaWeb,
      archivos: peticion.archivos,
    };
    const id = peticion.conversacionId ?? "new";
    for await (const evento of this.servicio.enviarPromptStreaming(id, peticion.prompt, opciones)) {
      if (evento.type === "start_response") yield { tipo: "inicio", mensaje: evento.content };
      else if (evento.type === "think" && evento.content) yield { tipo: "pensamiento", contenido: evento.content };
      else if (evento.type === "response" && evento.content) yield { tipo: "respuesta", contenido: evento.content };
      else if (evento.type === "done") yield { tipo: "fin" };
      else if (evento.type === "error") throw new ErrorPaginaProveedor(evento.content ?? "Error de DeepSeek");
    }
  }

  async listarConversaciones(): Promise<ConversacionResumen[]> {
    await this.verificarDisponibilidad();
    const conversaciones = await this.servicio.iniciarSesionYListar();
    return conversaciones.map((c) => ({ id: c.id, titulo: c.titulo, actualizadaEn: c.actualizadaEn, modelo: c.tipoModelo }));
  }

  async obtenerMensajes(id: string): Promise<ConversacionChat | null> {
    await this.verificarDisponibilidad();
    const conversacion = await this.servicio.obtenerMensajesChat(id);
    if (!conversacion) return null;
    const mensajes: MensajeChat[] = conversacion.mensajes.map((m) => ({
      rol: m.rol,
      contenido: m.fragmentos.find((f) => f.type === "REQUEST" || f.type === "RESPONSE")?.content ?? "",
      pensamiento: m.fragmentos.find((f) => f.type === "THINK")?.content,
    }));
    return { id, titulo: conversacion.titulo, mensajes };
  }

  async importarSesion(): Promise<void> {
    await this.verificarDisponibilidad();
    const sesion = await this.servicio.iniciarSesion.ejecutar();
    if (!sesion) throw new ErrorPaginaProveedor("No se pudo importar la sesión de DeepSeek");
  }

  async diagnosticarPagina(): Promise<Record<string, unknown>> {
    await this.verificarDisponibilidad();
    return { proveedor: this.id, modelo: await this.servicio.obtenerModeloChatActual() };
  }
}
