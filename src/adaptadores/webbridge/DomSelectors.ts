export const DomSelectors = {
  header: {
    container: "._2be88ba, .f8d1e4c0, .the-header",
    modelBadge: ".c03d486a ._46a12ab, ._2be88ba .the-header ._46a12ab, .the-header ._46a12ab",
    modelContainer: ".c03d486a, ._2be88ba .the-header",
    title: ".afa34042, .d00ed9c9",
  },

  input: {
    textarea: 'textarea[name="search"]',
    sendButton: 'div[role="button"].ds-button--primary:not(.ds-button--disabled)',
    sendButtonFallback: 'div[role="button"].ds-button--primary',
    modelButton: (model: string) => `div[data-model-type="${model}"]`,
    selectedModelButton: 'div[data-model-type][class*="selected"], div[data-model-type][aria-checked="true"]',
    toggleButtons: ".ds-toggle-button",
    fileInput: 'input[type="file"]',
  },

  response: {
    thinkOfficial: ".ds-think-content",
    responseOfficial: ".ds-assistant-message-main-content",
    thinkFallback: '[class*="think"], [class*="Thought"]',
    responseFallback: '.ds-markdown, [class*="markdown"]',
    stopButton: '.ds-button--stop, [class*="stop"]',
    warningButton: ".ds-button--warning",
    actionButtons: '.ds-button--iconLabelTertiary, [class*="button"]',
    loading: '[class*="loading"]',
  },

  messages: {
    virtualListItem: "[data-virtual-list-item-key]",
    assistantContent: ".ds-assistant-message-main-content",
    thinkContent: ".ds-think-content",
    userMessage: ".ds-message",
    virtualListContainer: ".ds-virtual-list",
  },
} as const;
