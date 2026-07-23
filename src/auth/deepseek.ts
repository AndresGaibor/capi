import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(process.env.HOME ?? ".", ".cache", "capi");
const CACHE_FILE = join(CACHE_DIR, "deepseek-session.json");
export const BRIDGE_PORT = 3847;

export interface DeepSeekSession {
  authorization: string;
  thumbcache: string;
  awsWafToken: string;
  dsSessionId?: string;
  capturedAt: string;
  expiresAt?: number;
}

export interface DeepSeekBundle {
  source: string;
  capturedAt: string;
  authorization: string;
  cookies: {
    thumbcache: string;
    awsWafToken: string;
    dsSessionId?: string;
  };
}

function ensureCacheDir(): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}

export function saveSession(session: DeepSeekSession): void {
  ensureCacheDir();
  writeFileSync(CACHE_FILE, JSON.stringify(session, null, 2), "utf-8");
}

export function loadSession(): DeepSeekSession | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as DeepSeekSession;
  } catch {
    return null;
  }
}

export function saveDsSessionId(dsSessionId: string): void {
  const session = loadSession();
  const updated: DeepSeekSession = {
    authorization: session?.authorization ?? "",
    thumbcache: session?.thumbcache ?? "",
    awsWafToken: session?.awsWafToken ?? "",
    dsSessionId,
    capturedAt: session?.capturedAt ?? new Date().toISOString(),
    expiresAt: session?.expiresAt,
  };
  saveSession(updated);
}

export function isSessionExpired(session: DeepSeekSession | null): boolean {
  if (!session) return true;
  if (!session.authorization || !session.thumbcache || !session.awsWafToken) return true;
  if (session.expiresAt && Date.now() > session.expiresAt) return true;
  return false;
}

export function parseBundle(bundle: DeepSeekBundle): DeepSeekSession {
  const existing = loadSession();
  return {
    authorization: bundle.authorization ?? existing?.authorization ?? "",
    thumbcache: bundle.cookies?.thumbcache ?? existing?.thumbcache ?? "",
    awsWafToken: bundle.cookies?.awsWafToken ?? existing?.awsWafToken ?? "",
    dsSessionId: bundle.cookies?.dsSessionId ?? existing?.dsSessionId,
    capturedAt: bundle.capturedAt ?? new Date().toISOString(),
  };
}

export function getSessionStatus(): {
  hasSession: boolean;
  hasAuth: boolean;
  hasThumbcache: boolean;
  hasAwsWaf: boolean;
  hasDsSessionId: boolean;
  capturedAt?: string;
  isExpired: boolean;
} {
  const session = loadSession();
  if (!session) {
    return {
      hasSession: false,
      hasAuth: false,
      hasThumbcache: false,
      hasAwsWaf: false,
      hasDsSessionId: false,
      isExpired: true,
    };
  }

  return {
    hasSession: true,
    hasAuth: Boolean(session.authorization),
    hasThumbcache: Boolean(session.thumbcache),
    hasAwsWaf: Boolean(session.awsWafToken),
    hasDsSessionId: Boolean(session.dsSessionId),
    capturedAt: session.capturedAt,
    isExpired: isSessionExpired(session),
  };
}

