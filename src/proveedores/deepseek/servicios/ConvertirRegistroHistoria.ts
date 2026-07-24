import type { ConversacionDeepSeek, MensajeDeepSeek } from "../tipos";
export function convertirRegistroHistoria(registro: unknown): ConversacionDeepSeek | null {
  if (!registro || typeof registro !== "object") return null;
  const raiz = registro as Record<string, unknown>;
  const data = (raiz.data && typeof raiz.data === "object" ? raiz.data : raiz) as Record<string, unknown>;
  const sesion = (data.chat_session && typeof data.chat_session === "object" ? data.chat_session : data) as Record<string, unknown>;
  const id = String(sesion.id ?? sesion.chat_session_id ?? "");
  if (!id) return null;
  const crudos = Array.isArray(data.chat_messages) ? data.chat_messages : Array.isArray(data.messages) ? data.messages : [];
  const mensajes: MensajeDeepSeek[] = crudos.map((m, i) => {
    const item = (m ?? {}) as Record<string, unknown>;
    const rol = item.role === "user" || item.rol === "usuario" ? "usuario" : "asistente";
    const fragmentos = Array.isArray(item.fragments)
      ? item.fragments.map((f) => {
          const frag = (f ?? {}) as Record<string, unknown>;
          const type = String(frag.type ?? (rol === "usuario" ? "REQUEST" : "RESPONSE")) as "REQUEST" | "RESPONSE" | "THINK";
          return { type, content: String(frag.content ?? "") };
        })
      : [{ type: (rol === "usuario" ? "REQUEST" : "RESPONSE") as "REQUEST" | "RESPONSE", content: String(item.content ?? item.mensaje ?? "") }];
    return { id: String(item.message_id ?? item.id ?? `${id}-${i}`), rol, fragmentos };
  });
  const actualizado = Number(sesion.updated_at ?? sesion.actualizadaEn ?? Date.now());
  return { id, titulo: String(sesion.title ?? sesion.titulo ?? "Conversación"), fijada: Boolean(sesion.pinned ?? sesion.fijada), tipoModelo: String(sesion.model_type ?? sesion.tipoModelo ?? ""), actualizadaEn: actualizado < 10_000_000_000 ? actualizado * 1000 : actualizado, mensajes };
}
