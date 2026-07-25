import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptListarConversacionesQwen } from "../scripts/listarConversaciones";

export interface ResumenConversacionQwen {
  id: string;
  titulo: string;
  seccion?: string;
}

export class QwenConversaciones {
  constructor(private readonly transporte: TransporteNavegador) {}

  async listar(): Promise<ResumenConversacionQwen[]> {
    const resultado = await this.transporte.evaluar<Array<{ titulo: string; items: Array<{ id: string; text: string }> }>>(scriptListarConversacionesQwen());
    const conversaciones: ResumenConversacionQwen[] = [];
    for (const seccion of resultado.value ?? []) {
      for (const item of seccion.items) {
        conversaciones.push({
          id: item.id,
          titulo: item.text || "Sin título",
          seccion: seccion.titulo,
        });
      }
    }
    return conversaciones;
  }
}
