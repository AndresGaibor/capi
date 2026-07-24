import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { ejecutarComando } from "../../soporte/ejecutarComando";

export function crearComandoEstado(nombre: string, campo: "favorita" | "archivada" | "principal", valor = true) {
  return defineCommand({
    meta: { name: nombre, description: `${nombre} una conversación del proyecto` },
    args: { id: { type: "positional", required: true }, proveedor: { type: "string", alias: "p", default: "qwen" } },
    run: ({ args }) => ejecutarComando(() => {
      const app = crearAplicacion();
      const proyecto = app.gestorContexto.proyectoActual();
      app.repositorioContexto.actualizarEstado(String(args.id), String(args.proveedor), { [campo]: valor }, proyecto.id);
      consola.success(`Conversación ${String(args.id)} actualizada`);
    }, "capi conversaciones proyecto"),
  });
}
