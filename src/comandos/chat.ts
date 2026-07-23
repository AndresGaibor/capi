#!/usr/bin/env bun

import { defineCommand } from "citty";
import * as prompts from "@clack/prompts";
import consola from "consola";
import {
  loadSession,
  isSessionExpired,
  type DeepSeekSession,
} from "../auth/deepseek.ts";

const WEBBRIDGE_URL = "http://127.0.0.1:10086";
const BRIDGE_URL = "http://localhost:3847/api/deepseek/session";
const SESSION_NAME = "capi-capture";

async function webbridgeCommand(action: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const body = JSON.stringify({ action, args, session: SESSION_NAME });
  const response = await fetch(WEBBRIDGE_URL + "/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const json = (await response.json()) as { ok: boolean; data: Record<string, unknown> };
  if (!json.ok) throw new Error(`WebBridge error: ${JSON.stringify(json)}`);
  return json.data;
}

async function ensureBridge(): Promise<void> {
  try {
    const res = await fetch("http://localhost:3847/health");
    if (res.ok) return;
  } catch {}
  const bunBin = "/Users/andresgaibor/.bun/bin/bun";
  const { spawn } = await import("node:child_process");
  spawn(bunBin, ["run", "/Users/andresgaibor/code/javascript/capi/src/cli.ts", "serve"], {
    detached: true,
    stdio: "ignore",
    cwd: "/Users/andresgaibor/code/javascript/capi",
  }).unref();
  await new Promise((r) => setTimeout(r, 2000));
}

async function isKimiWebBridgeAvailable(): Promise<boolean> {
  try {
    await webbridgeCommand("list_tabs", {});
    return true;
  } catch {
    return false;
  }
}

async function capturarSesion(): Promise<boolean> {
  const disponible = await isKimiWebBridgeAvailable();
  if (!disponible) return false;

  consola.info("Abriendo DeepSeek Chat...");
  const navResult = (await webbridgeCommand("navigate", {
    url: "https://chat.deepseek.com",
    newTab: true,
    group_title: "CAPI Session",
  })) as { success: boolean };
  if (!navResult.success) return false;

  consola.info("Esperando cookies...");
  let cookies: Record<string, string> = {};
  for (let i = 0; i < 8; i++) {
    const cdpResult = (await webbridgeCommand("cdp", {
      method: "Network.getAllCookies",
      params: {},
    })) as { cookies?: Array<{ name: string; value: string; domain?: string }> };
    const allCookies = (cdpResult.cookies || []) as Array<{ name: string; value: string; domain?: string }>;
    cookies = {};
    for (const c of allCookies) {
      const d = c.domain || "";
      if (d.includes("deepseek") || d.includes("chatdeepseek")) {
        cookies[c.name] = c.value;
      }
    }
    if (cookies["ds_session_id"]) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!cookies["ds_session_id"]) return false;

  const evalResult = (await webbridgeCommand("evaluate", {
    code: `(function() {
      try {
        const raw = localStorage.getItem('userToken');
        if (!raw) return null;
        try { const p = JSON.parse(raw); return typeof p === 'string' ? p : (p && p.value) || null; } catch { return raw; }
      } catch { return null; }
    })()`,
  })) as { type: string; value: string | null };
  const userToken = evalResult.value;
  if (!userToken) return false;

  await ensureBridge();
  const bundle = {
    source: "deepseek-kimi-webbridge",
    capturedAt: new Date().toISOString(),
    authorization: userToken.startsWith("Bearer ") ? userToken : `Bearer ${userToken}`,
    cookies: {
      thumbcache: Object.entries(cookies).find(([k]) => k.startsWith(".thumbcache")) ? `${Object.entries(cookies).find(([k]) => k.startsWith(".thumbcache"))![0]}=${Object.entries(cookies).find(([k]) => k.startsWith(".thumbcache"))![1]}` : "",
      awsWafToken: cookies["aws-waf-token"] ? `aws-waf-token=${cookies["aws-waf-token"]}` : "",
      dsSessionId: `ds_session_id=${cookies["ds_session_id"]}`,
    },
  };

  try {
    const res = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    });
    if (!res.ok) return false;
  } catch {
    return false;
  }

  await webbridgeCommand("close_session", {});
  return true;
}

async function esperarSesion(timeoutMs = 60000): Promise<DeepSeekSession | null> {
  const pollMs = 800;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const session = loadSession();
    if (session && !isSessionExpired(session)) return session;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}

function extractMessagesFromTree(tree: unknown[]): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();
  const walk = (nodes: unknown) => {
    if (!nodes || !Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (n.role === "StaticText" && typeof n.name === "string") {
        const txt = n.name.trim();
        if (txt.length > 1 && !seen.has(txt)) {
          seen.add(txt);
          texts.push(txt);
        }
      }
      if (Array.isArray(n.children)) walk(n.children);
    }
  };
  walk(tree);
  return texts;
}

