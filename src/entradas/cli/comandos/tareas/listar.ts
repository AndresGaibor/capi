import { defineCommand } from "citty";
import { listarTareas } from "../../soporte/tareas";

export const comandoTareasListar = defineCommand({
  meta: { name: "listar", description: "Listar tareas ChatGPT en segundo plano" },
  args: {},
  run: () => { process.stdout.write(`${JSON.stringify(listarTareas())}\n`); },
});
