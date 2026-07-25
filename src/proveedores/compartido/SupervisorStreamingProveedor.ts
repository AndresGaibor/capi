import type { EventoStreaming } from '../../nucleo/chat/EventoStreaming';
import type { EstrategiaObservacion, EstadoProveedorNormalizado } from '../../nucleo/proveedores/ObservacionProveedor';
import type { ConfiguracionProveedorWeb } from '../../configuracion/ConfiguracionProveedores';
export class SupervisorStreamingProveedor{
 private firma?:string;private ultimoProgreso:number;private ultimoHeartbeat=0;private estancado=false;
 constructor(private cfg:ConfiguracionProveedorWeb,inicio=Date.now()){this.ultimoProgreso=inicio}
 observar(firma:string,estado:EstadoProveedorNormalizado,ahora:number,estrategia:EstrategiaObservacion='dom'):EventoStreaming[]{const eventos:EventoStreaming[]=[];const cambio=firma!==this.firma;if(cambio){this.firma=firma;this.ultimoProgreso=ahora;if(this.estancado){this.estancado=false;eventos.push({tipo:'estado',estado,progresoDetectado:true,estrategia,detalles:'progreso reanudado'})}}
  const edad=ahora-this.ultimoProgreso;if(edad>=this.cfg.marcarEstancadaMs&&!this.estancado){this.estancado=true;eventos.push({tipo:'estado',estado:'estancado',progresoDetectado:false,estrategia,detalles:`sin progreso ${edad} ms`})}
  if(ahora-this.ultimoHeartbeat>=this.cfg.intervaloHeartbeatMs){this.ultimoHeartbeat=ahora;eventos.push({tipo:'estado',estado:this.estancado?'estancado':estado,progresoDetectado:cambio,estrategia})}return eventos}
}
