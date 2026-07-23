import { IniciarSesionDeepSeek } from "../../dominio/deepseek/casos-de-uso/IniciarSesionDeepSeek";
import { ListarConversaciones } from "../../dominio/deepseek/casos-de-uso/ListarConversaciones";
import { ObtenerMensajes } from "../../dominio/deepseek/casos-de-uso/ObtenerMensajes";
import { EnviarMensaje } from "../../dominio/deepseek/casos-de-uso/EnviarMensaje";
import { EnviarMensajeStreaming } from "../../dominio/deepseek/casos-de-uso/EnviarMensajeStreaming";

import type { PuertoInterfazWebBridge } from "../../dominio/deepseek/puertos/PuertoInterfazWebBridge";
import type { PuertoRepositorioIndexedDB } from "../../dominio/deepseek/puertos/PuertoRepositorioIndexedDB";
import type { PuertoRepositorioSesion } from "../../dominio/deepseek/puertos/PuertoRepositorioSesion";
import type { PuertoApiDeepSeek } from "../../dominio/deepseek/puertos/PuertoApiDeepSeek";
import type { PuertoSalidaCLI } from "../../dominio/deepseek/puertos/PuertoSalidaCLI";

import type { SesionDeepSeek } from "../../dominio/deepseek/entidades/SesionDeepSeek";
import type { Conversacion } from "../../dominio/deepseek/entidades/Conversacion";
import type { ResultadoEnvio } from "../../dominio/deepseek/casos-de-uso/EnviarMensaje";
import type { EventoStream, OpcionesChat } from "../../dominio/deepseek/casos-de-uso/EnviarMensajeStreaming";

export class ServicioChatDeepSeek {
  readonly iniciarSesion: IniciarSesionDeepSeek;
  readonly listarConversaciones: ListarConversaciones;
  readonly obtenerMensajes: ObtenerMensajes;
  readonly enviarMensaje: EnviarMensaje;
  readonly enviarMensajeStreaming: EnviarMensajeStreaming;

  constructor(
    private readonly webbridge: PuertoInterfazWebBridge,
    indexeddb: PuertoRepositorioIndexedDB,
    sesion: PuertoRepositorioSesion,
    api: PuertoApiDeepSeek,
    salida: PuertoSalidaCLI
  ) {
    this.iniciarSesion = new IniciarSesionDeepSeek(webbridge, sesion, salida);
    this.listarConversaciones = new ListarConversaciones(api, sesion, salida);
    this.obtenerMensajes = new ObtenerMensajes(webbridge, indexeddb, salida);
    this.enviarMensaje = new EnviarMensaje(webbridge, indexeddb, salida);
    this.enviarMensajeStreaming = new EnviarMensajeStreaming(webbridge, salida);
  }

  async iniciarSesionYListar(): Promise<Conversacion[]> {
    const sesion = await this.iniciarSesion.ejecutar();
    if (!sesion) return [];
    return this.listarConversaciones.ejecutar();
  }

  async listarConversacionesSolo(): Promise<Conversacion[]> {
    return this.listarConversaciones.ejecutar();
  }

  async obtenerMensajesChat(idConversacion: string): Promise<Conversacion | null> {
    return this.obtenerMensajes.ejecutar(idConversacion);
  }

  async enviarPrompt(
    idConversacion: string,
    prompt: string,
    tiempoEsperaMs = 15_000
  ): Promise<ResultadoEnvio> {
    return this.enviarMensaje.ejecutar(idConversacion, prompt, tiempoEsperaMs);
  }

  async *enviarPromptStreaming(
    idConversacion: string,
    prompt: string,
    opciones?: OpcionesChat
  ): AsyncGenerator<EventoStream> {
    yield* this.enviarMensajeStreaming.ejecutar(idConversacion, prompt, opciones);
  }

  async obtenerModeloChatActual(): Promise<string | null> {
    return this.webbridge.obtenerModeloChatActual();
  }
}
