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

async function waitForSelector(selector: string, timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = (await wb("evaluate", {
      code: `(() => ({ exists: !!document.querySelector(${JSON.stringify(selector)}) }))()`,
    })) as { type: string; value: { exists?: boolean } };

    if (state.value.exists) return true;
    await wait(1000);
  }

  return false;
}

async function waitForConversationHydration(timeoutMs = 25000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = (await wb("evaluate", {
      code: `(() => {
        const messageNodes = document.querySelectorAll('[data-virtual-list-item-key] .ds-message, [data-virtual-list-item-key] .ds-assistant-message-main-content');
        const visibleItems = document.querySelector('.ds-virtual-list-visible-items');

        return {
          hasMessageNodes: messageNodes.length > 0,
          visibleChildCount: visibleItems ? visibleItems.children.length : 0,
          hasAssistantContent: !!document.querySelector('.ds-assistant-message-main-content'),
          hasUserContent: !!document.querySelector('.ds-message'),
        };
      })()`,
    })) as {
      type: string;
      value: {
        hasMessageNodes?: boolean;
        visibleChildCount?: number;
        hasAssistantContent?: boolean;
        hasUserContent?: boolean;
      };
    };

    if (state.value.hasMessageNodes || state.value.hasAssistantContent || state.value.hasUserContent) {
      return true;
    }

    await wait(1000);
  }

  return false;
}

