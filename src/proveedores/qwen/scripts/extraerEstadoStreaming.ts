export function scriptExtraerEstadoStreamingQwen(): string {
  return `
    (() => {
      const mainContent = document.querySelector('main.main-content');
      const messages = mainContent
        ? mainContent.querySelectorAll(
            '.qwen-chat-message, [class*="chat-message-item"], [class*="message-item"]'
          )
        : [];

      const allMessages = Array.from(messages);
      var promptEsperado = '';
      try { promptEsperado = sessionStorage.getItem('__capiQwenPrompt') || ''; } catch (_) {}
      const huellaPrompt = promptEsperado.slice(0, 120).trim();
      let indiceUsuario = -1;
      if (huellaPrompt) {
        for (let i = allMessages.length - 1; i >= 0; i--) {
          const mensaje = allMessages[i];
          const texto = (mensaje.innerText || mensaje.textContent || '').trim();
          const esAsistente = mensaje.matches('.qwen-chat-message-assistant, [class*="assistant"], [class*="bot"]') ||
            !!mensaje.querySelector('.qwen-chat-message-assistant, [class*="assistant"], [class*="bot"]');
          if (!esAsistente && texto.includes(huellaPrompt)) { indiceUsuario = i; break; }
        }
      }
      const assistantMsgs = allMessages.filter((m, i) =>
        i > indiceUsuario && (
          m.matches('.qwen-chat-message-assistant, [class*="assistant"], [class*="bot"]') ||
          m.querySelector('.qwen-chat-message-assistant, [class*="assistant"], [class*="bot"]')
        )
      );
      const lastAssistant = assistantMsgs[assistantMsgs.length - 1] || null;

      var responseBoxes = lastAssistant
        ? Array.from(lastAssistant.querySelectorAll('.response-message-box'))
        : [];
      var isDualResponse = responseBoxes.length > 1;

      var contentCandidates = isDualResponse
        ? responseBoxes.map((box) =>
            box.querySelector('.response-message-content, .qwen-markdown, [class*="response-message-content"]')
          )
        : [lastAssistant
            ? lastAssistant.querySelector('.response-message-content, .qwen-markdown, [class*="response-message-content"]')
            : null];

      var responseTexts = contentCandidates
        .map((element) => element ? (element.innerText || element.textContent || '').trim() : '')
        .filter((value) => value.length > 0);
      var responseText = responseTexts[0] || '';

      var thinkingCandidates = isDualResponse
        ? responseBoxes.map((box) =>
            box.querySelector('.qwen-thinking-status-card-title-text, [class*="thinking"], [class*="tool-status"]')
          )
        : [lastAssistant
            ? lastAssistant.querySelector('.qwen-thinking-status-card-title-text, .qwen-thinking-selector, [class*="thinking"], [class*="tool-status"]')
            : null];
      var thinkTexts = thinkingCandidates
        .map((element) => element ? (element.innerText || element.textContent || '').trim() : '')
        .filter((value) => value.length > 0);
      var thinkText = thinkTexts[0] || '';

      function isVisible(element) {
        if (!element) return false;
        var target = element.closest('button, [role="button"]') || element;
        var style = window.getComputedStyle(target);
        var rect = target.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity || '1') > 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      }

      var stopControl = document.querySelector([
        'button[aria-label*="stop" i]',
        'button[aria-label*="detener" i]',
        'button[aria-label*="interrumpir" i]',
        'button[title*="stop" i]',
        'button[title*="detener" i]',
        'button[class*="stop" i]',
        '[role="button"][aria-label*="stop" i]',
        'svg use[href*="stop" i]'
      ].join(', '));
      var isGenerating = isVisible(stopControl);

      var actionToolbar = lastAssistant
        ? lastAssistant.querySelector(
            'svg use[href*="copy" i], svg use[href*="regenerate" i], svg use[href*="refresh" i], svg use[href*="thumb" i], svg use[href*="dianzan" i]'
          )
        : null;

      var errorNode = lastAssistant
        ? lastAssistant.querySelector('.qwen-alert, .qwen-messsage-status, [class*="error"]')
        : null;
      var isError = !!errorNode;
      var errorMessage = errorNode
        ? (errorNode.innerText || errorNode.textContent || '').trim()
        : '';

      var done = isError || (
        responseText.length > 0 &&
        !isGenerating &&
        (!!actionToolbar || !stopControl)
      );

      return {
        think: thinkText,
        response: responseText,
        done: done,
        isGenerating: isGenerating,
        isAssistant: !!lastAssistant,
        isError: isError,
        errorMessage: errorMessage || (isError ? 'Error en la respuesta de Qwen' : ''),
        isDualResponse: isDualResponse,
        alternativeCount: responseBoxes.length,
      };
    })()
  `;
}
