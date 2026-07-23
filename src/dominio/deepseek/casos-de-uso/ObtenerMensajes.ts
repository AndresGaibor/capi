import type { PuertoInterfazWebBridge } from "../puertos/PuertoInterfazWebBridge";
import type { PuertoRepositorioIndexedDB } from "../puertos/PuertoRepositorioIndexedDB";
import type { PuertoSalidaCLI } from "../puertos/PuertoSalidaCLI";
import type { Conversacion, Mensaje } from "../entidades";

export interface MensajeExtraido {
  rol: string;
  pensamiento: string;
  mensaje: string;
  deepThink?: string;
}

export class ObtenerMensajes {
  constructor(
    private readonly webbridge: PuertoInterfazWebBridge,
    private readonly indexeddb: PuertoRepositorioIndexedDB,
    private readonly salida: PuertoSalidaCLI
  ) {}

  async ejecutar(idConversacion: string): Promise<Conversacion | null> {
    const disponible = await this.webbridge.estaDisponible();
    if (!disponible) {
      this.salida.error("Kimi WebBridge no está disponible. Abre Kimi Browser Companion.");
      return null;
    }

    const urlChat = `https://chat.deepseek.com/a/chat/s/${idConversacion}`;
    this.salida.info(`Verificando si ya hay tab abierta con la conversación...`);

    let necesitaNavegar = true;
    try {
      const tabActual = await this.webbridge.evaluar<string>("window.location.href");
      if (tabActual.value?.includes(idConversacion)) {
        this.salida.info("Conversación ya está abierta en la tab activa.");
        necesitaNavegar = false;
      }
    } catch {
      necesitaNavegar = true;
    }

    if (necesitaNavegar) {
      this.salida.info(`Abriendo conversación en nueva tab...`);
      await this.webbridge.navegar(urlChat, true, "CAPI Messages");
      await new Promise((r) => setTimeout(r, 12000));
    }

    this.salida.info(`Obteniendo mensajes de IndexedDB...`);
    const conversacion = await this.indexeddb.obtenerConversacion(idConversacion);
    if (conversacion && conversacion.mensajes.length > 0) {
      this.salida.success(`Mensajes obtenidos (${conversacion.mensajes.length} mensajes).`);
      if (necesitaNavegar) await this.webbridge.cerrarSesion();
      return conversacion;
    }

    this.salida.warn("IndexedDB vacío. Extrayendo desde DOM...");

    for (let i = 0; i < 3; i++) {
      await this.desplazarPagina();
      await new Promise((r) => setTimeout(r, 3000));
      const desdeDOM = await this.extraerDesdeDOM();
      if (desdeDOM.length > 0) {
        this.salida.success(`Mensajes obtenidos desde DOM (${desdeDOM.length} mensajes).`);
        if (necesitaNavegar) await this.webbridge.cerrarSesion();
        return this.desdeDOMaConversacion(idConversacion, desdeDOM);
      }
    }

    this.salida.warn("No se encontraron mensajes.");
    if (necesitaNavegar) await this.webbridge.cerrarSesion();
    return null;
  }

  private async desplazarPagina(): Promise<void> {
    await this.webbridge.evaluar(`
      (() => {
        const vl = document.querySelector('.ds-virtual-list');
        if (vl) {
          vl.scrollTop = 0;
          vl.dispatchEvent(new Event('scroll', { bubbles: true }));
          vl.scrollTop = Math.max(0, vl.scrollHeight - vl.clientHeight);
          vl.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
        window.scrollTo(0, 0);
        window.dispatchEvent(new Event('scroll'));
      })()
    `);
  }

  private async extraerDesdeDOM(): Promise<MensajeExtraido[]> {
    return this.webbridge.extraerMensajesDOM();
  }

  private desdeDOMaConversacion(id: string, mensajes: MensajeExtraido[]): Conversacion {
    const msgs: Mensaje[] = mensajes.map((m, i) => ({
      id: `${id}-${i}`,
      rol: m.rol === "usuario" ? "usuario" : "asistente",
      fragmentos: m.rol === "asistente"
        ? [
            ...(m.deepThink ? [{ type: "THINK" as const, content: m.deepThink }] : []),
            { type: "RESPONSE" as const, content: m.mensaje },
          ]
        : [{ type: "REQUEST" as const, content: m.mensaje }],
    }));

    return {
      id,
      titulo: "Conversación",
      fijada: false,
      tipoModelo: "",
      actualizadaEn: Date.now(),
      mensajes: msgs,
    };
  }
}