function parseConversation(texts: string[]): Array<{ role: string; content: string }> {
  const mensajes: Array<{ role: string; content: string }> = [];
  const skipPrefixes = ["AI-generated", "DeepThink", "Search", "Instant", "Andres Gaibor", "New chat", "30 Days", "Yesterday"];
  const isSkip = (t: string) => skipPrefixes.some((p) => t.startsWith(p));

  let i = 0;
  while (i < texts.length) {
    const txt = texts[i] ?? "";

    if (txt === "hola" || txt === "Hola") {
      mensajes.push({ role: "user", content: "hola" });
      i++;
      continue;
    }

    if (txt.startsWith("¡Hola!") || txt.startsWith("Me alegra que hayas escrito") || txt.startsWith("Greeting back")) {
      let content = "";
      while (i < texts.length) {
        const t = texts[i] ?? "";
        if (t === "hola" || t === "Hola" || isSkip(t)) break;
        if (t.includes("DeepThink") || t.includes("Analyze the User") || t.includes("Determine the Goal")) break;
        if (t.length > 2) content += (content ? " " : "") + t;
        i++;
      }
      if (content.trim()) mensajes.push({ role: "assistant", content: content.trim() });
      continue;
    }

    if (txt.includes("Thought for")) {
      let content = "";
      i++;
      while (i < texts.length) {
        const t = texts[i] ?? "";
        if (t === "hola" || t === "Hola" || isSkip(t)) break;
        if (t.includes("¡Hola!") || t.includes("Me alegra que hayas escrito")) break;
        if (t.includes("Analyze the User") || t.includes("Determine the Goal") || t.includes("Formulate the Response")) {
          content += (content ? " | " : "") + t;
        }
        i++;
      }
      if (content.trim()) mensajes.push({ role: "reasoning", content: content.trim() });
      continue;
    }

    i++;
  }

  return mensajes;
}

