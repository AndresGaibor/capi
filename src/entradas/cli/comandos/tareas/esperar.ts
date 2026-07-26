import { defineCommand } from "citty";
import { CAPI_CONFIG } from "../../../../configuracion/ConstantesCapi";
import { crearSobreError, crearSobreExito, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";
import { terminales, obtenerEjecucion } from "./durable";

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const comandoTareasEsperar = defineCommand({
  meta: {
    name: "esperar",
    description: "Bloquear hasta que una tarea durable termine (completada, cancelada o fallida)",
  },
  args: {
    id: { type: "positional" as const, required: true },
    timeout: {
      type: "string" as const,
      default: String(CAPI_CONFIG.TIMEOUTS_MS.ESPERA_TAREA_POR_DEFECTO_MS),
      description: "Tiempo maximo de espera en ms (defecto 1800000 = 30 min)",
    },
    pollMs: {
      type: "string" as const,
      default: "5000",
      description: "Intervalo de sondeo en ms",
    },
    output: { type: "string" as const, alias: "o", default: "json" },
  },
  async run({ args }) {
    const id = String(args.id);
    const limiteMs = Date.now() + Number(args.timeout);
    const pollMs = Math.max(500, Number(args.pollMs));
    const formato = String(args.output) as FormatoSalida;
    let ultimoEstado = "";
    let ultimaRespuesta = 0;
    let ultimoSondeo = 0;
    while (true) {
      const ejecucion = obtenerEjecucion(id);
      if (!ejecucion) {
        const sobre = crearSobreError(
          "tasks.wait",
          Object.assign(new Error(`Ejecucion no encontrada: ${id}`), { codigo: "EJECUCION_NO_ENCONTRADA" }),
          {
            suggestions: [
              { command: `capi tareas listar`, reason: "listar las tareas durables disponibles" },
              { command: `capi tareas estado ${id}`, reason: "ver el estado si existe con otro id" },
            ],
          },
        );
        process.stdout.write(serializarSalida(sobre, formato) + "\n");
        process.exitCode = 1;
        return;
      }
      if (ejecucion.estado !== ultimoEstado || ejecucion.respuestaParcial.length !== ultimaRespuesta || ejecucion.ultimoSondeoEn !== ultimoSondeo) {
        process.stderr.write(`[capi] ${id} estado=${ejecucion.estado} respuesta=${ejecucion.respuestaParcial.length}ch ultimoProgreso=${new Date(ejecucion.ultimoProgresoEn).toISOString()}\n`);
        ultimoEstado = ejecucion.estado;
        ultimaRespuesta = ejecucion.respuestaParcial.length;
        ultimoSondeo = ejecucion.ultimoSondeoEn ?? 0;
      }
      if (terminales.has(ejecucion.estado)) {
        const ok = ejecucion.estado === "completada";
        const data = {
          taskId: id,
          estado: ejecucion.estado,
          ok,
          respuestaCaracteres: ejecucion.respuestaParcial.length,
          pensamientoCaracteres: ejecucion.pensamientoParcial.length,
          conversacionId: ejecucion.conversacionId,
          modelo: ejecucion.modelo,
          duracionMs: (ejecucion.completadaEn ?? Date.now()) - ejecucion.creadaEn,
          error: ejecucion.errorDetalle,
          followUp: ok
            ? [`capi tareas logs ${id}`, `capi conversaciones mensajes ${ejecucion.conversacionId} -p ${ejecucion.proveedor}`]
            : [`capi tareas logs ${id}`, ejecucion.errorCodigo === "TIMEOUT_PROVEEDOR" ? "capi chat -p deepseek -m default \"tu mensaje\"" : `capi tareas reanudar ${id}`],
        };
        const sobre = crearSobreExito("tasks.wait", data, {
          suggestions: data.followUp.map((command) => ({ command, reason: "siguiente paso tras esperar" })),
        });
        process.stdout.write(serializarSalida(sobre, formato) + "\n");
        process.exitCode = ok ? 0 : ejecucion.estado === "cancelada" ? 130 : 1;
        return;
      }
      if (Date.now() >= limiteMs) {
        const sobre = crearSobreError(
          "tasks.wait",
          Object.assign(
            new Error(`La tarea ${id} no terminalizo en ${args.timeout}ms (estado actual: ${ejecucion.estado})`),
            { codigo: "TIMEOUT_ESPERA" },
          ),
          {
            suggestions: [
              { command: `capi tareas esperar ${id} --timeout 7200000`, reason: "reanudar la espera con un limite mayor" },
              { command: `capi tareas estado ${id}`, reason: "consultar el estado actual de la tarea" },
              { command: `capi tareas logs ${id}`, reason: "ver los logs JSONL generados hasta ahora" },
            ],
          },
        );
        process.stdout.write(serializarSalida(sobre, formato) + "\n");
        process.exitCode = 124;
        return;
      }
      await dormir(pollMs);
    }
  },
});