import type { TransporteNavegador } from "./TransporteNavegador";
import { ClienteWebBridge } from "./ClienteWebBridge";
export class TransporteWebBridge implements TransporteNavegador {
  constructor(private readonly cliente = new ClienteWebBridge()) {}
  estaDisponible() { return this.cliente.estaDisponible(); }
  async navegar(url: string, nuevaPestana = false, tituloGrupo?: string): Promise<void> { await this.cliente.navegar(url, nuevaPestana, tituloGrupo); }
  evaluar<T>(codigo: string) { return this.cliente.evaluar<T>(codigo); }
  cdp<T>(method: string, params?: Record<string, unknown>) { return this.cliente.cdp<T>(method, params); }
  cerrarSesion() { return this.cliente.cerrarSesion(); }
}
