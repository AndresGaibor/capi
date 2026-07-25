import type { TransporteNavegador } from '../../../plataforma/webbridge/TransporteNavegador';
import type { EstadoProveedorNormalizado } from '../../../nucleo/proveedores/ObservacionProveedor';
export interface TelemetriaQwenV2 { version:2; proveedor:'qwen'; conversacionId:string|null; turnoId:string|null; estado:EstadoProveedorNormalizado; generando:boolean; actualizadoEn:number; ultimoCambioRealEn:number; mutacionesTotales:number; cambiosRelevantes:number; firmaTurno:string|null; firmaEstado:string; disponible:true; }
export interface LecturaTelemetriaQwen { disponible:boolean; saludable:boolean; atrasada:boolean; edadMs?:number; valor?:TelemetriaQwenV2; motivo?:string; }
export class LectorTelemetriaQwen {
  constructor(private readonly transporte:TransporteNavegador,private readonly ahora:()=>number=Date.now){}
  async leer(conversacionEsperada?:string):Promise<LecturaTelemetriaQwen>{
    try{
      const v=(await this.transporte.evaluar<unknown>('window.__CAPI_QWEN_BRIDGE__ ?? null')).value as Partial<TelemetriaQwenV2>|null;
      if(!v)return{disponible:false,saludable:false,atrasada:false,motivo:'ausente'};
      if(v.version!==2||v.proveedor!=='qwen'||typeof v.actualizadoEn!=='number'||typeof v.firmaEstado!=='string')return{disponible:true,saludable:false,atrasada:false,motivo:'incompatible'};
      if(conversacionEsperada&&v.conversacionId&&v.conversacionId!==conversacionEsperada)return{disponible:true,saludable:false,atrasada:false,motivo:'conversacion_distinta'};
      const edad=this.ahora()-v.actualizadoEn; const valor=v as TelemetriaQwenV2;
      return{disponible:true,saludable:edad<=45_000,atrasada:edad>45_000&&edad<=90_000,edadMs:edad,valor:edad<=90_000?valor:undefined,motivo:edad>90_000?'expirada':undefined};
    }catch{return{disponible:false,saludable:false,atrasada:false,motivo:'error_lectura'};}
  }
}
