export const SELECTORES_DEEPSEEK = {
  entrada: [
    'textarea[name="search"]',
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="mensaje" i]',
    '[role="textbox"][contenteditable="true"]',
    'main textarea',
  ],
  enviarCandidatos: [
    'button[aria-label*="send" i]',
    'button[aria-label*="enviar" i]',
    '[role="button"][aria-label*="send" i]',
    'div.ds-button--primary.ds-button--filled.ds-button--circle',
    'div[role="button"].ds-button--primary.ds-button--filled',
  ],
  detenerCandidatos: [
    'button[aria-label*="stop" i]',
    'button[aria-label*="detener" i]',
    '[role="button"][aria-label*="stop" i]',
    'button[title*="stop" i]',
  ],
  respuestaCandidatos: ['[data-testid="assistant-content"]','[data-message-role="assistant"] article','[data-role="assistant"] article','.ds-markdown','[data-testid*="markdown" i]'],
  textarea: 'textarea[name="search"],textarea[placeholder*="message" i],textarea[placeholder*="mensaje" i],[role="textbox"][contenteditable="true"],main textarea',
  enviar: 'button[aria-label*="send" i],button[aria-label*="enviar" i],[role="button"][aria-label*="send" i],div.ds-button--primary.ds-button--filled.ds-button--circle,div[role="button"].ds-button--primary.ds-button--filled',
  respuesta: '[data-testid="assistant-content"],[data-message-role="assistant"] article,[data-role="assistant"] article,.ds-markdown,[data-testid*="markdown" i]',
} as const;
