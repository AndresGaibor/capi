#!/usr/bin/env bun

const WEBBRIDGE_URL = "http://127.0.0.1:10086";
const BRIDGE_URL = "http://localhost:3847/api/deepseek/session";
const DEEPSEEK_URL = "https://chat.deepseek.com";
const SESSION_NAME = "capi-deepseek-session";

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
  console.log("[kimi-webbridge] Bridge no disponible, intentando iniciar...");
  const { spawn } = require("node:child_process");
  const { join } = require("node:path");
  const bunBin = "/Users/andresgaibor/.bun/bin/bun";
  const child = spawn(bunBin, ["run", join(process.cwd(), "src/cli.ts"), "serve"], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });
  child.unref();
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
    const json = await res.json();
    console.log("[kimi-webbridge] Bridge response:", json);
    return res.ok;
  } catch (e) {
    console.error("[kimi-webbridge] Error sending to bridge:", e);
    return false;
  }
}

async function waitAndGetCookies(retries = 5): Promise<Record<string, string>> {
  for (let i = 0; i < retries; i++) {
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

    if (Object.keys(deepseekCookies).length > 0) {
      console.log(`[kimi-webbridge] Cookies de DeepSeek encontradas en intento ${i + 1}:`, Object.keys(deepseekCookies));
      return deepseekCookies;
    }

    console.log(`[kimi-webbridge] Intento ${i + 1}/${retries}: cookies de DeepSeek no encontradas aun, esperando...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return {};
}

async function main() {
  console.log("[kimi-webbridge] Iniciando captura de sesión de DeepSeek...");

  await ensureBridge();

  console.log("[kimi-webbridge] Abriendo DeepSeek Chat...");
  const navResult = (await webbridgeCommand("navigate", {
    url: DEEPSEEK_URL,
    newTab: true,
    group_title: "CAPI DeepSeek Session",
  })) as { success: boolean; tabId: string; url: string };

  if (!navResult.success) {
    console.error("[kimi-webbridge] Error navegando a DeepSeek");
    process.exit(1);
  }
  console.log("[kimi-webbridge] Navegando, esperando carga de cookies...");

  const cookieMap = await waitAndGetCookies(8);

  const thumbcache = Object.entries(cookieMap)
    .find(([k]) => k.startsWith(".thumbcache"))
    ?.map(([, v]) => `${Object.entries(cookieMap).find(([k]) => k.startsWith(".thumbcache"))![0]}=${v}`)?.[0] ?? "";

  const awsWafToken = cookieMap["aws-waf-token"];
  const dsSessionId = cookieMap["ds_session_id"];

  console.log("[kimi-webbridge] Cookies DeepSeek:", {
    thumbcache: thumbcache ? "presente" : "ausente",
    awsWafToken: awsWafToken ? "presente" : "ausente",
    dsSessionId: dsSessionId ? "presente" : "ausente",
  });

  console.log("[kimi-webbridge] Obteniendo userToken de localStorage...");
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

  const userToken = evalResult.value;
  if (!userToken) {
    console.error("[kimi-webbridge] userToken no encontrado. Asegúrate de estar logueado en DeepSeek.");
    await webbridgeCommand("close_session", {});
    process.exit(1);
  }

  let authorization = userToken.startsWith("Bearer ") ? userToken : `Bearer ${userToken}`;

  console.log("[kimi-webbridge] Enviando sesión al bridge...");
  const sent = await sendToBridge({
    authorization,
    cookies: {
      thumbcache,
      awsWafToken: awsWafToken ? `aws-waf-token=${awsWafToken}` : "",
      dsSessionId: dsSessionId ? `ds_session_id=${dsSessionId}` : "",
    },
  });

  if (sent) {
    console.log("[kimi-webbridge] ✓ Sesión enviada correctamente");
  } else {
    console.error("[kimi-webbridge] ✗ Error enviando sesión al bridge");
    process.exit(1);
  }

  await webbridgeCommand("close_session", {});
}

main();
