#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { argumentosChat, comandoChatEnviar, ejecutarChat } from "./comandos/chat/enviar";
import { comandoModelosListar } from "./comandos/modelos/listar";
import { comandoConversacionesListar } from "./comandos/conversaciones/listar";
import { comandoConversacionesMensajes } from "./comandos/conversaciones/mensajes";
import { comandoConversacionesProyecto } from "./comandos/conversaciones/proyecto";
import { comandoConversacionesFavoritas } from "./comandos/conversaciones/favoritas";
import { crearComandoEstado } from "./comandos/conversaciones/estado";
import { comandoProyectoActual } from "./comandos/proyecto/actual";
import { comandoProyectoVincular } from "./comandos/proyecto/vincular";
import { comandoProyectoDesvincular } from "./comandos/proyecto/desvincular";
import { comandoProyectoConfigurar, comandoProyectoPreferencias } from "./comandos/proyecto/configurar";
import { comandoSesionImportar } from "./comandos/sesion/importar";
import { comandoDiagnosticoPagina } from "./comandos/diagnostico/pagina";
import { comandoDiagnosticoCompleto } from "./comandos/diagnostico/completo";
import { comandoContextoEmpaquetar } from "./comandos/contexto/empaquetar";
import { comandoContextoExplicar } from "./comandos/contexto/explicar";
import { comandoHistorialListar } from "./comandos/historial/listar";
import { comandoDiagnosticoContratos } from "./comandos/diagnostico/contratos";
import { serveCommand } from "../../comandos/serve";
import { comandoDiscover } from "./comandos/agente/discover";
import { comandoSchema } from "./comandos/agente/schema";
import { comandoDoctor } from "./comandos/agente/doctor";
import { comandoMcp } from "./comandos/agente/mcp";
import { comandoEstadoMetricas } from "./comandos/estado/metricas";
import { comandoEstadoLimpiar } from "./comandos/estado/limpiar";
import { comandoEstadoExportar } from "./comandos/estado/exportar";
import { comandoEstadoImportar } from "./comandos/estado/importar";

const comandoChat = defineCommand({
  meta: { name: "chat", description: "Conversar usando el contexto del proyecto actual" },
  subCommands: { enviar: comandoChatEnviar },
});

export const comandoPrincipal = defineCommand({
  meta: { name: "capi", version: "2.5.0", description: "CLI de chat con contexto aislado por proyecto" },
  subCommands: {
    discover: comandoDiscover,
    schema: comandoSchema,
    doctor: comandoDoctor,
    mcp: comandoMcp,
    chat: comandoChat,
    contexto: defineCommand({ meta: { name: "contexto" }, subCommands: { empaquetar: comandoContextoEmpaquetar, explicar: comandoContextoExplicar } }),
    historial: defineCommand({ meta: { name: "historial" }, subCommands: { listar: comandoHistorialListar } }),
    estado: defineCommand({ meta: { name: "estado" }, subCommands: { metricas: comandoEstadoMetricas, limpiar: comandoEstadoLimpiar, exportar: comandoEstadoExportar, importar: comandoEstadoImportar } }),
    modelos: defineCommand({ meta: { name: "modelos" }, subCommands: { listar: comandoModelosListar } }),
    proyecto: defineCommand({ meta: { name: "proyecto" }, subCommands: { actual: comandoProyectoActual, vincular: comandoProyectoVincular, desvincular: comandoProyectoDesvincular, configurar: comandoProyectoConfigurar, preferencias: comandoProyectoPreferencias } }),
    conversaciones: defineCommand({
      meta: { name: "conversaciones" },
      subCommands: {
        listar: comandoConversacionesListar,
        mensajes: comandoConversacionesMensajes,
        proyecto: comandoConversacionesProyecto,
        favoritas: comandoConversacionesFavoritas,
        fijar: crearComandoEstado("fijar", "principal"),
        archivar: crearComandoEstado("archivar", "archivada"),
        desarchivar: crearComandoEstado("desarchivar", "archivada", false),
        favorita: crearComandoEstado("favorita", "favorita"),
        quitarFavorita: crearComandoEstado("quitar-favorita", "favorita", false),
        usar: crearComandoEstado("usar", "principal"),
      },
    }),
    sesion: defineCommand({ meta: { name: "sesion" }, subCommands: { importar: comandoSesionImportar } }),
    diagnostico: defineCommand({ meta: { name: "diagnostico" }, subCommands: { pagina: comandoDiagnosticoPagina, completo: comandoDiagnosticoCompleto, contratos: comandoDiagnosticoContratos } }),
    servidor: defineCommand({ meta: { name: "servidor" }, subCommands: { iniciar: serveCommand } }),
  },
});
export function normalizarArgumentosCli(argumentos: string[]): string[] {
  const normalizados = [...argumentos];
  if (normalizados[0] === "chat" && normalizados[1] !== "enviar" && normalizados[1] !== "--help" && normalizados[1] !== "-h") {
    normalizados.splice(1, 0, "enviar");
  }
  return normalizados;
}
export function ejecutarCli(): void { void runMain(comandoPrincipal, { rawArgs: normalizarArgumentosCli(process.argv.slice(2)) }); }
