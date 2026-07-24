import { readFileSync } from "node:fs";
import type { SesionDeepSeek } from "../../proveedores/deepseek/tipos";
const RUTA = "/tmp/capi-deepseek-session.json";
export class SesionDeepSeekArchivo {
  cargar(): SesionDeepSeek | null { try { return JSON.parse(readFileSync(RUTA, "utf8")) as SesionDeepSeek; } catch { return null; } }
  async guardar(sesion: SesionDeepSeek): Promise<void> { await Bun.write(RUTA, JSON.stringify(sesion, null, 2)); }
}
