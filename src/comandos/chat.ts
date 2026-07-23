#!/usr/bin/env bun

import { defineCommand } from "citty";
import * as prompts from "@clack/prompts";
import consola from "consola";
import { obtenerServicioChatDeepSeek } from "../di/deepseek.ts";
import { normalizarRespuesta, truncarTexto } from "../dominio/deepseek/servicios/NormalizarRespuestaDeepSeek.ts";

function formatearFecha(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}m`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 30) return `Hace ${days}d`;
  return new Date(timestamp).toLocaleDateString("es-ES");
}

export const chatCommand = defineCommand({
  meta: { name: "chat", description: "Gestión de conversaciones de DeepSeek" },
  subCommands: {
    list: defineCommand({
      meta: { name: "list", description: "Listar todas las conversaciones" },
      args: {
        limit: { type: "string", alias: "n", description: "Límite de conversaciones a mostrar" },
        query: { type: "string", alias: "q", description: "Filtrar por título" },
      },
      async run({ args }) {
        prompts.intro("📋 Listando conversaciones...");

        const disponible = await fetch("http://127.0.0.1:10086", {
          method: "HEAD",
          signal: AbortSignal.timeout(3000),
        })
          .then(() => true)
          .catch(() => false);

        if (!disponible) {
          prompts.cancel("Kimi WebBridge no está disponible. Inicia el servidor Kimi WebBridge.");
          return;
        }

        const servicio = obtenerServicioChatDeepSeek();
        let conversaciones = await servicio.iniciarSesionYListar();

        prompts.outro("");

        if (conversaciones.length === 0) {
          consola.info("No hay conversaciones.");
          return;
        }

        if (args.query) {
          const q = args.query.toLowerCase();
          conversaciones = conversaciones.filter((c) => c.titulo.toLowerCase().includes(q));
        }

        const limit = args.limit ? parseInt(args.limit, 10) : undefined;
        if (limit && !isNaN(limit) && limit > 0) {
          conversaciones = conversaciones.slice(0, limit);
        }

        const formatted = conversaciones.map((c) => ({
          id: c.id,
          title: c.titulo,
          pinned: c.fijada ? "📌" : "  ",
          model: c.tipoModelo || "-",
          time: formatearFecha(c.actualizadaEn),
        }));

        consola.log(`\n${formatted.length} conversaciones:\n`);
        for (const c of formatted) {
          consola.log(`  ${c.pinned} [${c.time}] ${c.title}`);
          consola.log(`       ID: ${c.id}\n`);
        }
      },
    }),

    messages: defineCommand({
      meta: { name: "messages", description: "Extraer mensajes de una conversación" },
      args: {
        id: { type: "positional", required: true, description: "ID de la conversación" },
      },
      async run({ args }) {
        prompts.intro(`💬 Mensajes de conversación...`);

        const disponible = await fetch("http://127.0.0.1:10086", {
          method: "HEAD",
          signal: AbortSignal.timeout(3000),
        })
          .then(() => true)
          .catch(() => false);

        if (!disponible) {
          prompts.cancel("Kimi WebBridge no está disponible.");
          return;
        }

        const servicio = obtenerServicioChatDeepSeek();
        const conversacion = await servicio.obtenerMensajesChat(args.id);

        prompts.outro("");

        if (!conversacion || conversacion.mensajes.length === 0) {
          consola.warn("No se encontraron mensajes.");
          return;
        }

        consola.log(`\n📝 ${conversacion.titulo} (${conversacion.mensajes.length} mensajes)\n`);

        for (const msg of conversacion.mensajes) {
          if (msg.rol === "usuario") {
            const peticion = msg.fragmentos.find((f) => f.type === "REQUEST")?.content ||
              msg.fragmentos.find((f) => f.type === "RESPONSE")?.content || "";
            consola.log(`\n👤 Tú:\n  ${peticion}`);
          } else {
            const pensamiento = msg.fragmentos.find((f) => f.type === "THINK")?.content || "";
            const respuesta = msg.fragmentos.find((f) => f.type === "RESPONSE")?.content || "";

            if (pensamiento) {
              const { texto, truncado } = truncarTexto(pensamiento, 400);
              consola.log(`\n💭 DeepThink:\n  ${texto.replace(/\n/g, "\n  ")}${truncado ? "\n  [...]" : ""}`);
            }

            if (respuesta) {
              consola.log(`\n🤖 DeepSeek:\n  ${normalizarRespuesta(respuesta)}`);
            }
          }
        }

        consola.log("");
      },
    }),

    send: defineCommand({
      meta: { name: "send", description: "Enviar un mensaje a una conversación (streaming en tiempo real)" },
      args: {
        id: { type: "positional", required: true, description: "ID de conversación o 'new' para chat nuevo" },
        prompt: { type: "positional", required: true, description: "Prompt a enviar" },
        model: { type: "string", description: "Modelo (default, expert, vision)" },
        deepthink: { type: "boolean", description: "Activar DeepThink" },
        search: { type: "boolean", description: "Activar Web Search" },
        file: { type: "string", alias: "f", description: "Ruta de archivo adjunto a enviar" },
      },
      async run({ args }) {
        prompts.intro("📤 Enviando mensaje...");

        const disponible = await fetch("http://127.0.0.1:10086", {
          method: "HEAD",
          signal: AbortSignal.timeout(3000),
        })
          .then(() => true)
          .catch(() => false);

        if (!disponible) {
          prompts.cancel("Kimi WebBridge no está disponible.");
          return;
        }

        const servicio = obtenerServicioChatDeepSeek();

        const opciones = {
          modelo: (args.model as "default" | "expert" | "vision") || undefined,
          deepThink: args.deepthink,
          search: args.search,
          archivos: args.file ? [args.file] : undefined,
        };

        prompts.outro("");

        let enModoThink = false;

        try {
          for await (const evento of servicio.enviarPromptStreaming(args.id, args.prompt, opciones)) {
            switch (evento.type) {
              case "start_response":
                if (evento.content) {
                  consola.info(`  ${evento.content}`);
                }
                break;
              case "think":
                if (!enModoThink) {
                  process.stdout.write("\n\x1b[90m🤔 Pensando...\n");
                  enModoThink = true;
                }
                if (evento.content) {
                  process.stdout.write(`\x1b[90m${evento.content}\x1b[0m`);
                }
                break;
              case "response":
                if (enModoThink) {
                  process.stdout.write("\n\n\x1b[32m💡 Respuesta:\x1b[0m\n");
                  enModoThink = false;
                }
                if (evento.content) {
                  process.stdout.write(evento.content);
                }
                break;
              case "done":
                consola.log("\n");
                break;
              case "error":
                consola.error(`  ${evento.content}`);
                break;
            }
          }
        } catch (e) {
          consola.error(`Error: ${e}`);
        }
        consola.log("\n[terminado]");

        consola.log("");
      },
    }),

    model: defineCommand({
      meta: { name: "model", description: "Consultar el modelo/tipo activo de una conversación" },
      args: {
        id: { type: "positional", required: true, description: "ID de la conversación" },
      },
      async run({ args }) {
        prompts.intro("🔍 Consultando modelo del chat...");

        const disponible = await fetch("http://127.0.0.1:10086", {
          method: "HEAD",
          signal: AbortSignal.timeout(3000),
        })
          .then(() => true)
          .catch(() => false);

        if (!disponible) {
          prompts.cancel("Kimi WebBridge no está disponible.");
          return;
        }

        const servicio = obtenerServicioChatDeepSeek();
        const urlChat = `https://chat.deepseek.com/a/chat/s/${args.id}`;
        
        await servicio.iniciarSesion.ejecutar();
        const tabActual = await fetch("http://127.0.0.1:10086/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "evaluate", args: { code: "window.location.href" }, session: "capi-capture" }),
        }).then((r) => r.json() as Promise<{ ok: boolean; data: { value?: string } }>).catch(() => null);

        if (!tabActual?.data?.value?.includes(args.id)) {
          consola.info("Navegando a la conversación para inspeccionar el header...");
          await fetch("http://127.0.0.1:10086/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "navigate", args: { url: urlChat, newTab: true }, session: "capi-capture" }),
          });
          await new Promise((r) => setTimeout(r, 4000));
        }

        const modelo = await servicio.obtenerModeloChatActual();
        prompts.outro("");

        if (modelo) {
          consola.success(`Modelo/Modo activo en conversación [${args.id}]:`);
          consola.log(`\n  🤖 Modelo: ${modelo}\n`);
          consola.info("Nota: En conversaciones existentes no se puede cambiar el modelo.");
        } else {
          consola.warn("No se pudo detectar la etiqueta del modelo en el header.");
        }
      },
    }),
  },
});

