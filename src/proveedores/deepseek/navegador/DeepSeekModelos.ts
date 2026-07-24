import type { ModeloChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { listarModelosDeepSeek, resolverModeloDeepSeek } from "../modelos/ResolverModeloDeepSeek";
import { scriptObtenerModeloDeepSeek } from "../scripts/obtenerModelo";
export class DeepSeekModelos {
  constructor(private readonly transporte: TransporteNavegador) {}
  listar(): ModeloChat[] { return listarModelosDeepSeek(); }
  async seleccionar(modelo: string): Promise<ModeloChat> {
    const id=resolverModeloDeepSeek(modelo)!;
    const r=await this.transporte.evaluar<{ok:boolean}>(`(() => { const b=document.querySelector('div[data-model-type="${id}"]'); if(!b)return{ok:false}; b.click(); return{ok:true}; })()`);
    if(!r.value?.ok) return { id, nombre:id };
    return { id, nombre:id };
  }
  async actual(): Promise<string|null> { return (await this.transporte.evaluar<string|null>(scriptObtenerModeloDeepSeek())).value ?? null; }
}
