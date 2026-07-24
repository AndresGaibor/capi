export const SELECTORES_QWEN = {
  textarea: "textarea.message-input-textarea",
  enviar: 'button.send-button[aria-label="Enviar"],button.send-button,.chat-prompt-send-button button',
  modelo: '[aria-label="Select Model"],[class*="model-selector"]',
  listaModelos: '[role="listbox"][aria-label="Modelos"],[role="listbox"]',
} as const;
