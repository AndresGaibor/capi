import type { PuertoApiDeepSeek } from "../puertos/PuertoApiDeepSeek";
import type { PuertoRepositorioSesion } from "../puertos/PuertoRepositorioSesion";
import type { PuertoSalidaCLI } from "../puertos/PuertoSalidaCLI";
import type { Conversacion } from "../entidades/Conversacion";
import { sesionEsValida } from "../entidades/SesionDeepSeek";

export class ListarConversaciones {
  constructor(
    private readonly api: PuertoApiDeepSeek,
    private readonly persistencia: PuertoRepositorioSesion,
    private readonly salida: PuertoSalidaCLI
  ) {}

  async ejecutar(): Promise<Conversacion[]> {
    this.salida.info("Listando conversaciones...");

    const sesion = this.persistencia.cargar();
    if (!sesionEsValida(sesion)) {
      this.salida.error("No hay sesión válida. Ejecuta login primero.");
      return [];
    }

    const conversaciones = await this.api.listarConversaciones(sesion);
    this.salida.success(`Encontradas ${conversaciones.length} conversaciones.`);
    return conversaciones;
  }
}
