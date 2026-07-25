import { SELECTORES_CHATGPT } from "../selectores/SelectoresChatGPT";

export function scriptEnviarPromptChatGPT(prompt: string): string {
  return `(() => {
    const editor = document.querySelector(${JSON.stringify(SELECTORES_CHATGPT.editor)});
    if (!editor) throw new Error("No se encontró el editor de ChatGPT");
    editor.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) throw new Error("No se pudo escribir en el textarea de ChatGPT");
    setter.call(editor, ${JSON.stringify(prompt)});
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    const boton = document.querySelector(${JSON.stringify(SELECTORES_CHATGPT.enviar)});
    if (!boton) throw new Error("No se encontró el botón de envío de ChatGPT");
    if (boton instanceof HTMLButtonElement && boton.disabled) throw new Error("El botón de envío de ChatGPT está deshabilitado");
    boton.click();
    return true;
  })()`;
}
