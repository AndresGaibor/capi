import { writeFileSync, readFileSync, existsSync } from "node:fs";
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
    const { mkdirSync } = require("node:fs");
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
  };
  saveSession(updated);
}

export function isSessionExpired(session: DeepSeekSession | null): boolean {
  if (!session) return true;
  if (!session.authorization || !session.thumbcache || !session.awsWafToken) return true;
  return false;
}

export function parseBundle(bundle: DeepSeekBundle): DeepSeekSession {
  return {
    authorization: bundle.authorization ?? "",
    thumbcache: bundle.cookies?.thumbcache ?? "",
    awsWafToken: bundle.cookies?.awsWafToken ?? "",
    dsSessionId: bundle.cookies?.dsSessionId ?? loadSession()?.dsSessionId,
    capturedAt: bundle.capturedAt ?? new Date().toISOString(),
  };
}
