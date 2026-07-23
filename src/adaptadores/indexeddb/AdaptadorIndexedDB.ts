import type { PuertoRepositorioIndexedDB } from "../../dominio/deepseek/puertos/PuertoRepositorioIndexedDB";
import type { PuertoInterfazWebBridge } from "../../dominio/deepseek/puertos/PuertoInterfazWebBridge";
import type { Conversacion } from "../../dominio/deepseek/entidades/Conversacion";
import { convertirRegistroHistoria } from "../../dominio/deepseek/servicios/ConvertirRegistroHistoria";

export class AdaptadorIndexedDB implements PuertoRepositorioIndexedDB {
  constructor(private readonly webbridge: PuertoInterfazWebBridge) {}

  async obtenerConversacion(idConversacion: string): Promise<Conversacion | null> {
    const chatId = JSON.stringify(idConversacion);
    const resultado = await this.webbridge.evaluar<unknown>(`
      new Promise((resolve) => {
        const req = indexedDB.open('deepseek-chat');
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('history-message')) { db.close(); resolve(null); return; }
          const tx = db.transaction('history-message', 'readonly');
          const store = tx.objectStore('history-message');
          const getReq = store.get(${chatId});
          getReq.onerror = () => { db.close(); resolve(null); };
          getReq.onsuccess = () => {
            const rec = getReq.result;
            db.close();
            resolve(rec ?? null);
          };
        };
      })
    `);

    if (!resultado.value) return null;
    return convertirRegistroHistoria(resultado.value);
  }
}
