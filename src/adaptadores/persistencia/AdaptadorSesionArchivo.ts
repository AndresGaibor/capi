import type { PuertoRepositorioSesion } from "../../dominio/deepseek/puertos/PuertoRepositorioSesion";
import type { SesionDeepSeek } from "../../dominio/deepseek/entidades/SesionDeepSeek";
import { readFileSync } from "node:fs";

const RUTA_SESION = "/tmp/capi-deepseek-session.json";

export class AdaptadorSesionArchivo implements PuertoRepositorioSesion {
  private sesion: SesionDeepSeek | null = null;
  private cargada = false;

  cargar(): SesionDeepSeek | null {
    if (this.cargada) return this.sesion;
    this.cargada = true;

    try {
      const text = readFileSync(RUTA_SESION, "utf-8");
      if (!text) return null;
      this.sesion = JSON.parse(text) as SesionDeepSeek;
    } catch {
      this.sesion = null;
    }

    return this.sesion;
  }

  guardar(sesion: SesionDeepSeek): void {
    this.sesion = sesion;
    Bun.write(RUTA_SESION, JSON.stringify(sesion, null, 2));
  }

  existe(): boolean {
    return this.cargar() !== null;
  }
}
