export interface SesionDeepSeek { thumbcache: string; awsWafToken: string; dsSessionId: string; userToken: string; authorization: string; expiresAt: number; }
export interface ConversacionDeepSeek { id: string; titulo: string; fijada: boolean; tipoModelo: string; actualizadaEn: number; mensajes: MensajeDeepSeek[]; }
export interface MensajeDeepSeek { id: string; rol: "usuario" | "asistente"; fragmentos: Array<{ type: "REQUEST" | "RESPONSE" | "THINK"; content: string }>; }
export interface OpcionesDeepSeek { modelo?: "default" | "expert" | "vision"; deepThink?: boolean; search?: boolean; archivos?: string[]; }
export interface EstadoStreamingDeepSeek { think: string; response: string; done: boolean; isAssistant: boolean; isError: boolean; errorMessage: string; }
