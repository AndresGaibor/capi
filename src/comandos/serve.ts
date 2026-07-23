import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { saveSession, parseBundle } from "../auth/deepseek.ts";
import type { DeepSeekSession } from "../auth/deepseek.ts";
import consola from "consola";

const BRIDGE_PORT = 3847;

const clientesSSE = new Map<string, ReadableStreamDefaultController>();

function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn("lsof", ["-ti", `:${port}`], { stdio: "pipe" });
    let pid = "";
    child.stdout?.on("data", (d) => { pid += d.toString(); });
    child.on("close", (code) => {
      if (pid.trim()) {
        spawn("kill", ["-9", pid.trim()], { stdio: "ignore" }).on("close", () => resolve());
      } else {
        resolve();
      }
    });
    child.on("error", () => resolve());
  });
}

function enviarEventoSSE(sessionId: string, evento: string, data: unknown): void {
  const controller = clientesSSE.get(sessionId);
  if (!controller) return;
  try {
    const sseData = `event: ${evento}\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(sseData));
  } catch {
    clientesSSE.delete(sessionId);
  }
}

export const serveCommand = defineCommand({
  meta: {
    name: "serve",
    description: "Iniciar bridge local para recibir sesiones",
  },
  async run() {
    await killPort(BRIDGE_PORT);
    await new Promise((r) => setTimeout(r, 500));

    const server = Bun.serve({
      port: BRIDGE_PORT,
      hostname: "0.0.0.0",
      idleTimeout: 0,

      async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/api/deepseek/session" && req.method === "POST") {
          try {
            const bundle = await req.json();
            const session = parseBundle(bundle as any) as DeepSeekSession;
            saveSession(session);
            console.log("[bridge] Sesión guardada:", {
              auth: session.authorization?.slice(0, 12) + "...",
              thumbcache: session.thumbcache?.slice(0, 15) + "...",
              awsWaf: session.awsWafToken?.slice(0, 15) + "...",
              dsSession: session.dsSessionId ? "sí" : "no",
            });
            return new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (e) {
            console.error("[bridge] Error parseando body:", e);
            return new Response(JSON.stringify({ ok: false, error: String(e) }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        if (url.pathname === "/health") {
          return new Response(JSON.stringify({ status: "ok" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.pathname === "/api/deepseek/stream" && req.method === "GET") {
          const sessionId = url.searchParams.get("session") ?? "default";
          console.log(`[bridge] Cliente SSE conectado: ${sessionId}`);

          const stream = new ReadableStream({
            start(controller) {
              clientesSSE.set(sessionId, controller);
              const sseBienvenida = `event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseBienvenida));
            },
            cancel() {
              clientesSSE.delete(sessionId);
              console.log(`[bridge] Cliente SSE desconectado: ${sessionId}`);
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        }

        if (url.pathname === "/api/deepseek/stream" && req.method === "POST") {
          try {
            const body = await req.json() as { session?: string; type?: string; data?: unknown };
            const sessionId = body?.session ?? "default";
            enviarEventoSSE(sessionId, body?.type ?? "message", body?.data);
            return new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (e) {
            return new Response(JSON.stringify({ ok: false, error: String(e) }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    consola.success(`Bridge escuchando en http://localhost:${server.port}`);
    consola.info("Esperando sesiones del userscript de DeepSeek...");
    consola.warn("Presiona Ctrl+C para detener");
  },
});
