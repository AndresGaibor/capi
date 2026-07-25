import type { TransporteNavegador } from "./TransporteNavegador";
import { ClienteWebBridge } from "./ClienteWebBridge";
export class TransporteWebBridge implements TransporteNavegador {
  constructor(private readonly cliente = new ClienteWebBridge()) {}
  estaDisponible() { return this.cliente.estaDisponible(); }
  async navegar(url: string, nuevaPestana = false, tituloGrupo?: string): Promise<void> { await this.cliente.navegar(url, nuevaPestana, tituloGrupo); }
  seleccionarPestanaActiva(url?: string) { return this.cliente.seleccionarPestanaActiva(url); }
  seleccionarPestanaPorHost(host: string) { return this.cliente.seleccionarPestanaPorHost(host); }
  subirArchivos(selector: string, archivos: string[]) { return this.cliente.subirArchivos(selector, archivos); }
  rellenar(selector: string, valor: string) { return this.cliente.rellenar(selector, valor); }
  click(selector: string) { return this.cliente.click(selector); }
  evaluar<T>(codigo: string) { return this.cliente.evaluar<T>(codigo); }
  snapshotAccesibilidad() { return this.cliente.snapshotAccesibilidad(); }
  cdp<T>(method: string, params?: Record<string, unknown>) { return this.cliente.cdp<T>(method, params); }
  cerrarSesion() { return this.cliente.cerrarSesion(); }
}
