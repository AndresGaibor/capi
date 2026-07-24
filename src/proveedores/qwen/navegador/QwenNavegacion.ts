import { ErrorPaginaProveedor, ErrorProveedorNoDisponible } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class QwenNavegacion {
  constructor(private readonly transporte: TransporteNavegador) {}

  async verificarDisponibilidad(): Promise<void> {
    if (!(await this.transporte.estaDisponible())) {
      throw new ErrorProveedorNoDisponible("qwen");
    }
  }

  async abrirConversacion(id?: string): Promise<void> {
    const url = id ? `https://chat.qwen.ai/c/${id}` : "https://chat.qwen.ai/";
    let yaAbierta = false;
    try {
      const actual = await this.transporte.evaluar<string>("window.location.href");
      yaAbierta = Boolean(actual.value?.includes(id ?? "chat.qwen.ai"));
    } catch {
      yaAbierta = false;
    }

    if (!yaAbierta) {
      await this.transporte.navegar(url, false, "CAPI Qwen");
      await dormir(5000);
    }

    for (let i = 0; i < 15; i++) {
      const lista = await this.transporte.evaluar<boolean>(
        "!!document.querySelector('textarea.message-input-textarea')",
      );
      if (lista.value) return;
      await dormir(1000);
    }

    throw new ErrorPaginaProveedor("El textarea de Qwen no apareció");
  }
}
