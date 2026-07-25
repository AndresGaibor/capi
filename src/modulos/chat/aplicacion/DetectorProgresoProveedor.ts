export class DetectorProgresoProveedor {
  private firma?:string; private ultimoCambio:number;
  constructor(inicio=Date.now()){this.ultimoCambio=inicio}
  observar(firma:string|undefined,ahora=Date.now()):boolean{if(!firma)return false;if(firma===this.firma)return false;this.firma=firma;this.ultimoCambio=ahora;return true}
  edadSinProgreso(ahora=Date.now()){return Math.max(0,ahora-this.ultimoCambio)}
}
