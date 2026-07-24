import type { EventoStreaming } from "../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../nucleo/chat/PeticionChat";
import type { CapacidadesProveedor } from "../../nucleo/proveedores/CapacidadesProveedor";
import type { ConversacionChat, ConversacionResumen, ModeloChat, ProveedorChat } from "../../nucleo/proveedores/ProveedorChat";
import { resolverModeloDeepSeek } from "./modelos/ResolverModeloDeepSeek";
import { DeepSeekPaginaChat } from "./navegador/DeepSeekPaginaChat";
import { DeepSeekConversaciones } from "./servicios/DeepSeekConversaciones";
import { DeepSeekSesion } from "./servicios/DeepSeekSesion";

export class ProveedorDeepSeek implements ProveedorChat {
  readonly id = "deepseek";
  readonly capacidades: CapacidadesProveedor = { cambioModelo: true, listarModelos: true, conversaciones: true, mensajes: true, sesion: true, archivos: true, razonamiento: true, busquedaWeb: true };
  constructor(private readonly pagina: DeepSeekPaginaChat, private readonly conversaciones: DeepSeekConversaciones, private readonly sesion: DeepSeekSesion) {}
  verificarDisponibilidad(): Promise<void> { return this.pagina.verificar(); }
  async listarModelos(): Promise<ModeloChat[]> { return this.pagina.listarModelos(); }
  seleccionarModelo(modelo: string): Promise<ModeloChat> { resolverModeloDeepSeek(modelo); return this.pagina.seleccionarModelo(modelo); }
  async *enviarMensaje(peticion: PeticionChat): AsyncGenerator<EventoStreaming> {
    await this.verificarDisponibilidad();
    const esNuevo = !peticion.conversacionId;
    yield { tipo: "inicio", mensaje: esNuevo ? "Creando chat nuevo..." : "Abriendo conversación..." };
    await this.pagina.abrir(peticion.conversacionId, peticion.nuevaPestana);
    const modelo = resolverModeloDeepSeek(peticion.modelo);
    await this.pagina.preparar({ modelo, deepThink: peticion.opciones?.razonamiento, search: peticion.opciones?.busquedaWeb, archivos: peticion.archivos }, esNuevo);
    if (modelo) yield { tipo: "modelo", nombre: modelo };
    yield { tipo: "inicio", mensaje: "Enviando prompt..." };
    await this.pagina.enviar(peticion.prompt);
    yield { tipo: "inicio", mensaje: "Recibiendo respuesta..." };
    yield* this.pagina.observar();
  }
  listarConversaciones(): Promise<ConversacionResumen[]> { return this.conversaciones.listar(); }
  obtenerMensajes(id: string): Promise<ConversacionChat | null> { return this.conversaciones.mensajes(id); }
  async importarSesion(): Promise<void> { await this.sesion.importar(); }
  async diagnosticarPagina(): Promise<Record<string, unknown>> { await this.verificarDisponibilidad(); return { proveedor: this.id, modelo: await this.pagina.modeloActual(), conversacionId: await this.pagina.obtenerConversacionActual() }; }
  obtenerConversacionActual(): Promise<string | null> { return this.pagina.obtenerConversacionActual(); }
}
