import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import { ErrorPaginaProveedor, ErrorTimeoutProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptEstadoStreamingDeepSeek } from "../scripts/estadoStreaming";
import type { EstadoStreamingDeepSeek } from "../tipos";
import { convertirRegistroHistoria } from "../servicios/ConvertirRegistroHistoria";
const dormir=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export class DeepSeekStreaming {
  constructor(private readonly transporte: TransporteNavegador, private readonly pausa: (ms:number)=>Promise<unknown> = dormir) {}
  private async respuestaIndexedDB(): Promise<string> {
    const id=(await this.transporte.evaluar<string>("location.pathname.split('/').pop() || '' ")).value ?? "";
    if(!id)return "";
    const registro=(await this.transporte.evaluar<any>(`new Promise(resolve=>{const q=indexedDB.open('deepseek-chat');q.onerror=()=>resolve(null);q.onsuccess=()=>{const d=q.result;if(!d.objectStoreNames.contains('history-message'))return resolve(null);const g=d.transaction('history-message','readonly').objectStore('history-message').get(${JSON.stringify("__ID__")});g.onerror=()=>resolve(null);g.onsuccess=()=>resolve(g.result??null)}})`.replace("__ID__",id))).value;
    const c=convertirRegistroHistoria(registro);
    const ultimo=c?.mensajes.filter(m=>m.rol==='asistente').at(-1);
    return ultimo?.fragmentos.find(f=>f.type==='RESPONSE')?.content ?? "";
  }
  async *observar(): AsyncGenerator<EventoStreaming> {
    let lt='',lr='',sin=0,reintentos=0;
    for(let i=0;i<1800;i++){
      await this.pausa(100);
      const ev=(await this.transporte.evaluar<EstadoStreamingDeepSeek>(scriptEstadoStreamingDeepSeek())).value;
      if(!ev){if(++sin>100)throw new ErrorTimeoutProveedor('No se encontró el área de respuesta de DeepSeek');continue;}
      if(ev.isError){if(reintentos++<3){await this.transporte.evaluar("document.querySelector('.ds-button--warning')?.click()");await this.pausa(1500);continue;}throw new ErrorPaginaProveedor(ev.errorMessage);}
      if(ev.think.startsWith(lt)&&ev.think.length>lt.length){yield{tipo:'pensamiento',contenido:ev.think.slice(lt.length)};lt=ev.think;}
      if(ev.response.startsWith(lr)&&ev.response.length>lr.length){yield{tipo:'respuesta',contenido:ev.response.slice(lr.length)};lr=ev.response;sin=0;}else if(lr)sin++;
      if(!lr && i>20){const respaldo=await this.respuestaIndexedDB();if(respaldo){yield{tipo:'respuesta',contenido:respaldo};yield{tipo:'fin'};return;}}
      if(ev.done || (lr && sin>30)){yield{tipo:'fin'};return;}
    }
    throw new ErrorTimeoutProveedor('El streaming de DeepSeek excedió el tiempo máximo');
  }
}
