import { ErrorModeloNoDisponible, ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { ModeloChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { resolverModeloQwen } from "../modelos/ResolverModeloQwen";

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class QwenModelos {
  constructor(private readonly transporte: TransporteNavegador) {}

  private async modeloActual(): Promise<string> {
    const resultado = await this.transporte.evaluar<string>(
      `document.querySelector('[aria-label="Select Model"] [class*="model-selector-text"]')?.textContent?.trim() || document.querySelector('[aria-label="Select Model"]')?.textContent?.trim() || ''`,
    );
    return resultado.value ?? "";
  }

  async listar(): Promise<ModeloChat[]> {
    await this.transporte.evaluar<boolean>(
      `document.querySelector('[aria-label="Select Model"]')?.click() || true`,
    );
    for (let i = 0; i < 20; i++) {
      const resultado = await this.transporte.evaluar<string[]>(`(() => {
        const lista = document.querySelector('[role="listbox"][aria-label="Modelos"], [role="listbox"]');
        if (!lista) return [];
        return [...lista.querySelectorAll('[role="option"]')]
          .map((opcion) => opcion.querySelector('[class*="model-item-name"]')?.textContent?.trim() || '')
          .filter(Boolean);
      })()`);
      if (resultado.value?.length) return resultado.value.map((nombre) => ({ id: nombre, nombre }));
      await dormir(100);
    }
    throw new ErrorPaginaProveedor("No apareció la lista de modelos de Qwen");
  }

  async seleccionar(modelo: string): Promise<ModeloChat> {
    const esperado = resolverModeloQwen(modelo)!;
    const actual = await this.modeloActual();
    if (actual.toLowerCase() === esperado.toLowerCase()) return { id: actual, nombre: actual };
    await this.transporte.evaluar<boolean>(
      `document.querySelector('[aria-label="Select Model"]')?.click() || false`,
    );
    let disponibles: string[] = [];
    for (let i = 0; i < 20; i++) {
      const resultado = await this.transporte.evaluar<{ encontrado: boolean; disponibles: string[] }>(`(() => {
        const esperado = ${JSON.stringify(esperado)}.toLowerCase();
        const lista = document.querySelector('[role="listbox"][aria-label="Modelos"], [role="listbox"]');
        if (!lista) return { encontrado: false, disponibles: [] };
        const opciones = [...lista.querySelectorAll('[role="option"]')];
        const disponibles = opciones.map((opcion) => opcion.querySelector('[class*="model-item-name"]')?.textContent?.trim() || '').filter(Boolean);
        const opcion = opciones.find((elemento) => (elemento.querySelector('[class*="model-item-name"]')?.textContent?.trim() || '').toLowerCase() === esperado);
        if (opcion) opcion.click();
        return { encontrado: !!opcion, disponibles };
      })()`);
      disponibles = resultado.value?.disponibles ?? disponibles;
      if (resultado.value?.encontrado) break;
      await dormir(100);
    }
    for (let i = 0; i < 30; i++) {
      const confirmado = await this.modeloActual();
      if (confirmado.toLowerCase() === esperado.toLowerCase()) return { id: confirmado, nombre: confirmado };
      await dormir(100);
    }
    throw new ErrorModeloNoDisponible(esperado, disponibles);
  }
}
