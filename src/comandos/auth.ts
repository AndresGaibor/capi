import { defineCommand } from "citty";
import * as prompts from "@clack/prompts";
import { saveDsSessionId, loadSession } from "../auth/deepseek.ts";

export const authCommand = defineCommand({
  meta: {
    name: "auth",
    description: "Gestionar credenciales de plataformas",
  },
  subCommands: {
    deepseek: defineCommand({
      meta: {
        name: "deepseek",
        description: "Configurar credenciales de DeepSeek",
      },
      subCommands: {
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
