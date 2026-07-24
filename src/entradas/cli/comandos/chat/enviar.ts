import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { RenderizadorStreaming } from "../../../../plataforma/consola/RenderizadorStreaming";

export const comandoChatEnviar = defineCommand({
  meta: { name: "enviar", description: "Enviar un mensaje a un proveedor" },
  args: {
    prompt: { type: "positional", required: true, description: "Prompt" },
    proveedor: { type: "string", alias: "p", default: "deepseek" },
    conversacion: { type: "string", alias: "c" },
    modelo: { type: "string", alias: "m" },
    razonamiento: { type: "boolean" },
    busqueda: { type: "boolean" },
    archivo: { type: "string", alias: "f" },
  },
  async run({ args }) {
    const app = crearAplicacion();
    const renderizador = new RenderizadorStreaming();
    try {
      const eventos = app.enviarMensaje.ejecutar(String(args.proveedor), {
        conversacionId: args.conversacion ? String(args.conversacion) : undefined,
        prompt: String(args.prompt),
        modelo: args.modelo ? String(args.modelo) : undefined,
        archivos: args.archivo ? [String(args.archivo)] : undefined,
        opciones: { razonamiento: Boolean(args.razonamiento), busquedaWeb: Boolean(args.busqueda) },
      });
      for await (const evento of eventos) renderizador.renderizar(evento);
    } catch (error) {
      consola.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  },
});
