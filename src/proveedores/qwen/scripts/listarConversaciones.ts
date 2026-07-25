export function scriptListarConversacionesQwen(): string {
  return `(() => {
    const folders = Array.from(document.querySelectorAll('aside h3, [class*="sidebar"] h3, nav h3'));
    const secciones = [];
    for (const h3 of folders) {
      const titulo = (h3.textContent || '').trim();
      let sibling = h3.nextElementSibling;
      const items = [];
      while (sibling && sibling.tagName !== 'H3') {
        if (sibling.tagName === 'UL') {
          sibling.querySelectorAll('li').forEach(li => {
            if (!li.className.includes('chat')) return;
            let id = '';
            let text = (li.innerText || li.textContent || '').trim();
            const div = li.querySelector('[data-id], [data-chat-id], [data-conversation-id]');
            if (div) id = div.dataset?.id || div.dataset?.chatId || div.dataset?.conversationId || '';
            if (!id) {
              const parent = li.closest('[data-id], [data-chat-id], [data-conversation-id]');
              if (parent) id = parent.dataset?.id || parent.dataset?.chatId || parent.dataset?.conversationId || '';
            }
            if (!id) {
              const child = li.querySelector('[data-id], [data-chat-id], [data-conversation-id]');
              if (child) id = child.dataset?.id || child.dataset?.chatId || child.dataset?.conversationId || '';
            }
            if (id && text) items.push({ id, text });
          });
        }
        sibling = sibling.nextElementSibling;
      }
      if (items.length) secciones.push({ titulo, items });
    }
    if (!secciones.length) {
      const allItems = [];
      document.querySelectorAll('li.chat-item, [class*="chat-item"], [class*="conversation-item"]').forEach(li => {
        let id = '';
        let text = (li.innerText || li.textContent || '').trim();
        const div = li.querySelector('[data-id], [data-chat-id]');
        if (div) id = div.dataset?.id || div.dataset?.chatId || '';
        if (!id) {
          const parent = li.closest('[data-id]');
          if (parent) id = parent.dataset?.id || '';
        }
        if (id) allItems.push({ id, text });
      });
      if (allItems.length) secciones.push({ titulo: 'Chats', items: allItems });
    }
    return secciones;
  })()`;
}
