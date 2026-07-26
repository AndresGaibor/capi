import type { TransporteNavegador } from "./TransporteNavegador";

export interface PestanaNavegador { targetId: string; url: string; title?: string; activa?: boolean }

export class GestorPestanas {
  constructor(private readonly transporte: TransporteNavegador, private readonly limitePorProveedor = 5) {}

  async listar(): Promise<PestanaNavegador[]> {
    if (!this.transporte.cdp) return [];
    try {
      const respuesta = await this.transporte.cdp<{ targetInfos?: Array<{ targetId: string; url: string; title?: string; type?: string }> }>("Target.getTargets");
      return (respuesta.targetInfos ?? []).filter(x => x.type === "page").map(x => ({ targetId: x.targetId, url: x.url, title: x.title }));
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      if (/tab was closed|session .* closed|no tab with given id|not allowed/i.test(mensaje)) return [];
      throw error;
    }
  }

  async validarNuevaPestana(proveedor: "qwen" | "deepseek" | "chatgpt"): Promise<void> {
    const host = this.hostProveedor(proveedor);
    const compatibles = (await this.listar()).filter(p => p.url.includes(host));
    if (compatibles.length >= this.limitePorProveedor) throw new Error(`Se alcanzó el límite de ${this.limitePorProveedor} pestañas administradas para ${proveedor}.`);
  }

  async planificar(proveedor: "qwen" | "deepseek" | "chatgpt"): Promise<{ accion: "reutilizar" | "abrir"; pestana?: PestanaNavegador }> {
    const host = this.hostProveedor(proveedor);
    const compatibles = (await this.listar()).filter(p => p.url.includes(host));
    const libre = compatibles.find(p => /\/$|\/chat\/?$/.test(new URL(p.url).pathname));
    if (libre) return { accion: "reutilizar", pestana: libre };
    if (compatibles.length >= this.limitePorProveedor) throw new Error(`Se alcanzó el límite de ${this.limitePorProveedor} pestañas administradas para ${proveedor}.`);
    return { accion: "abrir" };
  }

  private hostProveedor(proveedor: "qwen" | "deepseek" | "chatgpt"): string {
    if (proveedor === "qwen") return "chat.qwen.ai";
    if (proveedor === "deepseek") return "chat.deepseek.com";
    return "chatgpt.com";
  }
}
