import type { ConversacionResumen } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import type { DeepSeekSesion } from "./DeepSeekSesion";

export class DeepSeekClienteConversaciones {
  constructor(private readonly transporte: TransporteNavegador, private readonly sesion: DeepSeekSesion) {}

  async listar(): Promise<ConversacionResumen[]> {
    const sesion = await this.sesion.obtener();
    const codigo = `fetch('/api/v0/chat_session/fetch_page?lte_cursor.pinned=false',{headers:{Authorization:${JSON.stringify(sesion.authorization)}}}).then(r=>r.json())`;
    const resultado = await this.transporte.evaluar<any>(codigo);
    const items = resultado.value?.data?.biz_data?.chat_sessions ?? [];
    return items.map((x: any) => ({
      id: String(x.id), titulo: String(x.title ?? "Sin título"),
      actualizadaEn: Number(x.updated_at ?? 0) * 1000, modelo: String(x.model_type ?? ""),
    }));
  }
}
