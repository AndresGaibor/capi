import { defineCommand } from "citty";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { crearSobreExito, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";

export const comandoDiagnosticoContratos = defineCommand({
  meta: { name: "contratos", description: "Verificar contratos reales de navegación y modelos por proveedor" },
  args: { output: { type: "string", alias: "o", default: "human" } },
  async run({ args }) {
    const resultado = await crearAplicacion().verificarContratosProveedor.ejecutar();
    const formato = String(args.output) as FormatoSalida;
    if (formato === "human") {
      for (const r of resultado.resultados) process.stdout.write(`${r.disponible && r.modelos ? "✓" : "✗"} ${r.proveedor}${r.error ? `: ${r.error}` : ""}\n`);
      if (!resultado.ok) process.exitCode = 1;
      return;
    }
    process.stdout.write(serializarSalida(crearSobreExito("diagnostics.contracts", resultado), formato) + "\n");
  },
});
