#!/usr/bin/env bun

import { defineCommand } from "citty";
import * as prompts from "@clack/prompts";
import consola from "consola";
import { spawn } from "node:child_process";
import { join } from "node:path";

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
  const bunBin = process.execPath || "bun";
  spawn(bunBin, ["run", join(process.cwd(), "src/cli.ts"), "serve"], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  }).unref();
  await new Promise((r) => setTimeout(r, 3000));
}

async function sendToBridge(data: {
  authorization: string;
  cookies: {
    thumbcache: string;
    awsWafToken: string;
    dsSessionId: string;
  };
}): Promise<boolean> {
  await ensureBridge();
  const bundle = {
    source: "deepseek-kimi-webbridge",
    capturedAt: new Date().toISOString(),
    authorization: data.authorization,
    cookies: data.cookies,
  };
  try {
    const res = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function getDeepSeekCookies(): Promise<Record<string, string>> {
  const cdpResult = (await webbridgeCommand("cdp", {
    method: "Network.getAllCookies",
    params: {},
  })) as { cookies?: Array<{ name: string; value: string; domain?: string }> };

  const cookies = (cdpResult.cookies || []) as Array<{ name: string; value: string; domain?: string }>;
  const deepseekCookies: Record<string, string> = {};

  for (const c of cookies) {
    const domain = c.domain || "";
    if (domain.includes("deepseek") || domain.includes("chatdeepseek")) {
      deepseekCookies[c.name] = c.value;
    }
  }

  return deepseekCookies;
}

async function getUserToken(): Promise<string | null> {
  const evalResult = (await webbridgeCommand("evaluate", {
    code: `(function() {
      try {
        const raw = localStorage.getItem('userToken');
        if (!raw) return null;
        try {
          const p = JSON.parse(raw);
          return typeof p === 'string' ? p : (p && p.value) || null;
        } catch { return raw; }
      } catch { return null; }
    })()`,
  })) as { type: string; value: string | null };
  return evalResult.value;
}

export const captureCommand = defineCommand({
  meta: {
    name: "capture",
    description: "Capturar sesión de DeepSeek usando Kimi WebBridge (incluye ds_session_id HttpOnly)",
  },
  async run() {
    prompts.intro("🔍 Capturando sesión de DeepSeek via Kimi WebBridge...");

    consola.info("Verificando Kimi WebBridge...");
    try {
      await webbridgeCommand("list_tabs", {});
      consola.success("Kimi WebBridge conectado");
    } catch {
      prompts.cancel("Asegúrate de tener la extensión de Kimi WebBridge activa en Brave.");
      return;
    }

    consola.info("Abriendo DeepSeek Chat...");
    const navResult = (await webbridgeCommand("navigate", {
      url: "https://chat.deepseek.com",
      newTab: true,
      group_title: "CAPI Session Capture",
    })) as { success: boolean };

    if (!navResult.success) {
      prompts.cancel("No se pudo abrir DeepSeek Chat.");
      return;
    }
    consola.success("DeepSeek Chat abierto");

    consola.info("Esperando cookies de DeepSeek...");
    let cookies: Record<string, string> = {};
    for (let i = 0; i < 8; i++) {
      cookies = await getDeepSeekCookies();
      if (Object.keys(cookies).length > 0) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    consola.success(`${Object.keys(cookies).length} cookies capturadas`);

    const thumbcacheEntry = Object.entries(cookies).find(([k]) => k.startsWith(".thumbcache"));
    const thumbcache = thumbcacheEntry ? `${thumbcacheEntry[0]}=${thumbcacheEntry[1]}` : "";
    const awsWafToken = cookies["aws-waf-token"];
    const dsSessionId = cookies["ds_session_id"];

    consola.info("Obteniendo userToken...");
    const userToken = await getUserToken();

    if (!userToken) {
      consola.fail("userToken no encontrado");
      prompts.cancel("Asegúrate de estar logueado en DeepSeek.");
      await webbridgeCommand("close_session", {});
      return;
    }
    consola.success("userToken listo");

    const authorization = userToken.startsWith("Bearer ") ? userToken : `Bearer ${userToken}`;

    consola.info("Enviando sesión al bridge...");
    const sent = await sendToBridge({
      authorization,
      cookies: {
        thumbcache,
        awsWafToken: awsWafToken ? `aws-waf-token=${awsWafToken}` : "",
        dsSessionId: dsSessionId ? `ds_session_id=${dsSessionId}` : "",
      },
    });

    if (sent) {
      consola.success("Sesión enviada al bridge");
      prompts.outro("✓ Sesión capturada correctamente");
    } else {
      prompts.cancel("No se pudo enviar la sesión al bridge.");
    }

    await webbridgeCommand("close_session", {});
  },
});
