import { defineCommand } from "citty";
import { obtenerTarea } from "../../soporte/tareas";

export const comandoTareasEstado = defineCommand({
  meta: { name: "estado", description: "Consultar una tarea ChatGPT" },
  args: { id: { type: "positional" as const, required: true } },
  run: ({ args }) => {
    const tarea = obtenerTarea(String(args.id));
    if (!tarea) { process.stderr.write(`Tarea no encontrada: ${String(args.id)}\n`); process.exitCode = 1; return; }
    process.stdout.write(`${JSON.stringify(tarea)}\n`);
  },
});
