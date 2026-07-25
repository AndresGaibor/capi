export interface MensajeCorrelacionableDeepSeek {
  rol: "usuario" | "asistente";
  contenido: string;
  terminado?: boolean;
}

export interface RespuestaCorrelacionadaDeepSeek {
  contenido: string;
  terminado: boolean;
}

export function respuestaPosteriorAlUltimoUsuario(
  mensajes: MensajeCorrelacionableDeepSeek[],
): RespuestaCorrelacionadaDeepSeek {
  let ultimoUsuario = -1;
  for (let indice = 0; indice < mensajes.length; indice++) {
    if (mensajes[indice]?.rol === "usuario") ultimoUsuario = indice;
  }
  if (ultimoUsuario < 0) return { contenido: "", terminado: false };
  const respuesta = mensajes
    .slice(ultimoUsuario + 1)
    .find((mensaje) => mensaje.rol === "asistente" && mensaje.contenido.trim());
  return respuesta
    ? { contenido: respuesta.contenido.trim(), terminado: Boolean(respuesta.terminado) }
    : { contenido: "", terminado: false };
}
