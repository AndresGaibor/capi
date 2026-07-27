import { SELECTORES_CHATGPT } from "../selectores/SelectoresChatGPT";

export function scriptEstadoStreamingChatGPT(): string {
  return `(() => {
    const selectorMensajes = ${JSON.stringify(`${SELECTORES_CHATGPT.mensajesAsistente}, [data-testid^="conversation-turn"][data-turn="assistant"]`)};
    const mensajes = [...document.querySelectorAll(selectorMensajes)].filter((el, index, all) => all.indexOf(el) === index);
    const ultimo = mensajes[mensajes.length - 1];
    const contenido = ultimo?.querySelector('[data-message-author-role="assistant"]') || ultimo;
    const markdown = contenido?.querySelector('.markdown') || contenido;
    const textoBruto = (markdown?.innerText || markdown?.textContent || "").trim();
    const mitad = textoBruto.length / 2;
    const deduplicada = Number.isInteger(mitad) && textoBruto.slice(0, mitad) === textoBruto.slice(mitad)
      ? textoBruto.slice(0, mitad)
      : textoBruto;
    const respuesta = /^(pensando|thinking|generating|generando)\.{0,3}$/i.test(deduplicada)
      ? ""
      : deduplicada;
    // ChatGPT puede conservar [data-stream-active] durante la transición final;
    // el botón Stop es la señal visible y estable de generación real.
    const generando = Boolean(document.querySelector(${JSON.stringify(SELECTORES_CHATGPT.detener)}));
    const continueGenerating = Boolean(document.querySelector('[data-testid="continue-generating-button"], button[aria-label*="Continue generating"], button[aria-label*="Continuar generando"]'));
    const images = [...(markdown?.querySelectorAll('img') ?? [])]
      .map(img => ({ url: img.currentSrc || img.src, alt: img.alt || undefined, width: img.width }))
      .filter(item => item.url && !item.url.startsWith("data:image/svg+xml") && !(item.width && item.width < 48));
    const error = document.querySelector('[role="alert"], [data-testid="error-banner"]')?.textContent?.trim() || undefined;
    return { response: respuesta, images, turns: mensajes.length, isGenerating: generando, done: (Boolean(respuesta) || images.length > 0) && !generando, error, continueGenerating };
  })()`;
}
