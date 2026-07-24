#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { comandoChatEnviar } from "./comandos/chat/enviar";
import { comandoModelosListar } from "./comandos/modelos/listar";
import { comandoConversacionesListar } from "./comandos/conversaciones/listar";
import { comandoConversacionesMensajes } from "./comandos/conversaciones/mensajes";
import { comandoSesionImportar } from "./comandos/sesion/importar";
import { comandoDiagnosticoPagina } from "./comandos/diagnostico/pagina";
import { serveCommand } from "../../comandos/serve";

const principal = defineCommand({
  meta: { name: "capi", version: "2.0.0", description: "CLI modular para proveedores de chat" },
  subCommands: {
    chat: defineCommand({ meta: { name: "chat" }, subCommands: { enviar: comandoChatEnviar } }),
    modelos: defineCommand({ meta: { name: "modelos" }, subCommands: { listar: comandoModelosListar } }),
    conversaciones: defineCommand({ meta: { name: "conversaciones" }, subCommands: { listar: comandoConversacionesListar, mensajes: comandoConversacionesMensajes } }),
    sesion: defineCommand({ meta: { name: "sesion" }, subCommands: { importar: comandoSesionImportar } }),
    diagnostico: defineCommand({ meta: { name: "diagnostico" }, subCommands: { pagina: comandoDiagnosticoPagina } }),
    servidor: defineCommand({ meta: { name: "servidor" }, subCommands: { iniciar: serveCommand } }),
  },
});
runMain(principal);
