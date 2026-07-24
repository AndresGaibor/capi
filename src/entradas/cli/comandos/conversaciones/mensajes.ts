import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
export const comandoConversacionesMensajes = defineCommand({
  meta: { name: "mensajes", description: "Mostrar mensajes de una conversación" },
  args: { id: { type: "positional", required: true }, proveedor: { type: "string", alias: "p", default: "deepseek" } },
  async run({ args }) {
    try {
      const c = await crearAplicacion().obtenerMensajes.ejecutar(String(args.proveedor), String(args.id));
      if (!c) return consola.warn("Conversación no encontrada");
      for (const m of c.mensajes) consola.log(`
${m.rol === "usuario" ? "👤" : "🤖"} ${m.contenido}${m.pensamiento ? `
💭 ${m.pensamiento}` : ""}`);
    } catch (error) { consola.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  },
});
