import { SELECTORES_DEEPSEEK } from "../selectores/SelectoresDeepSeek";

export function scriptEnviarPromptDeepSeek(prompt: string): string {
  return `(() => {
    if (!window.__capiDeepSeekFetchOriginal) {
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
    const ta = document.querySelector(${JSON.stringify(SELECTORES_DEEPSEEK.textarea)});
    if (!ta) return { ok: false, error: 'Textarea no encontrado' };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, ${JSON.stringify(prompt)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));

    const compositor = ta.closest('form') || ta.parentElement?.parentElement?.parentElement || document;
    const visibles = [...compositor.querySelectorAll(${JSON.stringify(SELECTORES_DEEPSEEK.enviar)})]
      .filter(elemento => {
        const rect = elemento.getBoundingClientRect();
        const estilo = getComputedStyle(elemento);
        return rect.width > 0 && rect.height > 0 && estilo.display !== 'none' && estilo.visibility !== 'hidden';
      });
    const centro = ta.getBoundingClientRect();
    const btn = visibles.sort((a, b) => {
      const ar = a.getBoundingClientRect(); const br = b.getBoundingClientRect();
      const ad = Math.abs(ar.left - centro.right) + Math.abs(ar.top - centro.bottom);
      const bd = Math.abs(br.left - centro.right) + Math.abs(br.top - centro.bottom);
      return ad - bd;
    })[0];
    if (!btn) return { ok: false, error: 'Botón de envío visible no encontrado' };
    const rect = btn.getBoundingClientRect();
    return { ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

  })()`;
}
