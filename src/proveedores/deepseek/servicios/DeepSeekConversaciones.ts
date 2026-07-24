import type { ConversacionResumen, ConversacionChat, MensajeChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { convertirRegistroHistoria } from "./ConvertirRegistroHistoria";
import { DeepSeekSesion } from "./DeepSeekSesion";
export class DeepSeekConversaciones {
  constructor(private readonly transporte: TransporteNavegador, private readonly sesion: DeepSeekSesion) {}
  async listar(): Promise<ConversacionResumen[]> {
    const s=await this.sesion.obtener();
    const resultado=await this.transporte.evaluar<any>(`fetch('/api/v0/chat_session/fetch_page?lte_cursor.pinned=false',{headers:{Authorization:${JSON.stringify(s.authorization)}}}).then(r=>r.json())`);
    const items=resultado.value?.data?.biz_data?.chat_sessions ?? [];
    return items.map((x:any)=>({id:String(x.id),titulo:String(x.title??'Sin título'),actualizadaEn:Number(x.updated_at??0)*1000,modelo:String(x.model_type??'')}));
  }
  async mensajes(id:string):Promise<ConversacionChat|null>{
    await this.transporte.navegar(`https://chat.deepseek.com/a/chat/s/${id}`,false,'CAPI Messages');
    const registro=(await this.transporte.evaluar<any>(`new Promise(resolve=>{const q=indexedDB.open('deepseek-chat');q.onerror=()=>resolve(null);q.onsuccess=()=>{const d=q.result;if(!d.objectStoreNames.contains('history-message'))return resolve(null);const g=d.transaction('history-message','readonly').objectStore('history-message').get(${JSON.stringify(id)});g.onerror=()=>resolve(null);g.onsuccess=()=>resolve(g.result??null)}})`)).value;
    const c=convertirRegistroHistoria(registro); if(!c)return null;
    const mensajes:MensajeChat[]=c.mensajes.map(m=>({rol:m.rol,contenido:m.fragmentos.find(f=>f.type==='REQUEST'||f.type==='RESPONSE')?.content??'',pensamiento:m.fragmentos.find(f=>f.type==='THINK')?.content}));
    return {id:c.id,titulo:c.titulo,mensajes};
  }
}
