import { ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptPrepararEnvioQwen } from "../scripts/enviarPrompt";
import { SELECTORES_QWEN } from "../selectores/SelectoresQwen";
import { EscritorEditorWeb } from "../../compartido/EscritorEditorWeb";

export class QwenControlEnvio {
  constructor(
    private readonly transporte: TransporteNavegador,
    private readonly pausa: (ms: number) => Promise<unknown> = (ms) =>
      new Promise((resolver) => setTimeout(resolver, ms)),
  ) {}

  async enviar(prompt: string): Promise<void> {
    if (this.transporte.rellenar) await new EscritorEditorWeb(this.transporte).escribir(SELECTORES_QWEN.textarea, prompt);
    const rutaInicial = (await this.transporte.evaluar<string>("location.pathname")).value ?? "";
    const resultado = await this.transporte.evaluar<{ ok: boolean; error?: string; x?: number; y?: number }>(scriptPrepararEnvioQwen(prompt));
    if (!resultado.value?.ok) throw new ErrorPaginaProveedor(resultado.value?.error ?? "No se pudo preparar el prompt de Qwen");
    const { x, y } = resultado.value;
    if (this.transporte.cdp && Number.isFinite(x) && Number.isFinite(y)) {
      try {
        await this.transporte.cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await this.transporte.cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await this.transporte.cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      } catch {
        await this.transporte.evaluar(`document.elementFromPoint(${x},${y})?.click()`);
      }
    }
    await this.transporte.evaluar(`(() => {
      const botones = [...document.querySelectorAll(${JSON.stringify(SELECTORES_QWEN.enviar)})];
      const btn = botones.find(b => {
        const r=b.getBoundingClientRect(); const s=getComputedStyle(b);
        return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && !b.disabled;
      });
      btn?.click();
    })()`);
    for (let intento = 0; intento < 80; intento++) {
      const estado = await this.transporte.evaluar<{ vacio: boolean; conversacionNueva: boolean }>(
        `(() => { const entrada=document.querySelector(${JSON.stringify(SELECTORES_QWEN.textarea)}); const valor=entrada ? ('value' in entrada ? String(entrada.value||'') : String(entrada.textContent||'')) : ''; return {vacio:!entrada||valor.trim()==='',conversacionNueva:location.pathname.startsWith('/c/')&&location.pathname!==${JSON.stringify(rutaInicial)}}; })()`,
      );
      if (estado.value?.vacio || estado.value?.conversacionNueva) return;
      await this.pausa(100);
    }
    throw new ErrorPaginaProveedor("Qwen no inició el envío tras el click confiable");
  }
}