async function scrollPass(): Promise<void> {
  await wb("evaluate", {
    code: `(() => {
      const targeted = [
        document.querySelector('.ds-scroll-area'),
        document.querySelector('.ds-virtual-list'),
        document.querySelector('.ds-virtual-list-items'),
        document.querySelector('.ds-virtual-list-visible-items'),
      ].filter(Boolean);

      const candidates = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const style = getComputedStyle(el);
          return el.scrollHeight > el.clientHeight + 40 && style.overflowY !== "visible";
        })
        .slice(0, 12);

      const targets = Array.from(new Set([...targeted, ...candidates]));

      for (const el of targets) {
        try {
          el.scrollTop = 0;
          el.dispatchEvent(new Event("scroll", { bubbles: true }));
          el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
          el.dispatchEvent(new Event("scroll", { bubbles: true }));
        } catch {}
      }

      window.scrollTo(0, 0);
      window.dispatchEvent(new Event("scroll"));
      return targets.map((el) => ({
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
    const tabs = await wb("list_tabs", {});
    console.log("[deepseek-extract] Tabs visibles:");
    console.log(JSON.stringify(tabs, null, 2));
  }

  if (!hasTab) {
    console.log(`[deepseek-extract] Abriendo ${url}`);
    await wb("navigate", { url, newTab: false });
  } else {
    const currentUrl = (await wb("evaluate", {
      code: "window.location.href",
    })) as { type: string; value: string };

    if (!currentUrl.value.includes(chatId)) {
      console.log(`[deepseek-extract] Abriendo ${url}`);
      await wb("navigate", { url, newTab: false });
    } else {
      console.log(`[deepseek-extract] Ya estamos en el chat objetivo: ${currentUrl.value}`);
    }
  }

  await wb("evaluate", {
    code: `(() => {
      if (window.__capiReqLogInstalled) return true;
      window.__capiReqLogInstalled = true;
      window.__capiRequests = [];

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        try {
          window.__capiRequests.push({ type: 'fetch', url: String(args[0]), ts: Date.now() });
        } catch {}
        return originalFetch(...args);
      };

      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        try { this.__capiUrl = String(url); } catch {}
        return originalOpen.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.send = function(...args) {
        try {
          window.__capiRequests.push({ type: 'xhr', url: String(this.__capiUrl || ''), ts: Date.now() });
        } catch {}
        return originalSend.apply(this, args);
      };

      return true;
    })()`,
  });

  console.log("[deepseek-extract] Esperando hidratación de la conversación...");
  await wait(12000);

  for (let i = 0; i < 8; i++) {
    const probe = await wb("evaluate", {
      code: `(() => ({
        url: window.location.href,
        messageNodeCount: document.querySelectorAll('[data-virtual-list-item-key]').length,
        userCount: document.querySelectorAll('.ds-message').length,
        assistantCount: document.querySelectorAll('.ds-assistant-message-main-content').length,
        thinkCount: document.querySelectorAll('.ds-think-content').length,
        scrollArea: (() => {
          const el = document.querySelector('.ds-scroll-area');
          return el ? { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, text: (el.textContent || '').slice(0, 200) } : null;
        })(),
        bodyText: (document.body.textContent || '').slice(0, 300),
      }))()`,
    });
    console.log(`[deepseek-extract] Probe ${i + 1}/8:`);
    console.log(JSON.stringify(probe, null, 2));

    const value = probe as { type?: string; value?: { messageNodeCount?: number; userCount?: number; assistantCount?: number } };
    if ((value.value?.messageNodeCount ?? 0) > 0 || (value.value?.userCount ?? 0) > 0 || (value.value?.assistantCount ?? 0) > 0) {
      break;
    }

    await wait(5000);
  }

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

  const requests = await wb("evaluate", {
    code: `(() => ({
      intercepted: (window.__capiRequests || []).filter((r) => String(r.url || '').includes('deepseek') || String(r.url || '').includes('chat') || String(r.url || '').includes('api')).slice(-100),
      performance: performance.getEntriesByType('resource').map((r) => r.name).filter((name) => String(name).includes('deepseek') || String(name).includes('chat') || String(name).includes('api')).slice(-200),
    }))()`,
  });
  console.log("[deepseek-extract] Requests capturados:");
  console.log(JSON.stringify(requests, null, 2));

  const storage = await wb("evaluate", {
    code: `Promise.all([
      Promise.resolve({ localStorageKeys: Object.keys(localStorage), localStorage: Object.fromEntries(Object.keys(localStorage).map((k) => [k, (localStorage.getItem(k) || '').slice(0, 200)])) }),
      indexedDB.databases ? indexedDB.databases().then((dbs) => ({ indexedDbDatabases: dbs.map((db) => ({ name: db.name, version: db.version })) })) : Promise.resolve({ indexedDbDatabases: [] }),
    ]).then(([a, b]) => ({ ...a, ...b }))`,
  });
  console.log("[deepseek-extract] Storage actual:");
  console.log(JSON.stringify(storage, null, 2));

  const idb = await wb("evaluate", {
    code: `new Promise((resolve) => {
      const req = indexedDB.open('deepseek-chat');
      req.onerror = () => resolve({ error: String(req.error || 'open_failed') });
      req.onsuccess = () => {
        const db = req.result;
        const storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length === 0) {
          db.close();
          resolve({ stores: [] });
          return;
        }

        const results = [];
        let pending = storeNames.length;

        for (const storeName of storeNames) {
          try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const countReq = store.count();
            countReq.onerror = () => {
              results.push({ name: storeName, error: String(countReq.error || 'count_failed') });
              pending -= 1;
              if (pending === 0) {
                db.close();
                resolve({ stores: results });
              }
            };
            countReq.onsuccess = () => {
              const getAllReq = store.getAll();
              getAllReq.onerror = () => {
                results.push({ name: storeName, count: countReq.result, error: String(getAllReq.error || 'getAll_failed') });
                pending -= 1;
                if (pending === 0) {
                  db.close();
                  resolve({ stores: results });
                }
              };
              getAllReq.onsuccess = () => {
                results.push({ name: storeName, count: countReq.result, sample: getAllReq.result.slice(0, 2) });
                pending -= 1;
                if (pending === 0) {
                  db.close();
                  resolve({ stores: results });
                }
              };
            };
          } catch (error) {
            results.push({ name: storeName, error: String(error) });
            pending -= 1;
            if (pending === 0) {
              db.close();
              resolve({ stores: results });
            }
          }
        }
      };
    })`,
  });
  console.log("[deepseek-extract] IndexedDB deepseek-chat:");
  console.log(JSON.stringify(idb, null, 2));

  await wb("close_session", {});
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[deepseek-extract] Error:", error);
  process.exit(1);
});
