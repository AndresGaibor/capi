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
import { comandoVisionAnalizar } from "./comandos/vision/analizar";
import { comandoVisionComparar } from "./comandos/vision/comparar";
import { comandoTareasListar } from "./comandos/tareas/listar";
import { comandoTareasEstado } from "./comandos/tareas/estado";
import { validarArgumentosDesconocidos, mostrarErrorYHelp } from "./soporte/validar-args";

const comandoChat = defineCommand({
  meta: { name: "chat", description: "Conversar usando el contexto del proyecto actual" },
  subCommands: { enviar: comandoChatEnviar },
});

export const comandoPrincipal = defineCommand({
  meta: { name: "capi", version: "2.6.0", description: "CLI de chat con contexto aislado por proyecto" },
  subCommands: {
    discover: comandoDiscover,
    schema: comandoSchema,
    doctor: comandoDoctor,
    mcp: comandoMcp,
    chat: comandoChat,
    vision: defineCommand({ meta: { name: "vision" }, subCommands: { analizar: comandoVisionAnalizar, comparar: comandoVisionComparar } }),
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
    tareas: defineCommand({ meta: { name: "tareas" }, subCommands: { listar: comandoTareasListar, estado: comandoTareasEstado } }),
  },
});
export function normalizarArgumentosCli(argumentos: string[]): string[] {
  const normalizados = [...argumentos];
  if (normalizados[0] === "chat") {
    if (normalizados[1] !== "enviar") {
      normalizados.splice(1, 0, "enviar");
    }
  }
  return normalizados;
}

export function ejecutarCli(): void {
  const rawArgs = process.argv.slice(2);
  const resultadoArgs = validarArgumentosDesconocidos(rawArgs, comandoPrincipal);
  const { ok, unknowns, suggestions, available, command } = resultadoArgs;
  if (!ok) {
    mostrarErrorYHelp(command, unknowns, suggestions, available);
    process.exit(1);
  }
  void runMain(comandoPrincipal, { rawArgs: normalizarArgumentosCli(rawArgs) });
}
