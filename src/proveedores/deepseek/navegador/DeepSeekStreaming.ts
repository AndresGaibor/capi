import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import { ErrorPaginaProveedor, ErrorTimeoutProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptEstadoStreamingDeepSeek } from "../scripts/estadoStreaming";
import type { EstadoStreamingDeepSeek } from "../tipos";
import { convertirRegistroHistoria } from "../servicios/ConvertirRegistroHistoria";
const dormir=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export class DeepSeekStreaming {
  constructor(private readonly transporte: TransporteNavegador, private readonly pausa: (ms:number)=>Promise<unknown> = dormir) {}
  private async respuestaIndexedDB(id: string): Promise<string> {
    if(!id)return "";
    const registro=(await this.transporte.evaluar<any>(`new Promise(resolve=>{const q=indexedDB.open('deepseek-chat');q.onerror=()=>resolve(null);q.onsuccess=()=>{const d=q.result;if(!d.objectStoreNames.contains('history-message'))return resolve(null);const g=d.transaction('history-message','readonly').objectStore('history-message').get(${JSON.stringify("__ID__")});g.onerror=()=>resolve(null);g.onsuccess=()=>resolve(g.result??null)}})`.replace("__ID__",id))).value;
    const c=convertirRegistroHistoria(registro);
    const ultimo=c?.mensajes.filter(m=>m.rol==='asistente').at(-1);
    return ultimo?.fragmentos.find(f=>f.type==='RESPONSE')?.content ?? "";
  }

  private async respuestaApi(id: string): Promise<{ contenido: string; terminado: boolean }> {
    if (!id) return { contenido: "", terminado: false };
    const resultado = await this.transporte.evaluar<{contenido:string;terminado:boolean}>(`(async()=>{
      try {
        const token = JSON.parse(localStorage.getItem('userToken') || '{}').value || '';
        if (!token) return { contenido:'', terminado:false };
        const respuesta = await fetch('/api/v0/chat/history_messages?chat_session_id=' + encodeURIComponent(${JSON.stringify("__ID__")}), {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!respuesta.ok) return { contenido:'', terminado:false };
        const cuerpo = await respuesta.json();
        const mensajes = cuerpo?.data?.biz_data?.chat_messages || [];
        const ultimo = [...mensajes].reverse().find(m => String(m?.role || '').toUpperCase() === 'ASSISTANT');
        return {
          contenido: String(ultimo?.content || ''),
          terminado: String(ultimo?.status || '').toUpperCase() === 'FINISHED'
        };
      } catch { return { contenido:'', terminado:false }; }
    })()`.replace("__ID__", id));
    const valor = resultado?.value;
    if (!valor || typeof valor.contenido !== "string" || typeof valor.terminado !== "boolean") {
      return { contenido: "", terminado: false };
    }
    return valor;
  }
  async *observar(): AsyncGenerator<EventoStreaming> {
    const idInicial=(await this.transporte.evaluar<string>("location.pathname.split('/a/chat/s/')[1]?.split('?')[0]?.split('#')[0] || ''" )).value ?? '';
    let lt='',lr='',sin=0,reintentos=0,confirmacionesFin=0;
    for(let i=0;i<18000;i++){
      await this.pausa(100);
      const ev=(await this.transporte.evaluar<EstadoStreamingDeepSeek>(scriptEstadoStreamingDeepSeek())).value;
      if(!ev){if(++sin>100)throw new ErrorTimeoutProveedor('No se encontró el área de respuesta de DeepSeek');continue;}
      if(ev.isError){if(reintentos++<3){await this.transporte.evaluar("document.querySelector('.ds-button--warning')?.click()");await this.pausa(1500);continue;}throw new ErrorPaginaProveedor(ev.errorMessage);}
      if(ev.think.startsWith(lt)&&ev.think.length>lt.length){yield{tipo:'pensamiento',contenido:ev.think.slice(lt.length)};lt=ev.think;}
      if(ev.response.length>lr.length){
        yield{tipo:'respuesta',contenido:ev.response.slice(lr.length)};lr=ev.response;sin=0;
      } else if(lr)sin++;
      if(i>10 && i%5===0){
        const api=await this.respuestaApi(idInicial);
        if(api.contenido.length>lr.length){yield{tipo:'respuesta',contenido:api.contenido.slice(lr.length)};lr=api.contenido;sin=0;}
        if(api.terminado&&api.contenido) confirmacionesFin++;
      }
      if(!lr && i>20 && i%10===0){const respaldo=await this.respuestaIndexedDB(idInicial);if(respaldo){yield{tipo:'respuesta',contenido:respaldo};yield{tipo:'fin'};return;}}
      if(ev.done) confirmacionesFin++;
      if(lr && (confirmacionesFin >= 20 || sin > 100)){yield{tipo:'fin'};return;}
    }
    throw new ErrorTimeoutProveedor('El streaming de DeepSeek excedió el tiempo máximo');
  }
}
