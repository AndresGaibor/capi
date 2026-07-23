import type { Conversacion } from "../entidades/Conversacion";
import type { Mensaje, Fragmento } from "../entidades/Mensaje";

interface RegistroHistoria {
  data: {
    chat_session: {
      id: string;
      title: string;
      title_type: string;
      model_type: string;
      pinned: boolean;
      updated_at: number;
    };
    chat_messages: Array<{
      role: string;
      fragments?: Fragmento[];
      message_id?: number;
      parent_id?: number;
    }>;
  };
}

export function convertirRegistroHistoria(
  registro: unknown
): Conversacion | null {
  const reg = registro as RegistroHistoria | undefined;
  if (!reg?.data?.chat_session || !reg?.data?.chat_messages) return null;

  const sesion = reg.data.chat_session;
  const mensajesRaw = reg.data.chat_messages;

  const mensajes: Mensaje[] = mensajesRaw.map((m, i) => ({
    id: String(m.message_id ?? i),
    rol: m.role === "user" ? "usuario" : "asistente",
    fragmentos: m.fragments ?? [],
  }));

  return {
    id: sesion.id,
    titulo: sesion.title || "Sin título",
    fijada: sesion.pinned ?? false,
    tipoModelo: sesion.model_type ?? "",
    actualizadaEn: (sesion.updated_at ?? 0) * 1000,
    mensajes,
  };
}
