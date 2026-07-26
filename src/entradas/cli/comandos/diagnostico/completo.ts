import { defineCommand } from "citty";
import consola from "consola";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { ejecutarComando } from "../../soporte/ejecutarComando";
import { CAPI_CONFIG } from "../../../../configuracion/ConstantesCapi";
import { spawn } from "node:child_process";

async function intentarReiniciarDaemon(): Promise<{ reiniciado: boolean; detalle: string }> {
  try {
    const { ClienteWebBridge } = await import("../../../../plataforma/webbridge/ClienteWebBridge");
    const cliente = new ClienteWebBridge();
    const yaDisponible = await cliente.estaDisponible();
    if (yaDisponible) return { reiniciado: false, detalle: "WebBridge ya estaba disponible" };
  } catch { /* ignorar */ }
  return new Promise((resolve) => {
    const proc = spawn(process.env.HOME + "/.kimi-webbridge/bin/kimi-webbridge", ["start"], { detached: true, stdio: "ignore", env: { ...process.env } });
    proc.unref();
    setTimeout(async () => {
      try {
        const { ClienteWebBridge } = await import("../../../../plataforma/webbridge/ClienteWebBridge");
        const cliente = new ClienteWebBridge();
        const disponible = await cliente.estaDisponible();
        resolve({ reiniciado: disponible, detalle: disponible ? "WebBridge reiniciado correctamente" : "WebBridge reiniciado pero aún no disponible" });
      } catch { resolve({ reiniciado: false, detalle: "No se pudo verificar WebBridge tras reinicio" }); }
    }, 3000);
  });
}

export const comandoDiagnosticoCompleto = defineCommand({
  meta: { name: "completo", description: "Diagnosticar proyecto, persistencia y proveedores" },
  args: {
    json: { type: "boolean", description: "Salida JSON estructurada" },
    output: { type: "string", default: "human", description: "human|json" },
    repair: { type: "boolean", default: false, description: "Intentar reparar automáticamente WebBridge y sesiones" },
  },
  run: ({ args }) => ejecutarComando(async () => {
    const app = crearAplicacion();
    const resultado = await app.diagnosticarCompleto.ejecutar();
    const repairLog: string[] = [];

    if (args.repair) {
      const fallidos = resultado.proveedores.filter((p) => !p.ok);
      if (fallidos.length > 0) {
        consola.info("Intentando reparar WebBridge...");
        const reinicio = await intentarReiniciarDaemon();
        repairLog.push(reinicio.detalle);
        if (reinicio.reiniciado) {
          for (const f of fallidos) {
            try {
              const proveedor = app.proveedores.obtener(f.proveedor);
              await proveedor.verificarDisponibilidad();
              f.ok = true;
              f.error = undefined;
              repairLog.push(`${f.proveedor}: recuperado tras reinicio`);
            } catch { repairLog.push(`${f.proveedor}: aún no disponible tras reinicio`); }
          }
        }
      }
      const ocupaciones = app.repositorioContexto.contarOcupacionesActivas();
      if (ocupaciones > 0) {
        const limpiadas = app.repositorioContexto.ocupaciones.limpiar();
        repairLog.push(`Ocupaciones expiradas limpiadas: ${limpiadas}`);
      }
    }

    if (args.json || args.output === "json") {
      process.stdout.write(JSON.stringify({ ...resultado, repair: repairLog.length > 0 ? repairLog : undefined }, null, 2) + "\n");
      return;
    }
    consola.log(`${resultado.proyecto.ok ? "✓" : "✗"} proyecto ${resultado.proyecto.nombre ?? resultado.proyecto.error ?? ""}`);
    consola.log(`${resultado.persistencia.ok ? "✓" : "✗"} SQLite esquema ${resultado.persistencia.esquema ?? "?"}, ${resultado.persistencia.ocupacionesActivas ?? 0} ocupaciones`);
    for (const p of resultado.proveedores) consola.log(`${p.ok ? "✓" : "✗"} ${p.proveedor}${p.error ? `: ${p.error}` : ""}`);
    if (repairLog.length > 0) {
      consola.log("");
      consola.log("Reparación:");
      for (const msg of repairLog) consola.log(`  → ${msg}`);
    }
  }),
});
