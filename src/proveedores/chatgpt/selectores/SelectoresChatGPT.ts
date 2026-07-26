export const SELECTORES_CHATGPT = {
  editor: '.ProseMirror[contenteditable="true"]',
  enviar: '[data-testid="composer"] button[data-testid="send-button"], button[data-testid="send-button"], .composer-submit-button-color, [data-testid="composer"] button[type="submit"]',
  adjuntarImagenes: '[data-testid="upload-photos-input"]',
  adjuntarArchivos: 'input[type="file"]',
  detener: '[data-testid="stop-button"],button[aria-label*="Detener"],button[aria-label*="Stop"]',
  mensajesAsistente: '[data-message-author-role="assistant"]',
  conversaciones: 'a[href*="/c/"]',
};
