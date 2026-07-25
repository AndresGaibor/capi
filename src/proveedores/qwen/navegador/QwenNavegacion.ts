import { ErrorPaginaProveedor, ErrorProveedorNoDisponible } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { SELECTORES_QWEN } from "../selectores/SelectoresQwen";
import type { GestorPestanas } from "../../../plataforma/webbridge/GestorPestanas";

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class QwenNavegacion {
  constructor(private readonly transporte: TransporteNavegador, private readonly pausa: (ms:number)=>Promise<unknown> = dormir, private readonly gestorPestanas?: GestorPestanas) {}

  async verificarDisponibilidad(): Promise<void> {
    if (!(await this.transporte.estaDisponible())) {
      throw new ErrorProveedorNoDisponible("qwen");
    }
  }

  async abrirConversacion(id?: string, nuevaPestana = false): Promise<void> {
    const url = id ? `https://chat.qwen.ai/c/${id}` : "https://chat.qwen.ai/";
    let yaAbierta = false;
    try {
      const actual = await this.transporte.evaluar<string>("window.location.href");
      if (id) {
        yaAbierta = Boolean(actual.value?.includes(`/c/${id}`));
      } else {
        try {
          const actualUrl = new URL(actual.value ?? "");
          yaAbierta = actualUrl.hostname === "chat.qwen.ai" && actualUrl.pathname === "/";
        } catch {
          yaAbierta = false;
        }
      }
    } catch {
      yaAbierta = false;
    }

    if (!yaAbierta) {
      if (nuevaPestana) await this.gestorPestanas?.validarNuevaPestana("qwen");
      await this.transporte.navegar(url, nuevaPestana, "CAPI Qwen");
      await this.pausa(5000);
    }

    for (let i = 0; i < 15; i++) {
      const lista = await this.transporte.evaluar<boolean>(
        `!!document.querySelector(${JSON.stringify(SELECTORES_QWEN.textarea)})`,
      );
      if (lista.value) {
        const host = await this.transporte.evaluar<string>("location.host");
        if (host.value !== "chat.qwen.ai") throw new ErrorPaginaProveedor(`Se esperaba Qwen, pero la pestaña activa es ${host.value ?? "desconocida"}`);
        return;
      }
      await this.pausa(1000);
    }

    throw new ErrorPaginaProveedor("El textarea de Qwen no apareció");
  }

  async obtenerConversacionActual(intentos = 1, esperaMs = 300): Promise<string | null> {
    for (let intento = 0; intento < intentos; intento++) {
      const url = (await this.transporte.evaluar<string>("window.location.href")).value ?? "";
      const id = url.match(/\/c\/([^/?#]+)/)?.[1] ?? null;
      if (id && id !== "new-chat") return id;
      if (intento + 1 < intentos) await this.pausa(esperaMs);
    }
    return null;
  }
}
