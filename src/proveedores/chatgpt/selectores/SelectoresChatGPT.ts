export const SELECTORES_CHATGPT = {
  editor: '.ProseMirror[contenteditable="true"]',
  enviar: '[data-testid="composer"] button[data-testid="send-button"], button[data-testid="send-button"], .composer-submit-button-color, [data-testid="composer"] button[type="submit"]',
  adjuntarImagenes: '#upload-photos, [data-testid="upload-photos-input"]',
  adjuntarArchivos: '#upload-files, input[type="file"]:not(#upload-photos):not(#upload-camera)',
  detener: '[data-testid="stop-button"],button[aria-label*="Detener"],button[aria-label*="Stop"]',
  mensajesAsistente: '[data-message-author-role="assistant"]',
  conversaciones: 'a[href*="/c/"]',
};
