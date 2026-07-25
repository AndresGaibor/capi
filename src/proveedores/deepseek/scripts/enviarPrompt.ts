import { SELECTORES_DEEPSEEK } from "../selectores/SelectoresDeepSeek";
import { scriptUtilidadesDom } from "../../compartido/scripts/utilidadesDom";

export function scriptEnviarPromptDeepSeek(prompt: string): string {
  return `(() => {
    ${scriptUtilidadesDom()}
    if (!window.__capiDeepSeekFetchOriginal && typeof window.fetch === 'function') {
      window.__capiDeepSeekFetchOriginal = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const respuesta = await window.__capiDeepSeekFetchOriginal(...args);
        const url = String(args[0]?.url || args[0] || '');
        if (url.includes('/api/v0/chat/completion')) {
          const captura = { raw:'', done:false, error:'' };
          window.__capiDeepSeekCompletion = captura;
          (async () => {
            try {
              const lector = respuesta.clone().body?.getReader();
              if (!lector) { captura.done = true; return; }
              const decoder = new TextDecoder();
              while (true) {
                const parte = await lector.read();
                if (parte.value) captura.raw += decoder.decode(parte.value, { stream: !parte.done });
                if (captura.raw.includes('[DONE]') || parte.done) { captura.done = true; break; }
              }
            } catch (error) { captura.error = String(error); captura.done = true; }
          })();
        }
        return respuesta;
      };
    }
    window.__capiDeepSeekCompletion = { raw:'', done:false, error:'' };
    window.__capiDeepSeekEnvio = { id: crypto.randomUUID(), iniciadoEn: Date.now(), prompt: ${JSON.stringify(prompt)} };
    const entrada = __capiDom.primeroVisible(${JSON.stringify(SELECTORES_DEEPSEEK.entrada)}, document)
      || document.querySelector(${JSON.stringify(SELECTORES_DEEPSEEK.textarea)});
    if (!(entrada instanceof HTMLElement)) return { ok:false, error:'Entrada de DeepSeek no encontrada; estrategias: name, placeholder, contenteditable, textarea' };
    entrada.focus();
    if (entrada instanceof HTMLTextAreaElement || entrada instanceof HTMLInputElement) {
      const proto = entrada instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (!setter) return { ok:false, error:'Setter de entrada no disponible' };
      setter.call(entrada, ${JSON.stringify(prompt)});
    } else if (entrada.isContentEditable || entrada.getAttribute('contenteditable') === 'true') {
      entrada.textContent = ${JSON.stringify(prompt)};
    } else return { ok:false, error:'Tipo de entrada de DeepSeek no soportado' };
    entrada.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:${JSON.stringify(prompt)} }));
    entrada.dispatchEvent(new Event('change', { bubbles:true }));
    const compositor = entrada.closest('form') || entrada.parentElement?.parentElement?.parentElement || document;
    const candidatos = __capiDom.visibles(${JSON.stringify(SELECTORES_DEEPSEEK.enviarCandidatos)}, compositor)
      .filter(b => !b.disabled && b.getAttribute('aria-disabled') !== 'true');
    const btn = __capiDom.masCercano(entrada, candidatos);
    if (!(btn instanceof HTMLElement)) return { ok:false, error:'Botón de envío visible no encontrado; candidatos:'+candidatos.length };
    const rect=btn.getBoundingClientRect();
    return { ok:true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`;
}
