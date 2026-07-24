import { AdaptadorKimiWebBridge } from "../../adaptadores/webbridge/AdaptadorKimiWebBridge";
import type { TransporteNavegador } from "./TransporteNavegador";

export class TransporteWebBridge implements TransporteNavegador {
  constructor(private readonly adaptador = new AdaptadorKimiWebBridge()) {}
  estaDisponible(): Promise<boolean> { return this.adaptador.estaDisponible(); }
  async navegar(url: string, nuevaPestana = false, titulo?: string): Promise<void> {
    await this.adaptador.navegar(url, nuevaPestana, titulo);
  }
  evaluar<T>(codigo: string) { return this.adaptador.evaluar<T>(codigo); }
}
