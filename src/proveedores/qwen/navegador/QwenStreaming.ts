import { CAPI_CONFIG } from '../../../configuracion/ConstantesCapi';
import { configuracionProveedor } from '../../../configuracion/ConfiguracionProveedores';
import type { EventoStreaming } from '../../../nucleo/chat/EventoStreaming';
import type { TransporteNavegador } from '../../../plataforma/webbridge/TransporteNavegador';
import { DetectorProgresoProveedor } from '../../../modulos/chat/aplicacion/DetectorProgresoProveedor';
import { scriptExtraerEstadoStreamingQwen } from '../scripts/extraerEstadoStreaming';
import { extraerRespuestaSnapshotQwen } from './ExtraerRespuestaSnapshotQwen';
import { LectorTelemetriaQwen } from './LectorTelemetriaQwen';
const dormir=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const normalizar=(t:string)=>t.replace(/\u200B/g,'').replace(/\r\n/g,'\n').replace(/[ \t]+\n/g,'\n').trim();
const CFG=configuracionProveedor('qwen');
interface EstadoQwen {think:string;response:string;done:boolean;isGenerating?:boolean;isAssistant:boolean;isError:boolean;errorMessage:string;extractionStrategy?:string;}
export class QwenStreaming{
 constructor(private readonly transporte:TransporteNavegador,private readonly pausa:(ms:number)=>Promise<unknown>=dormir,private readonly ahora:()=>number=Date.now){}
 async *observar():AsyncGenerator<EventoStreaming>{
  let ultimoPensamiento='',ultimaRespuesta='',observada='',ultimoCambio=this.ahora(),ultimoSnapshot=0,ultimoHeartbeat=0,fallos=0,urlRecuperacion:string|undefined,conversacion:string|undefined,estancado=false;
  const lector=new LectorTelemetriaQwen(this.transporte,this.ahora); const progreso=new DetectorProgresoProveedor(this.ahora());
  while(true){
   await this.pausa(CFG.intervaloPollingMs); const ahora=this.ahora(); let evento:EstadoQwen|undefined;
   try{evento=(await this.transporte.evaluar<EstadoQwen>(scriptExtraerEstadoStreamingQwen())).value;fallos=0;if(!urlRecuperacion){try{urlRecuperacion=(await this.transporte.evaluar<string>('location.href')).value;conversacion=urlRecuperacion?.match(/\/c\/([^/?#]+)/)?.[1]}catch{}}}
   catch{fallos++;if(fallos>=CFG.maxReintentosConsecutivosAntesRecuperar&&this.transporte.recuperarPestana){yield{tipo:'estado',estado:'desconectado',progresoDetectado:false,estrategia:'dom',detalles:`reintento ${fallos}`};await this.transporte.recuperarPestana('chat.qwen.ai',urlRecuperacion)}continue}
   const tm=await lector.leer(conversacion); const tele=tm.valor;
   if(evento?.isError){yield{tipo:'error',mensaje:evento.errorMessage||'Error en Qwen',recuperable:true};return}
   const pensamiento=normalizar(evento?.think||''); let respuesta=normalizar(evento?.response||'');
   if(!respuesta&&/pensamiento completado/i.test(pensamiento)&&this.transporte.snapshotAccesibilidad&&ahora-ultimoSnapshot>=CFG.intervaloSnapshotMs){ultimoSnapshot=ahora;try{respuesta=normalizar(extraerRespuestaSnapshotQwen((await this.transporte.snapshotAccesibilidad()).tree))}catch{}}
   const firma=`${pensamiento.length}:${respuesta.length}:${evento?.isGenerating?1:0}:${evento?.done?1:0}:${tele?.firmaEstado??''}`;
   const cambio=progreso.observar(firma,ahora); const edad=progreso.edadSinProgreso(ahora);
   if(edad>=CFG.marcarEstancadaMs&&!estancado){estancado=true;yield{tipo:'estado',estado:'estancado',progresoDetectado:false,estrategia:tele?'tampermonkey':'dom',detalles:`sin progreso ${edad} ms`}}
   else if(cambio&&estancado){estancado=false;yield{tipo:'estado',estado:respuesta?'respondiendo':'pensando',progresoDetectado:true,estrategia:tele?'tampermonkey':'dom',detalles:'progreso reanudado'}}
   if(!evento?.isAssistant&&!tele)continue;
   if(pensamiento!==ultimoPensamiento&&!respuesta){const d=pensamiento.startsWith(ultimoPensamiento)?pensamiento.slice(ultimoPensamiento.length):pensamiento;ultimoPensamiento=pensamiento;if(d)yield{tipo:'pensamiento',contenido:d}}
   if(ahora-ultimoHeartbeat>=CFG.intervaloHeartbeatMs){ultimoHeartbeat=ahora;const estado=estancado?'estancado':respuesta?'respondiendo':(evento?.isGenerating||tele?.generando||pensamiento)?'pensando':evento?.isAssistant?'esperando_respuesta':'esperando_turno';yield{tipo:'estado',estado,progresoDetectado:cambio,estrategia:tele?'tampermonkey':'dom',detalles:tm.edadMs===undefined?tm.motivo:`telemetria=${tm.edadMs}ms`}}
   if(respuesta!==observada){observada=respuesta;ultimoCambio=ahora}
   if(respuesta.startsWith(ultimaRespuesta)&&respuesta.length>ultimaRespuesta.length){const d=respuesta.slice(ultimaRespuesta.length);ultimaRespuesta=respuesta;yield{tipo:'respuesta',contenido:d,estrategia:respuesta===evento?.response?(evento.extractionStrategy??'dom'):'snapshot-accesible'}}
   if(respuesta){const estabilidad=evento?.done?CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN_DOM_DONE:evento?.isGenerating?CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN_CON_STOP:CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_QWEN;if(ahora-ultimoCambio>=estabilidad){yield{tipo:'fin'};return}}
  }
 }
}
