import { ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptEnviarPromptQwen } from "../scripts/enviarPrompt";

export class QwenEnvio {
  constructor(private readonly transporte: TransporteNavegador) {}

  async enviar(prompt: string): Promise<void> {
    const resultado = await this.transporte.evaluar<{ ok: boolean; error?: string }>(
      scriptEnviarPromptQwen(prompt),
    );
    if (!resultado.value?.ok) {
      throw new ErrorPaginaProveedor(
        resultado.value?.error ?? "No se pudo enviar el prompt a Qwen",
      );
    }
  }
}
