import { SELECTORES_DEEPSEEK } from "../selectores/SelectoresDeepSeek";
export function scriptEnviarPromptDeepSeek(prompt: string): string {
  return `(async () => {
    const ta = document.querySelector(${JSON.stringify(SELECTORES_DEEPSEEK.textarea)});
    if (!ta) return { ok: false, error: 'Textarea no encontrado' };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, ${JSON.stringify(prompt)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));

    for (let i = 0; i < 50; i++) {
      const btn = document.querySelector(
        ${JSON.stringify(SELECTORES_DEEPSEEK.enviar)}
      );
      if (btn) {
        btn.click();
        for (let j = 0; j < 50; j++) {
          const actual = document.querySelector(${JSON.stringify(SELECTORES_DEEPSEEK.textarea)});
          if (!actual || actual.value.trim() === '' || location.pathname.includes('/a/chat/s/')) {
            return { ok: true };
          }
          await new Promise(r => setTimeout(r, 100));
        }
        return { ok: false, error: 'El botón recibió click, pero DeepSeek no inició el envío' };
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return { ok: false, error: 'Botón de envío no encontrado' };
  })()`;
}
