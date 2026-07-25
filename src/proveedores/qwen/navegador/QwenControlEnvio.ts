import { ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptPrepararEnvioQwen } from "../scripts/enviarPrompt";
import { SELECTORES_QWEN } from "../selectores/SelectoresQwen";
import { EscritorEditorWeb } from "../../compartido/EscritorEditorWeb";
import { scriptConfirmarPromptHistorialQwen } from "../scripts/respuestaHistorial";

interface EstadoConfirmacionEnvioQwen {
  promptAparecio: boolean;
  entradaVacia: boolean;
  conversacionNueva: boolean;
  conversacionId?: string;
  generando: boolean;
}

export class QwenControlEnvio {
  constructor(
    private readonly transporte: TransporteNavegador,
    private readonly pausa: (ms: number) => Promise<unknown> = (ms) =>
      new Promise((resolver) => setTimeout(resolver, ms)),
  ) {}

  async enviar(prompt: string): Promise<void> {
    if (this.transporte.rellenar) {
      await new EscritorEditorWeb(this.transporte).escribir(SELECTORES_QWEN.textarea, prompt);
    }
    const rutaInicial = (await this.transporte.evaluar<string>("location.pathname")).value ?? "";
    const resultado = await this.transporte.evaluar<{ ok: boolean; error?: string; x?: number; y?: number }>(
      scriptPrepararEnvioQwen(prompt),
    );
    if (!resultado.value?.ok) {
      throw new ErrorPaginaProveedor(resultado.value?.error ?? "No se pudo preparar el prompt de Qwen");
    }

    const { x, y } = resultado.value;
    let clicConfirmado = false;
    if (this.transporte.click) {
      try {
        await this.transporte.click("button.send-button:not(.disabled),button[aria-label*='enviar' i]:not(:disabled),button[aria-label*='send' i]:not(:disabled)");
        clicConfirmado = true;
      } catch {
        clicConfirmado = false;
      }
    }
    if (!clicConfirmado) {
      const clicDom = await this.transporte.evaluar<boolean>(`(() => {
        const botones = [...document.querySelectorAll(${JSON.stringify(SELECTORES_QWEN.enviar)})];
        const btn = botones.find(b => {
          const r=b.getBoundingClientRect(); const s=getComputedStyle(b);
          return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && !b.disabled;
        });
        if (!(btn instanceof HTMLElement)) return false;
        btn.click(); return true;
      })()`);
      clicConfirmado = clicDom.value === true;
    }
    if (!clicConfirmado && this.transporte.cdp && Number.isFinite(x) && Number.isFinite(y)) {
      try {
        await this.transporte.cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await this.transporte.cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await this.transporte.cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        clicConfirmado = true;
      } catch {
        clicConfirmado = false;
      }
    }

    const huella = prompt.slice(0, 120).trim();
    for (let intento = 0; intento < 150; intento++) {
      const estado = await this.transporte.evaluar<EstadoConfirmacionEnvioQwen>(`(() => {
        const entrada=document.querySelector(${JSON.stringify(SELECTORES_QWEN.textarea)});
        const valor=entrada ? ('value' in entrada ? String(entrada.value||'') : String(entrada.textContent||'')) : '';
        const raiz=document.querySelector('main')||document;
        const usuarios=[...raiz.querySelectorAll('.qwen-chat-message-user,[data-message-role="user"],[data-role="user"]')];
        const promptAparecio=usuarios.some(n=>String(n.textContent||'').includes(${JSON.stringify(huella)}));
        const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
        const generando=[...document.querySelectorAll(${JSON.stringify(SELECTORES_QWEN.detenerCandidatos.join(","))})].some(visible);
        const conversacionId=location.pathname.split('/c/')[1]?.split(/[?#]/)[0]||'';
        return {promptAparecio,entradaVacia:!entrada||valor.trim()==='',conversacionNueva:!!conversacionId&&location.pathname!==${JSON.stringify(rutaInicial)},conversacionId,generando};
      })()`);
      if (estado.value?.promptAparecio) return;
      if (estado.value?.conversacionId && intento % 5 === 0) {
        const confirmado = await this.transporte.evaluar<boolean>(
          scriptConfirmarPromptHistorialQwen(estado.value.conversacionId, huella),
        );
        if (confirmado.value) return;
      }
      await this.pausa(200);
    }
    const error = new ErrorPaginaProveedor("Qwen vació el editor o creó la conversación, pero no materializó el mensaje del usuario");
    Object.assign(error, { codigo: "ENVIO_QWEN_NO_CONFIRMADO" });
    throw error;
  }
}
