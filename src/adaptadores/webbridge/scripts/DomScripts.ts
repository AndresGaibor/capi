import { DomSelectors } from "../DomSelectors";
import type { OpcionesChat } from "../../../dominio/deepseek/casos-de-uso/EnviarMensajeStreaming";

export class DomScripts {
  static scriptObtenerModeloHeader(): string {
    return `
      (() => {
        const spanHeader = document.querySelector(${JSON.stringify(DomSelectors.header.modelBadge)});
        if (spanHeader && spanHeader.innerText?.trim()) {
          return spanHeader.innerText.trim();
        }

        const containerHeader = document.querySelector(${JSON.stringify(DomSelectors.header.modelContainer)});
        if (containerHeader && containerHeader.innerText?.trim()) {
          return containerHeader.innerText.trim();
        }

        const selectedBtn = document.querySelector(${JSON.stringify(DomSelectors.input.selectedModelButton)});
        if (selectedBtn) {
          return selectedBtn.getAttribute('data-model-type') || selectedBtn.innerText?.trim() || null;
        }

        return null;
      })()
    `;
  }

  static scriptConfigurarInterfaz(opciones: OpcionesChat, esChatNuevo: boolean): string {
    return `
      (() => {
        let warningModelo = false;
        const esNuevo = ${esChatNuevo ? "true" : "false"};
        const modeloDeseado = ${opciones.modelo ? `'${opciones.modelo}'` : "null"};

        if (esNuevo && modeloDeseado) {
          const btnModelo = document.querySelector(\`div[data-model-type="\${modeloDeseado}"]\`);
          if (btnModelo) {
            btnModelo.click();
          } else {
            warningModelo = true;
          }
        }

        setTimeout(() => {
          const toggles = Array.from(document.querySelectorAll(${JSON.stringify(DomSelectors.input.toggleButtons)}));
          const configurarToggle = (nombre, estadoDeseado) => {
            if (estadoDeseado === null || estadoDeseado === undefined) return;
            const btn = toggles.find(t => t.textContent.includes(nombre));
            if (btn) {
              const estadoActual = btn.getAttribute('aria-pressed') === 'true';
              if (estadoActual !== estadoDeseado) btn.click();
            }
          };

          configurarToggle("DeepThink", ${opciones.deepThink});
          configurarToggle("Search", ${opciones.search});
        }, 200);

        return { warningModelo };
      })()
    `;
  }

  static scriptInyectarArchivoBase64(fileName: string, mimeType: string, base64: string): string {
    return `
      (() => {
        try {
          const byteCharacters = atob(${JSON.stringify(base64)});
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: ${JSON.stringify(mimeType)} });
          const file = new File([blob], ${JSON.stringify(fileName)}, { type: ${JSON.stringify(mimeType)} });

          const dt = new DataTransfer();
          dt.items.add(file);

          const input = document.querySelector(${JSON.stringify(DomSelectors.input.fileInput)});
          if (!input) return { ok: false, reason: "file input not found" };

          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      })()
    `;
  }

  static scriptEnviarPrompt(prompt: string): string {
    return `
      (() => {
        const ta = document.querySelector(${JSON.stringify(DomSelectors.input.textarea)});
        if (!ta) return { ok: false };
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(ta, ${JSON.stringify(prompt)});
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        const btn = document.querySelector(${JSON.stringify(DomSelectors.input.sendButton)}) ||
                    document.querySelector(${JSON.stringify(DomSelectors.input.sendButtonFallback)});
        if (btn) btn.click();
        return { ok: true };
      })()
    `;
  }

  static scriptConteoRespuesta(): string {
    return `
      (() => {
        const thinkCount = document.querySelectorAll('${DomSelectors.response.thinkOfficial}, ${DomSelectors.response.thinkFallback}').length;
        const respCount = document.querySelectorAll('${DomSelectors.response.responseOfficial}, ${DomSelectors.response.responseFallback}').length;
        const markdownCount = document.querySelectorAll('${DomSelectors.response.responseFallback}').length;
        const isGenerating = !!document.querySelector('${DomSelectors.response.stopButton}, ${DomSelectors.response.loading}');
        return { thinkCount, respCount, markdownCount, isGenerating };
      })()
    `;
  }

  static scriptEstadoStreaming(): string {
    return `
      (() => {
        let thinkNodes = Array.from(document.querySelectorAll('${DomSelectors.response.thinkOfficial}'));
        let responseNodes = Array.from(document.querySelectorAll('${DomSelectors.response.responseOfficial}'));

        if (thinkNodes.length === 0) {
          thinkNodes = Array.from(document.querySelectorAll('${DomSelectors.response.thinkFallback}'));
        }
        if (responseNodes.length === 0) {
          responseNodes = Array.from(document.querySelectorAll('${DomSelectors.response.responseFallback}'));
        }

        const thinkNode = thinkNodes.length > 0 ? thinkNodes[thinkNodes.length - 1] : null;
        const responseNode = responseNodes.length > 0 ? responseNodes[responseNodes.length - 1] : null;

        let done = false;
        const hasStopBtn = !!document.querySelector('${DomSelectors.response.stopButton}');

        if (responseNode) {
          const container = responseNode.closest('div[class*="message"]') || responseNode.parentElement?.parentElement?.parentElement;
          if (container) {
            const actionBtns = container.querySelectorAll('${DomSelectors.response.actionButtons}');
            done = actionBtns.length >= 2 && !hasStopBtn;
          } else {
            done = !hasStopBtn;
          }
        }

        const errorBtn = document.querySelector('${DomSelectors.response.warningButton}');
        const isError = !!errorBtn;
        let errorMessage = "Server is busy.";

        if (isError) {
          const spans = Array.from(document.querySelectorAll('span'));
          const errSpan = spans.find(s => s.innerText.includes('Server is busy') || s.innerText.includes('Try again'));
          if (errSpan) errorMessage = errSpan.innerText;
        }

        const thinkText = thinkNode ? (thinkNode.innerText || thinkNode.textContent || '').trim() : '';
        const responseText = responseNode ? (responseNode.innerText || responseNode.textContent || '').trim() : '';

        return {
          think: thinkText,
          response: responseText,
          done: done,
          isAssistant: !!thinkNode || !!responseNode || isError || hasStopBtn,
          isError: isError,
          errorMessage: errorMessage
        };
      })()
    `;
  }

  static scriptExtraerMensajesDOM(): string {
    return `
      (() => {
        const nodes = document.querySelectorAll('${DomSelectors.messages.virtualListItem}');
        if (!nodes.length) return [];
        const msgs = [];
        nodes.forEach((node) => {
          const assistant = node.querySelector('${DomSelectors.messages.assistantContent}');
          if (assistant) {
            const think = node.querySelector('${DomSelectors.messages.thinkContent}');
            msgs.push({
              rol: 'asistente',
              pensamiento: think ? 'Sí' : 'No',
              mensaje: assistant.innerText.trim(),
              deepThink: think ? think.innerText.trim() : undefined,
            });
          } else {
            const user = node.querySelector('${DomSelectors.messages.userMessage}');
            const text = user ? user.innerText.trim() : (node.innerText || node.textContent || '').trim();
            if (text) {
              msgs.push({ rol: 'usuario', pensamiento: '-', mensaje: text });
            }
          }
        });
        return msgs;
      })()
    `;
  }
}
