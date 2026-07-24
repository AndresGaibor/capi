import { ErrorPaginaProveedor, ErrorProveedorNoDisponible } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
const dormir=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export class DeepSeekNavegacion {
  constructor(private readonly transporte: TransporteNavegador, private readonly pausa: (ms:number)=>Promise<unknown> = dormir) {}
  async verificar(): Promise<void> { if (!(await this.transporte.estaDisponible())) throw new ErrorProveedorNoDisponible("deepseek"); }
  async abrir(id?: string): Promise<void> {
    await this.verificar();
    const url=id?`https://chat.deepseek.com/a/chat/s/${id}`:"https://chat.deepseek.com/";
    let actual=""; try { actual=(await this.transporte.evaluar<string>("window.location.href")).value ?? ""; } catch {}
    if (!actual.includes(id ?? "chat.deepseek.com")) { await this.transporte.navegar(url,false,"CAPI DeepSeek"); await this.pausa(5000); }
    for(let i=0;i<15;i++){ const ok=await this.transporte.evaluar<boolean>("!!document.querySelector('textarea[name=\"search\"]')"); if(ok.value){ const host=await this.transporte.evaluar<string>("location.host"); if(host.value!=="chat.deepseek.com") throw new ErrorPaginaProveedor(`Se esperaba DeepSeek, pero la pestaña activa es ${host.value ?? "desconocida"}`); return; } await this.pausa(1000); }
    throw new ErrorPaginaProveedor("El textarea de DeepSeek no apareció");
  }
}