async function scrollDeepSeekPage(): Promise<void> {
  await webbridgeCommand("evaluate", {
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

async function extractMessagesFromPage(): Promise<Array<{ Rol: string; Pensamiento: string; Mensaje: string; DeepThink?: string }>> {
  const evalResult = (await webbridgeCommand("evaluate", {
    code: `(() => {
      const messageNodes = document.querySelectorAll('[data-virtual-list-item-key]');
      const chatData = [];
      const visibleItems = document.querySelector('.ds-virtual-list-visible-items');
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
  })) as { type: string; value: Array<{ Rol: string; Pensamiento: string; Mensaje: string; DeepThink?: string }> };

  return Array.isArray(evalResult.value) ? evalResult.value : [];
}

interface ChatSession {
  id: string;
  title: string;
  title_type: string;
  pinned: boolean;
  model_type: string;
  updated_at: number;
}

interface ApiResponse {
  code: number;
  msg: string;
  data: {
    biz_code: number;
    biz_msg: string;
    biz_data: {
      chat_sessions: ChatSession[];
      has_more: boolean;
    };
  };
}

async function llamarApi(session: DeepSeekSession): Promise<void> {
  const cookieHeader = [session.thumbcache, session.awsWafToken, session.dsSessionId]
    .filter(Boolean)
    .join("; ");

  const response = await fetch(
    "https://chat.deepseek.com/api/v0/chat_session/fetch_page?lte_cursor.pinned=false",
    {
      method: "GET",
      headers: {
        Accept: "*/*",
        Authorization: session.authorization,
        Cookie: cookieHeader,
        Referer: "https://chat.deepseek.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "X-Client-Bundle-Id": "com.deepseek.chat",
        "X-Client-Locale": "es_419",
        "X-Client-Platform": "web",
        "X-Client-Version": "2.2.0",
      },
    }
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESION_EXPIRADA");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse;

  if (data.code !== 0) {
    throw new Error(data.msg || "Error de API");
  }

  const sesiones = data.data.biz_data.chat_sessions;

  if (sesiones.length === 0) {
    prompts.outro("No hay sesiones");
    return;
  }

  prompts.outro(`Se encontraron ${sesiones.length} sesiones\n`);

  const lineas = sesiones.map((sesion, idx) => {
    const num = String(idx + 1).padStart(2, " ");
    const titulo = sesion.title.length > 45 ? sesion.title.slice(0, 44) + "…" : sesion.title;
    const modelo = sesion.model_type === "expert" ? "✨" : "💬";
    const pinned = sesion.pinned ? "📌" : "  ";
    return `${num}. ${pinned} ${modelo} ${titulo} ${sesion.id}`;
  });

  consola.log("\n" + lineas.join("\n") + "\n");

  if (data.data.biz_data.has_more) {
    consola.warn("Hay más sesiones (no se muestran)");
  }
}

export const chatCommand = defineCommand({
  meta: {
    name: "chat",
    description: "Gestionar sesiones de chat en DeepSeek",
  },
  subCommands: {
    list: defineCommand({
      meta: { name: "list", description: "Listar sesiones de DeepSeek" },
      async run() {
        prompts.intro("🔍 Obteniendo sesiones de DeepSeek Chat...");

        let session = loadSession();

        if (isSessionExpired(session)) {
          await ensureBridge();
          const ok = await capturarSesion();
          if (!ok) consola.warn("No se pudo capturar automáticamente — intentando con sesión existente");
          session = await esperarSesion(60000);
          if (!session) {
            consola.error("No hay sesión disponible.");
            process.exit(1);
          }
          consola.success("Sesión lista");
        }

        if (!session!.dsSessionId) {
          consola.warn("ds_session_id no disponible — algunas funciones pueden no funcionar");
        }

        try {
          await llamarApi(session!);
        } catch (err: unknown) {
          if ((err as Error).message === "SESION_EXPIRADA") {
            consola.warn("Sesión expirada — re-capturando...");
            await ensureBridge();
            const ok = await capturarSesion();
            if (!ok) {
              prompts.cancel("No se pudo capturar la sesión.");
              return;
            }
            session = await esperarSesion(60000);
            if (!session) {
              consola.error("No se pudo obtener la sesión.");
              process.exit(1);
            }
            await llamarApi(session);
          } else {
            consola.error("Error:", (err as Error).message);
            process.exit(1);
          }
        }
      },
    }),

    messages: defineCommand({
      meta: { name: "messages", description: "Ver mensajes de una conversación" },
      args: {
        id: { type: "positional", required: true, description: "ID de la conversación" },
      },
      async run({ args }) {
        prompts.intro(`💬 Cargando conversación...`);

        const disponible = await isKimiWebBridgeAvailable();
        if (!disponible) {
          prompts.cancel("Kimi WebBridge no disponible.");
          return;
        }

        const chatUrl = `https://chat.deepseek.com/a/chat/s/${args.id}`;
        const chatSelector = `a[href*="${args.id}"]`;

        let hasTab = false;
        try {
          await webbridgeCommand("find_tab", { active: true });
          hasTab = true;
        } catch {}

        if (hasTab) {
          const currentUrl = (await webbridgeCommand("evaluate", {
            code: "window.location.href",
          })) as { type: string; value: string };

          if (!currentUrl.value.includes(args.id)) {
            consola.info("Abriendo conversación directa...");
            const navResult = (await webbridgeCommand("navigate", {
              url: chatUrl,
              newTab: true,
              group_title: "CAPI Messages",
            })) as { success: boolean };

            if (!navResult.success) {
              prompts.cancel("No se pudo abrir DeepSeek Chat.");
              return;
            }
          }
        } else {
          consola.info("Abriendo DeepSeek Chat...");
          const navResult = (await webbridgeCommand("navigate", {
            url: chatUrl,
            newTab: true,
            group_title: "CAPI Messages",
          })) as { success: boolean };

          if (!navResult.success) {
            prompts.cancel("No se pudo abrir DeepSeek Chat.");
            return;
          }
        }

        await new Promise((r) => setTimeout(r, 12000));

        for (let i = 0; i < 4; i++) {
          consola.info(`Extrayendo mensajes... (${i + 1}/4)`);
          await scrollDeepSeekPage();
          await new Promise((r) => setTimeout(r, 2500));

          const chatData = await extractMessagesFromPage();
          if (Array.isArray(chatData) && chatData.length > 0) {
            prompts.outro(`\n📝 Conversación (${chatData.length} mensajes)\n`);

            for (const msg of chatData) {
              if (msg.Rol === "👤 Usuario") {
                consola.log(`\n👤 Tú:\n  ${msg.Mensaje}`);
              } else if (msg.Rol === "🤖 Asistente") {
                if (msg.DeepThink) {
                  consola.log(`\n💭 DeepThink:\n  ${msg.DeepThink}`);
                }
                consola.log(`\n🤖 DeepSeek:\n  ${msg.Mensaje}`);
              }
            }

            await webbridgeCommand("close_session", {});
            consola.log("");
            return;
          }
        }

        consola.info("Fallback: abriendo chat desde la lista lateral...");
        await webbridgeCommand("navigate", { url: "https://chat.deepseek.com", newTab: false });
        await new Promise((r) => setTimeout(r, 6000));
        await webbridgeCommand("click", { selector: chatSelector });
        await new Promise((r) => setTimeout(r, 12000));

        for (let i = 0; i < 2; i++) {
          consola.info(`Fallback extracción... (${i + 1}/2)`);
          await scrollDeepSeekPage();
          await new Promise((r) => setTimeout(r, 2500));

          const chatData = await extractMessagesFromPage();
          if (Array.isArray(chatData) && chatData.length > 0) {
            prompts.outro(`\n📝 Conversación (${chatData.length} mensajes)\n`);

            for (const msg of chatData) {
              if (msg.Rol === "👤 Usuario") {
                consola.log(`\n👤 Tú:\n  ${msg.Mensaje}`);
              } else if (msg.Rol === "🤖 Asistente") {
                if (msg.DeepThink) {
                  consola.log(`\n💭 DeepThink:\n  ${msg.DeepThink}`);
                }
                consola.log(`\n🤖 DeepSeek:\n  ${msg.Mensaje}`);
              }
            }

            await webbridgeCommand("close_session", {});
            consola.log("");
            return;
          }
        }

        await webbridgeCommand("close_session", {});
        prompts.cancel("No se encontraron mensajes. Asegúrate de tener la conversación abierta en DeepSeek.");
      },
    }),
  },
});
