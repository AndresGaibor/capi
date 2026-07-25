import { SELECTORES_QWEN } from "../selectores/SelectoresQwen";
import { scriptUtilidadesDom } from "../../compartido/scripts/utilidadesDom";

export function scriptPrepararEnvioQwen(prompt: string): string {
  return `(() => {
    ${scriptUtilidadesDom()}
    const entrada = __capiDom.primeroVisible(${JSON.stringify(SELECTORES_QWEN.entrada)}, document)
      || document.querySelector(${JSON.stringify(SELECTORES_QWEN.textarea)});
    if (!(entrada instanceof HTMLElement)) return { ok:false, error:'Entrada de Qwen no encontrada; estrategias: aria-label, placeholder, contenteditable, textarea histórico' };
    entrada.focus();
    try { sessionStorage.setItem('__capiQwenPrompt', ${JSON.stringify(prompt)}); } catch (_) {}
    if (entrada instanceof HTMLTextAreaElement || entrada instanceof HTMLInputElement) {
      const proto = entrada instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (!setter) return { ok:false, error:'Setter de entrada no disponible' };
      setter.call(entrada, ${JSON.stringify(prompt)});
    } else if (entrada.isContentEditable || entrada.getAttribute('contenteditable') === 'true') {
      entrada.textContent = ${JSON.stringify(prompt)};
    } else return { ok:false, error:'Tipo de entrada de Qwen no soportado' };
    entrada.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:${JSON.stringify(prompt)} }));
    entrada.dispatchEvent(new Event('change', { bubbles:true }));
    const valor = 'value' in entrada ? String(entrada.value || '') : String(entrada.textContent || '');
    if (valor !== ${JSON.stringify(prompt)}) return { ok:false, error:'Qwen no conservó el prompt en la entrada' };
    const raiz = entrada.closest('form') || entrada.parentElement?.parentElement || document;
    const candidatos = __capiDom.visibles(${JSON.stringify(SELECTORES_QWEN.enviarCandidatos)}, raiz)
      .filter(b => !b.disabled && b.getAttribute('aria-disabled') !== 'true');
    const btn = __capiDom.masCercano(entrada, candidatos);
    if (!(btn instanceof HTMLElement)) return { ok:false, error:'Botón de envío no disponible; candidatos:'+candidatos.length };
    const rect=btn.getBoundingClientRect();
    return { ok:true, x:rect.left+rect.width/2, y:rect.top+rect.height/2 };
  })()`;
}

export function scriptEnviarPromptQwen(prompt: string): string {
  return scriptPrepararEnvioQwen(prompt);
}
