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
import { comandoTareasSeguir } from "./comandos/tareas/seguir";
import { comandoTareasCancelar } from "./comandos/tareas/cancelar";
import { comandoTareasReanudar } from "./comandos/tareas/reanudar";
import { comandoTareasCompactar } from "./comandos/tareas/compactar";
import { comandoTareasLimpiar } from "./comandos/tareas/limpiar";
import { comandoTareasMetricas } from "./comandos/tareas/metricas";
import { comandoTareasLogs } from "./comandos/tareas/logs";
import { comandoDiagnosticoEjecucion } from "./comandos/diagnostico/ejecucion";
import { comandoDiagnosticoRed } from "./comandos/diagnostico/red";
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
    vision: defineCommand({
      meta: { name: "vision", description: "Analizar y comparar imágenes delegando a un modelo visual" },
      subCommands: { analizar: comandoVisionAnalizar, comparar: comandoVisionComparar },
    }),
    contexto: defineCommand({
      meta: { name: "contexto", description: "Empaquetar y explicar el contexto del proyecto" },
      subCommands: { empaquetar: comandoContextoEmpaquetar, explicar: comandoContextoExplicar },
    }),
    historial: defineCommand({
      meta: { name: "historial", description: "Auditar ejecuciones recientes del proyecto" },
      subCommands: { listar: comandoHistorialListar },
    }),
    estado: defineCommand({
      meta: { name: "estado", description: "Metricas, limpieza, exportacion e importacion del estado del proyecto" },
      subCommands: { metricas: comandoEstadoMetricas, limpiar: comandoEstadoLimpiar, exportar: comandoEstadoExportar, importar: comandoEstadoImportar },
    }),
    modelos: defineCommand({
      meta: { name: "modelos", description: "Listar modelos disponibles por proveedor" },
      subCommands: { listar: comandoModelosListar },
    }),
    proyecto: defineCommand({
      meta: { name: "proyecto", description: "Consultar y configurar el proyecto detectado" },
      subCommands: { actual: comandoProyectoActual, vincular: comandoProyectoVincular, desvincular: comandoProyectoDesvincular, configurar: comandoProyectoConfigurar, preferencias: comandoProyectoPreferencias },
    }),
    conversaciones: defineCommand({
      meta: { name: "conversaciones", description: "Gestionar conversaciones del proyecto" },
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
    sesion: defineCommand({
      meta: { name: "sesion", description: "Importar la sesion del navegador al proyecto" },
      subCommands: { importar: comandoSesionImportar },
    }),
    diagnostico: defineCommand({
      meta: { name: "diagnostico", description: "Diagnosticar pagina, proveedores y ejecuciones durables" },
      subCommands: { pagina: comandoDiagnosticoPagina, completo: comandoDiagnosticoCompleto, contratos: comandoDiagnosticoContratos, ejecucion: comandoDiagnosticoEjecucion, red: comandoDiagnosticoRed },
    }),
    servidor: defineCommand({
      meta: { name: "servidor", description: "Iniciar el bridge local para recibir sesiones" },
      subCommands: { iniciar: serveCommand },
    }),
    tareas: defineCommand({
      meta: { name: "tareas", description: "Listar, seguir y cancelar ejecuciones durables en segundo plano" },
      subCommands: { listar: comandoTareasListar, estado: comandoTareasEstado, seguir: comandoTareasSeguir, cancelar: comandoTareasCancelar, reanudar: comandoTareasReanudar, compactar: comandoTareasCompactar, limpiar: comandoTareasLimpiar, metricas: comandoTareasMetricas, logs: comandoTareasLogs },
    }),
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
  const { ok, unknowns, suggestions, available, command, subcommandSuggestions } = resultadoArgs;
  if (!ok) {
    mostrarErrorYHelp(command, unknowns, suggestions, available, subcommandSuggestions);
    process.exit(1);
  }
  void runMain(comandoPrincipal, { rawArgs: normalizarArgumentosCli(rawArgs) });
}
