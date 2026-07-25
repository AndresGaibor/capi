import { defineCommand } from "citty";
import { TransporteWebBridge } from "../../../../plataforma/webbridge/TransporteWebBridge";

export const comandoDiagnosticoRed = defineCommand({
  meta: { name: "red", description: "Capturar y listar tráfico WebBridge saneado" },
  args: {
    accion: { type: "positional" as const, default: "listar", description: "iniciar|detener|listar" },
  },
  async run({ args }) {
    const transporte = new TransporteWebBridge();
    const accion = String(args.accion ?? "listar");
    if (accion === "iniciar") { await transporte.red?.("start"); process.stdout.write('{"ok":true,"estado":"capturando"}\n'); return; }
    if (accion === "detener") { await transporte.red?.("stop"); process.stdout.write('{"ok":true,"estado":"detenida"}\n'); return; }
    const registros = await transporte.listarRedSaneada?.() ?? [];
    process.stdout.write(`${JSON.stringify({ ok: true, total: registros.length, registros })}\n`);
  },
});
