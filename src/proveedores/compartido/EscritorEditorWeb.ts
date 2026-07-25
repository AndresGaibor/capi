import type { TransporteNavegador } from "../../plataforma/webbridge/TransporteNavegador";

export interface ResultadoEscrituraEditor {
  estrategia: "fill" | "setter-nativo" | "cdp";
  tipo?: string;
  confirmado: boolean;
}

export class EscritorEditorWeb {
  constructor(private readonly transporte: TransporteNavegador) {}

  async escribir(selector: string, texto: string): Promise<ResultadoEscrituraEditor> {
    if (this.transporte.rellenar) {
      try {
        await this.transporte.rellenar(selector, texto);
        if (await this.confirmar(selector, texto)) return { estrategia: "fill", confirmado: true };
      } catch {}
    }

    const nativo = await this.transporte.evaluar<{ ok: boolean; tipo?: string }>(`(() => {
      const entrada=document.querySelector(${JSON.stringify(selector)});
      if (!(entrada instanceof HTMLElement)) return {ok:false};
      entrada.focus();
      if (entrada instanceof HTMLTextAreaElement || entrada instanceof HTMLInputElement) {
        const proto=entrada instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
        if(!setter)return {ok:false}; setter.call(entrada,${JSON.stringify(texto)});
      } else if (entrada.isContentEditable || entrada.getAttribute('contenteditable')==='true') {
        entrada.textContent=${JSON.stringify(texto)};
      } else return {ok:false};
      entrada.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:${JSON.stringify(texto)}}));
      entrada.dispatchEvent(new Event('change',{bubbles:true}));
      const valor='value' in entrada?String(entrada.value||''):String(entrada.textContent||'');
      return {ok:valor===${JSON.stringify(texto)},tipo:entrada.tagName.toLowerCase()};
    })()`);
    if (nativo.value?.ok && await this.confirmar(selector, texto)) return { estrategia: "setter-nativo", tipo: nativo.value.tipo, confirmado: true };

    if (!this.transporte.cdp) return { estrategia: "setter-nativo", confirmado: false };
    await this.transporte.evaluar(`document.querySelector(${JSON.stringify(selector)})?.focus()`);
    await this.transporte.cdp("Input.insertText", { text: texto });
    const confirmado = await this.confirmar(selector, texto);
    return { estrategia: "cdp", confirmado };
  }

  private async confirmar(selector: string, texto: string): Promise<boolean> {
    const r=await this.transporte.evaluar<{ coincide:boolean }>(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); const v=e?('value' in e?String(e.value||''):String(e.textContent||'')):''; return {coincide:v===${JSON.stringify(texto)}}; })()`);
    return r.value?.coincide === true;
  }
}
