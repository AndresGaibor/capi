import { ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import type { OpcionesDeepSeek } from "../tipos";
import { scriptEnviarPromptDeepSeek } from "../scripts/enviarPrompt";
export class DeepSeekEnvio {
  constructor(private readonly transporte: TransporteNavegador) {}
  async configurar(opciones: OpcionesDeepSeek, esNuevo: boolean): Promise<void> {
    const script=`(() => { const modelo=${JSON.stringify(opciones.modelo ?? null)}; if(${esNuevo} && modelo){document.querySelector('div[data-model-type="'+modelo+'"]')?.click();} const toggles=[...document.querySelectorAll('[aria-pressed]')]; const set=(n,v)=>{if(v==null)return;const b=toggles.find(x=>x.textContent?.includes(n));if(b && (b.getAttribute('aria-pressed')==='true')!==v)b.click();}; set('DeepThink',${JSON.stringify(opciones.deepThink)});set('Search',${JSON.stringify(opciones.search)});return true;})()`;
    await this.transporte.evaluar<boolean>(script);
  }
  async adjuntar(rutas: string[] = []): Promise<void> {
    if(!rutas.length)return;
    const { resolve }=await import('node:path');
    if(!this.transporte.cdp) throw new ErrorPaginaProveedor('El transporte no soporta CDP');
    const doc=await this.transporte.cdp<{root:{nodeId:number}}>('DOM.getDocument');
    const nodo=await this.transporte.cdp<{nodeId:number}>('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[type="file"]'});
    if(!nodo.nodeId) throw new ErrorPaginaProveedor('No se encontró el input de archivos de DeepSeek');
    await this.transporte.cdp('DOM.setFileInputFiles',{nodeId:nodo.nodeId,files:rutas.map((ruta)=>resolve(ruta))});
  }
  async enviar(prompt:string):Promise<void>{const r=await this.transporte.evaluar<{ok:boolean}>(scriptEnviarPromptDeepSeek(prompt));if(!r.value?.ok)throw new ErrorPaginaProveedor('No se pudo enviar el prompt a DeepSeek');}
}
