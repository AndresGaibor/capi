import { chromium, type Browser, type Page } from "playwright";

const BRIDGE_URL = "http://localhost:3847/api/deepseek/session";
const DEEPSEEK_URL = "https://chat.deepseek.com";

interface DeepSeekCookies {
  thumbcache?: string;
  awsWafToken?: string;
  dsSessionId?: string;
}

async function getDeepSeekSession(): Promise<{
  authorization: string;
  cookies: DeepSeekCookies;
} | null> {
  const BRAVE_PROFILE = "/Users/andresgaibor/Library/Application Support/BraveSoftware/Brave-Browser/Default";
  const { existsSync, cpSync, rmSync, mkdirSync } = require("node:fs");
  const { join } = require("node:path");
  const { randomUUID } = require("node:crypto");

  let browser: Browser | null = null;

  try {
    const tempProfile = join("/tmp", `brave-playwright-${randomUUID()}`);

    mkdirSync(tempProfile, { recursive: true });

    function copyIfExists(src: string, dst: string): void {
      if (existsSync(src)) {
        mkdirSync(require("node:path").dirname(dst), { recursive: true });
        cpSync(src, dst, { force: true });
      }
    }

    copyIfExists(join(BRAVE_PROFILE, "Cookies"), join(tempProfile, "Cookies"));
    copyIfExists(join(BRAVE_PROFILE, "Cookies-wal"), join(tempProfile, "Cookies-wal"));
    copyIfExists(join(BRAVE_PROFILE, "Cookies-shm"), join(tempProfile, "Cookies-shm"));
    copyIfExists(join(BRAVE_PROFILE, "Local Storage"), join(tempProfile, "Local Storage"));
    copyIfExists(join(BRAVE_PROFILE, "Session Storage"), join(tempProfile, "Session Storage"));
    copyIfExists(join(BRAVE_PROFILE, "IndexedDB"), join(tempProfile, "IndexedDB"));
    copyIfExists(join(BRAVE_PROFILE, "Sessions"), join(tempProfile, "Sessions"));
    copyIfExists(join(BRAVE_PROFILE, "Preferences"), join(tempProfile, "Preferences"));

    browser = await chromium.launch({
      executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      storageState: undefined,
    });
    const page: Page = await context.newPage();

    await page.goto(DEEPSEEK_URL, { waitUntil: "networkidle", timeout: 30000 });

    const cookies = await context.cookies([DEEPSEEK_URL]);
    const cookieMap: DeepSeekCookies = {};

    for (const cookie of cookies) {
      if (cookie.name.startsWith(".thumbcache")) {
        cookieMap.thumbcache = `${cookie.name}=${cookie.value}`;
      }
      if (cookie.name === "aws-waf-token") {
        cookieMap.awsWafToken = `${cookie.name}=${cookie.value}`;
      }
      if (cookie.name === "ds_session_id") {
        cookieMap.dsSessionId = `${cookie.name}=${cookie.value}`;
      }
    }

    const userToken = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("userToken");
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          return typeof parsed === "string" ? parsed : (parsed?.value ?? null);
        } catch {
          return raw;
        }
      } catch {
        return null;
      }
    });

    await context.close();
    await browser.close();
    rmSync(tempProfile, { recursive: true, force: true });

    if (!userToken) {
      console.error("[playwright] userToken no encontrado en localStorage");
      return null;
    }

    let authorization = userToken;
    if (!userToken.startsWith("Bearer ")) {
      authorization = `Bearer ${userToken}`;
    }

    return {
      authorization,
      cookies: cookieMap,
    };
  } catch (error) {
    console.error("[playwright] Error:", error);
    if (browser) await browser.close().catch(() => {});
    return null;
  }
}

async function sendToBridge(session: {
  authorization: string;
  cookies: DeepSeekCookies;
}): Promise<boolean> {
  const bundle = {
    source: "deepseek-playwright",
    capturedAt: new Date().toISOString(),
    authorization: session.authorization,
    cookies: {
      thumbcache: session.cookies.thumbcache ?? "",
      awsWafToken: session.cookies.awsWafToken ?? "",
      dsSessionId: session.cookies.dsSessionId ?? "",
    },
  };

  try {
    const response = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    });

    if (response.ok) {
      const text = await response.text();
      console.log("[playwright] Sesión enviada al bridge:", text);
      return true;
    } else {
      console.error("[playwright] Bridge respondió:", response.status, await response.text());
      return false;
    }
  } catch (e) {
    console.error("[playwright] Error enviando al bridge:", (e as Error).message);
    return false;
  }
}

async function main() {
  console.log("[playwright] Capturando sesión de DeepSeek...");

  const session = await getDeepSeekSession();

  if (!session) {
    console.error("[playwright] No se pudo capturar la sesión");
    process.exit(1);
  }

  console.log("[playwright] Authorization:", session.authorization.slice(0, 30) + "...");
  console.log("[playwright] Cookies:", {
    thumbcache: session.cookies.thumbcache?.slice(0, 30) + "...",
    awsWafToken: session.cookies.awsWafToken?.slice(0, 30) + "...",
    dsSessionId: session.cookies.dsSessionId ? "presente" : "ausente",
  });

  const sent = await sendToBridge(session);
  if (sent) {
    console.log("[playwright] ✓ Sesión enviada correctamente");
  } else {
    console.error("[playwright] ✗ Error enviando sesión");
    process.exit(1);
  }
}

main();
