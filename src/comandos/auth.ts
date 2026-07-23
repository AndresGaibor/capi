import { defineCommand } from "citty";
import * as prompts from "@clack/prompts";
import consola from "consola";
import { saveDsSessionId, loadSession, getSessionStatus } from "../auth/deepseek.ts";

const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Verificar el estado actual de la sesión guardada",
  },
  run() {
    const status = getSessionStatus();
    if (!status.hasSession) {
      consola.warn("No hay sesión guardada. Ejecuta 'capi capture'.");
      return;
    }

    consola.info("Estado de la sesión:");
    consola.log(`  • Auth Token:   ${status.hasAuth ? "✅ Presente" : "❌ Falta"}`);
    consola.log(`  • Thumbcache:   ${status.hasThumbcache ? "✅ Presente" : "❌ Falta"}`);
    consola.log(`  • AWS WAF:      ${status.hasAwsWaf ? "✅ Presente" : "❌ Falta"}`);
    consola.log(`  • DS Session:   ${status.hasDsSessionId ? "✅ Presente" : "❌ Falta (HttpOnly)"}`);
    if (status.capturedAt) {
      consola.log(`  • Capturada en:  ${new Date(status.capturedAt).toLocaleString("es-ES")}`);
    }
    consola.log(`  • Válida:       ${!status.isExpired ? "✅ Sí" : "⚠️ Incompleta o Expirada"}`);
  },
});

export const authCommand = defineCommand({
  meta: {
    name: "auth",
    description: "Gestionar credenciales de plataformas",
  },
  subCommands: {
    status: statusCommand,
    deepseek: defineCommand({
      meta: {
        name: "deepseek",
        description: "Configurar credenciales de DeepSeek",
      },
      subCommands: {
        status: statusCommand,
        setDsSession: defineCommand({
          meta: {
            name: "set-ds-session",
            description: "Guardar ds_session_id manualmente ( HttpOnly, no se puede leer desde JS )",
          },
          async run() {
            prompts.intro("Configurar ds_session_id de DeepSeek");

            const actual = loadSession();
            if (actual?.dsSessionId) {
              prompts.note(
                `Actual: ${actual.dsSessionId.slice(0, 20)}...`,
                "ds_session_id actual"
              );
            }

            const valor = await prompts.text({
              message: "Pega el valor de ds_session_id:",
              placeholder: "ds_session_id=eef8222e03574a...",
              validate: (v) =>
                v && v.startsWith("ds_session_id=") && v.length > 20
                  ? undefined
                  : "Debe comenzar con 'ds_session_id=' y tener un valor largo",
            });

            if (prompts.isCancel(valor)) {
              prompts.cancel("Operación cancelada");
              return;
            }

            saveDsSessionId(String(valor));
            prompts.outro("ds_session_id guardado correctamente");
          },
        }),
      },
    }),
  },
});

