import { defineCommand } from "citty";
import { listarEventos, obtenerEjecucion, terminales } from "./durable";

const POLL_INTERVAL_MS = 500;

export const comandoTareasSeguir = defineCommand({
  meta: { name: "seguir", description: "Reproducir y seguir el diario durable de una ejecución" },
  args: {
    id: { type: "positional" as const, required: true, description: "ID de la ejecución" },
    desde: { type: "string" as const, default: "0", description: "Secuencia desde la cual listar" },
    esperar: { type: "boolean" as const, default: false, description: "Mantener abierto hasta que la tarea termine" },
    follow: { type: "boolean" as const, default: false, description: "Alias de --esperar; mantener abierto hasta terminal" },
  },
  async run({ args }) {
    const id = String(args.id);
    const modoEspera = Boolean(args.esperar || args.follow);
    let sec = Number(args.desde || 0);
    do {
      const eventos = listarEventos(id, sec);
      for (const e of eventos) {
        process.stdout.write(JSON.stringify(e) + "\n");
        sec = e.secuencia;
      }
      const actual = obtenerEjecucion(id);
      if (!actual) {
        process.stderr.write(`Ejecución no encontrada: ${id}\n`);
        process.exitCode = 1;
        return;
      }
      if (!modoEspera || terminales.has(actual.estado)) return;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    } while (true);
  },
});
