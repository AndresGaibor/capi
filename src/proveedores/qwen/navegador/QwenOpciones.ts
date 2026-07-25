import { ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizar = (texto: string) => texto.trim().toLocaleLowerCase("es");

interface PosicionControl {
  actual: string;
  x: number;
  y: number;
}

interface PosicionOpcion {
  x: number;
  y: number;
  texto: string;
}

export class QwenOpciones {
  constructor(
    private readonly transporte: TransporteNavegador,
    private readonly pausa: (ms: number) => Promise<unknown> = dormir,
  ) {}

  async configurarRazonamiento(activar: boolean): Promise<void> {
    const objetivo = activar ? /^(thinking|pensamiento)$/i : /^(fast|rápido|rapido)$/i;
    const control = (await this.transporte.evaluar<PosicionControl | null>(`(()=>{
      const selector=document.querySelector('.qwen-select-thinking');
      const etiqueta=selector?.querySelector('.qwen-select-thinking-label-text');
      const rect=selector?.getBoundingClientRect();
      if(!selector||!rect||rect.width<=0||rect.height<=0)return null;
      return{actual:String(etiqueta?.textContent||''),x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    })()`)).value;
    if (!control) throw new ErrorPaginaProveedor("Selector de razonamiento de Qwen no encontrado");
    if (objetivo.test(normalizar(control.actual))) return;
    if (!this.transporte.cdp) throw new ErrorPaginaProveedor("Qwen requiere CDP para cambiar el modo de razonamiento");

    let opcion: PosicionOpcion | null | undefined;
    let posicion = control;
    for (let apertura = 0; apertura < 3 && !opcion; apertura++) {
      await this.clicFisico(posicion.x, posicion.y);
      for (let sondeo = 0; sondeo < 20 && !opcion; sondeo++) {
        await this.pausa(100);
        opcion = (await this.transporte.evaluar<PosicionOpcion | null>(`(()=>{
          const opciones=[...document.querySelectorAll('.qwen-select-thinking-dropdown .ant-select-item-option')];
          const objetivo=opciones.find(e=>${objetivo}.test(String(e.textContent||'').trim()));
          const rect=objetivo?.getBoundingClientRect();
          if(!objetivo||!rect||rect.width<=0||rect.height<=0)return null;
          return{x:rect.left+rect.width/2,y:rect.top+rect.height/2,texto:String(objetivo.textContent||'').trim()};
        })()`)).value;
      }
      if (!opcion) {
        posicion = (await this.transporte.evaluar<PosicionControl | null>(`(()=>{
          const selector=document.querySelector('.qwen-select-thinking');
          const etiqueta=selector?.querySelector('.qwen-select-thinking-label-text');
          const rect=selector?.getBoundingClientRect();
          if(!selector||!rect||rect.width<=0||rect.height<=0)return null;
          return{actual:String(etiqueta?.textContent||''),x:rect.left+rect.width/2,y:rect.top+rect.height/2};
        })()`)).value ?? posicion;
      }
    }
    if (!opcion) throw new ErrorPaginaProveedor(`Opción ${activar ? "Thinking" : "Fast"} de Qwen no encontrada`);
    await this.clicFisico(opcion.x, opcion.y);

    for (let intento = 0; intento < 20; intento++) {
      await this.pausa(100);
      const actual = (await this.transporte.evaluar<string>("document.querySelector('.qwen-select-thinking-label-text')?.textContent?.trim() || ''")).value ?? "";
      if (objetivo.test(normalizar(actual))) return;
    }
    throw new ErrorPaginaProveedor(`Qwen no confirmó el modo ${activar ? "Thinking" : "Fast"}`);
  }

  private async clicFisico(x: number, y: number): Promise<void> {
    await this.transporte.cdp?.("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await this.transporte.cdp?.("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.transporte.cdp?.("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
}
