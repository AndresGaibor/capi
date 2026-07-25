import { SELECTORES_QWEN } from "../selectores/SelectoresQwen";

export function scriptPrepararEnvioQwen(prompt: string): string {
  return `(() => {
    const ta = document.querySelector(${JSON.stringify(SELECTORES_QWEN.textarea)});
    if (!(ta instanceof HTMLTextAreaElement)) return { ok:false, error:'Textarea no encontrado' };
    ta.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) return { ok:false, error:'Setter de textarea no disponible' };
    try { sessionStorage.setItem('__capiQwenPrompt', ${JSON.stringify(prompt)}); } catch (_) {}
    setter.call(ta, ${JSON.stringify(prompt)});
    ta.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:${JSON.stringify(prompt)} }));
    ta.dispatchEvent(new Event('change', { bubbles:true }));
    if (ta.value !== ${JSON.stringify(prompt)}) return { ok:false, error:'Qwen no conservó el prompt en el textarea' };
    const botones = [...document.querySelectorAll(${JSON.stringify(SELECTORES_QWEN.enviar)})];
    const btn = botones.find(b => {
      const r=b.getBoundingClientRect(); const s=getComputedStyle(b);
      return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && !b.disabled;
    });
    if (!(btn instanceof HTMLElement)) return { ok:false, error:'Botón de envío no disponible' };
    const rect=btn.getBoundingClientRect();
    return { ok:true, x:rect.left+rect.width/2, y:rect.top+rect.height/2 };
  })()`;
}

export function scriptEnviarPromptQwen(prompt: string): string {
  return scriptPrepararEnvioQwen(prompt);
}
