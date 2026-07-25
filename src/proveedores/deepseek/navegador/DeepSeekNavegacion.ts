import { ErrorPaginaProveedor, ErrorProveedorNoDisponible } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { SELECTORES_DEEPSEEK } from "../selectores/SelectoresDeepSeek";
import type { GestorPestanas } from "../../../plataforma/webbridge/GestorPestanas";
const dormir=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export class DeepSeekNavegacion {
  constructor(private readonly transporte: TransporteNavegador, private readonly pausa: (ms:number)=>Promise<unknown> = dormir, private readonly gestorPestanas?: GestorPestanas) {}
  async verificar(): Promise<void> { if (!(await this.transporte.estaDisponible())) throw new ErrorProveedorNoDisponible("deepseek"); }
  async abrir(id?: string, nuevaPestana = false): Promise<void> {
    await this.verificar();
    const url=id?`https://chat.deepseek.com/a/chat/s/${id}`:"https://chat.deepseek.com/";
    let actual=""; try { actual=(await this.transporte.evaluar<string>("window.location.href")).value ?? ""; } catch {}
    let debeNavegar = true;
    try {
      const actualUrl = new URL(actual);
      debeNavegar = id
        ? !actualUrl.pathname.includes(`/a/chat/s/${id}`)
        : actualUrl.origin !== "https://chat.deepseek.com" || actualUrl.pathname !== "/";
    } catch {}
    if (debeNavegar || nuevaPestana) { if (nuevaPestana) await this.gestorPestanas?.validarNuevaPestana("deepseek"); await this.transporte.navegar(url,nuevaPestana,"CAPI DeepSeek"); await this.pausa(5000); }
    for(let i=0;i<15;i++){ const ok=await this.transporte.evaluar<boolean>(`!!document.querySelector(${JSON.stringify(SELECTORES_DEEPSEEK.textarea)})`); if(ok.value){ const host=await this.transporte.evaluar<string>("location.host"); if(host.value!=="chat.deepseek.com") throw new ErrorPaginaProveedor(`Se esperaba DeepSeek, pero la pestaña activa es ${host.value ?? "desconocida"}`); return; } await this.pausa(1000); }
    throw new ErrorPaginaProveedor("El textarea de DeepSeek no apareció");
  }

  async obtenerConversacionActual(intentos = 1): Promise<string | null> {
    for (let intento = 0; intento < intentos; intento++) {
      const url = (await this.transporte.evaluar<string>("window.location.href")).value ?? "";
      const id = url.match(/\/a\/chat\/s\/([^/?#]+)/)?.[1] ?? null;
      if (id) return id;
      if (intento + 1 < intentos) await this.pausa(250);
    }
    return null;
  }
}
