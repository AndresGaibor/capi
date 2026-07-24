import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { ejecutarComando } from "../../soporte/ejecutarComando";

export const comandoDiagnosticoCompleto = defineCommand({
  meta: { name: "completo", description: "Diagnosticar proyecto, persistencia y proveedores" },
  args: { json: { type: "boolean" } },
  run: ({ args }) => ejecutarComando(async () => {
    const resultado = await crearAplicacion().diagnosticarCompleto.ejecutar();
    if (args.json) return consola.log(JSON.stringify(resultado, null, 2));
    consola.log(`${resultado.proyecto.ok ? "✓" : "✗"} proyecto ${resultado.proyecto.nombre ?? resultado.proyecto.error ?? ""}`);
    consola.log(`${resultado.persistencia.ok ? "✓" : "✗"} SQLite esquema ${resultado.persistencia.esquema ?? "?"}, ${resultado.persistencia.ocupacionesActivas ?? 0} ocupaciones`);
    for (const p of resultado.proveedores) consola.log(`${p.ok ? "✓" : "✗"} ${p.proveedor}${p.error ? `: ${p.error}` : ""}`);
  }),
});
