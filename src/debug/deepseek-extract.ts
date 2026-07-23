#!/usr/bin/env bun

const WEBBRIDGE_URL = "http://127.0.0.1:10086";
const SESSION = "capi-deepseek-extract";
const DEFAULT_CHAT_ID = "a3068eae-6dac-45b2-b51d-40ea381fc2bd";

function getChatId(): string {
  const arg = Bun.argv[2];
  return arg && arg.trim() ? arg.trim() : DEFAULT_CHAT_ID;
}

async function wb(action: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const response = await fetch(`${WEBBRIDGE_URL}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args, session: SESSION }),
  });
  const json = (await response.json()) as { ok: boolean; data?: unknown; error?: unknown };
  if (!json.ok) {
    throw new Error(JSON.stringify(json.error ?? json));
  }
  return json.data;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrollPass(): Promise<void> {
  await wb("evaluate", {
    code: `(() => {
      const candidates = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const style = getComputedStyle(el);
          return el.scrollHeight > el.clientHeight + 40 && style.overflowY !== "visible";
        })
        .slice(0, 12);

      for (const el of candidates) {
        try {
          el.scrollTop = 0;
          el.dispatchEvent(new Event("scroll", { bubbles: true }));
          el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
          el.dispatchEvent(new Event("scroll", { bubbles: true }));
        } catch {}
      }

      window.scrollTo(0, 0);
      window.dispatchEvent(new Event("scroll"));
      return candidates.map((el) => ({
        tag: el.tagName,
        className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
    })()`,
  });
}

async function extractFromPage(): Promise<Array<Record<string, unknown>>> {
  const result = (await wb("evaluate", {
    code: `(() => {
      const chatData = [];
      const visibleItems = document.querySelector('.ds-virtual-list-visible-items');
      const messageNodes = document.querySelectorAll('[data-virtual-list-item-key]');
      const nodes = messageNodes.length > 0 ? Array.from(messageNodes) : (visibleItems ? Array.from(visibleItems.children) : []);

      nodes.forEach((node) => {
        const assistantNode = node.querySelector?.('.ds-assistant-message-main-content');

        if (assistantNode) {
          const thoughtNode = node.querySelector?.('.ds-think-content');
          const thoughtText = thoughtNode ? thoughtNode.innerText.trim() : null;
          const responseText = assistantNode.innerText.trim();

          chatData.push({
            Rol: '🤖 Asistente',
            Pensamiento: thoughtText ? 'Sí' : 'No',
            Mensaje: responseText,
            DeepThink: thoughtText,
          });
        } else {
          const userNode = node.querySelector?.('.ds-message');
          const userText = userNode ? userNode.innerText.trim() : (node.innerText || node.textContent || '').trim() || 'Texto no encontrado';

          chatData.push({
            Rol: '👤 Usuario',
            Pensamiento: '-',
            Mensaje: userText,
          });
        }
      });

      return chatData;
    })()`,
  })) as { type: string; value: Array<Record<string, unknown>> };

  return Array.isArray(result.value) ? result.value : [];
}

async function main(): Promise<void> {
  const chatId = getChatId();
  const url = `https://chat.deepseek.com/a/chat/s/${chatId}`;

  console.log("[deepseek-extract] Intentando usar la pestaña activa...");
  let hasTab = false;
  try {
    await wb("find_tab", { active: true });
    hasTab = true;
    console.log("[deepseek-extract] Pestaña activa tomada");
  } catch {
    console.log("[deepseek-extract] No hubo pestaña activa disponible");
  }

  if (!hasTab) {
    console.log(`[deepseek-extract] Abriendo ${url}`);
    await wb("navigate", { url, newTab: true, group_title: "CAPI DeepSeek Extract" });
  } else {
    const currentUrl = (await wb("evaluate", {
      code: "window.location.href",
    })) as { type: string; value: string };

    if (!currentUrl.value.includes(chatId)) {
      console.log(`[deepseek-extract] Abriendo ${url}`);
      await wb("navigate", { url, newTab: true, group_title: "CAPI DeepSeek Extract" });
    } else {
      console.log(`[deepseek-extract] Ya estamos en el chat objetivo: ${currentUrl.value}`);
    }
  }

  console.log("[deepseek-extract] Esperando hidratación de la conversación...");
  await wait(12000);

  // Intentos con scroll para forzar render de la lista virtualizada.
  for (let i = 0; i < 4; i++) {
    console.log(`[deepseek-extract] Paso de scroll ${i + 1}/4`);
    await scrollPass();
    await wait(2500);

    const data = await extractFromPage();
    console.log(`[deepseek-extract] Mensajes encontrados: ${data.length}`);

    if (data.length > 0) {
      console.log(JSON.stringify(data, null, 2));
      await wb("close_session", {});
      return;
    }
  }

  console.log("[deepseek-extract] Fallback: abriendo chat desde la lista lateral...");
  await wb("navigate", { url: "https://chat.deepseek.com", newTab: false });
  await wait(6000);
  await wb("click", { selector: `a[href*="${chatId}"]` });
  await wait(12000);

  for (let i = 0; i < 2; i++) {
    console.log(`[deepseek-extract] Fallback scroll ${i + 1}/2`);
    await scrollPass();
    await wait(2500);

    const data = await extractFromPage();
    console.log(`[deepseek-extract] Mensajes encontrados (fallback): ${data.length}`);

    if (data.length > 0) {
      console.log(JSON.stringify(data, null, 2));
      await wb("close_session", {});
      return;
    }
  }

  const debug = await wb("evaluate", {
    code: `(() => {
      const vl = document.querySelector('.ds-virtual-list');
      const visible = document.querySelector('.ds-virtual-list-visible-items');
      const items = document.querySelector('.ds-virtual-list-items');
      const visibleChildren = visible ? Array.from(visible.children).map((el) => ({
        tag: el.tagName,
        className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
        text: (el.textContent || '').slice(0, 400),
        innerHTML: (el.innerHTML || '').slice(0, 400),
      })) : [];

      const findScrollable = Array.from(document.querySelectorAll('*'))
        .filter((el) => {
          const style = getComputedStyle(el);
          return el.scrollHeight > el.clientHeight + 40 && style.overflowY !== 'visible';
        })
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          text: (el.textContent || '').slice(0, 200),
        }));

      return {
        hasVirtualList: !!vl,
        visibleChildCount: visible ? visible.children.length : 0,
        itemsChildCount: items ? items.children.length : 0,
        visibleChildren,
        scrollables: findScrollable,
      };
    })()`
  }) as {
    hasVirtualList?: boolean;
    visibleChildCount?: number;
    itemsChildCount?: number;
    visibleChildren?: Array<Record<string, unknown>>;
    scrollables?: Array<Record<string, unknown>>;
  };

  console.log("[deepseek-extract] Sin resultados. Debug:");
  console.log(JSON.stringify(debug, null, 2));

  await wb("close_session", {});
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[deepseek-extract] Error:", error);
  process.exit(1);
});
