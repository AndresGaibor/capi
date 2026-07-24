import type { ConversacionChat, MensajeChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { convertirRegistroHistoria } from "./ConvertirRegistroHistoria";

export class DeepSeekLectorHistorial {
  constructor(private readonly transporte: TransporteNavegador) {}

  async obtener(id: string): Promise<ConversacionChat | null> {
    await this.transporte.navegar(`https://chat.deepseek.com/a/chat/s/${id}`, true, "CAPI Messages");
    const registro = (await this.transporte.evaluar<any>(`new Promise(resolve=>{const q=indexedDB.open('deepseek-chat');q.onerror=()=>resolve(null);q.onsuccess=()=>{const d=q.result;if(!d.objectStoreNames.contains('history-message'))return resolve(null);const g=d.transaction('history-message','readonly').objectStore('history-message').get(${JSON.stringify(id)});g.onerror=()=>resolve(null);g.onsuccess=()=>resolve(g.result??null)}})`)).value;
    const conversacion = convertirRegistroHistoria(registro);
    if (!conversacion) return null;
    const mensajes: MensajeChat[] = conversacion.mensajes.map((m) => ({
      rol: m.rol,
      contenido: m.fragmentos.find((f) => f.type === "REQUEST" || f.type === "RESPONSE")?.content ?? "",
      pensamiento: m.fragmentos.find((f) => f.type === "THINK")?.content,
    }));
    return { id: conversacion.id, titulo: conversacion.titulo, mensajes };
  }
}
