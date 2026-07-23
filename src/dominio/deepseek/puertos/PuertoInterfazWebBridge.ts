import type { OpcionesChat } from "../casos-de-uso/EnviarMensajeStreaming";
import type { MensajeExtraido } from "../casos-de-uso/ObtenerMensajes";

export interface ResultadoEvaluacion {
  type: string;
  value: unknown;
}

export interface ConteoRespuestaDOM {
  thinkCount: number;
  respCount: number;
  markdownCount: number;
  isGenerating: boolean;
}

export interface EstadoStreamingDOM {
  think: string;
  response: string;
  done: boolean;
  isAssistant: boolean;
  isError: boolean;
  errorMessage: string;
}

export interface PuertoInterfazWebBridge {
  estaDisponible(): Promise<boolean>;
  navegar(url: string, nuevaPestana: boolean, tituloGrupo?: string): Promise<{ success: boolean }>;
  evaluar<T = unknown>(codigo: string): Promise<ResultadoEvaluacion & { value: T }>;
  cdp<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  cerrarSesion(): Promise<void>;
  inyectarScript(script: string): Promise<void>;
  obtenerModeloChatActual(): Promise<string | null>;
  configurarInterfazDOM(opciones: OpcionesChat, esChatNuevo: boolean): Promise<{ warningModelo: boolean }>;
  enviarPromptDOM(prompt: string): Promise<{ ok: boolean }>;
  obtenerConteoRespuestaDOM(): Promise<ConteoRespuestaDOM>;
  obtenerEstadoStreamingDOM(): Promise<EstadoStreamingDOM | null>;
  extraerMensajesDOM(): Promise<MensajeExtraido[]>;
  adjuntarArchivoDOM(rutaArchivo: string): Promise<{ ok: boolean }>;
}
