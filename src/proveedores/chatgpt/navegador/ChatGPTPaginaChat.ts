import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { ModeloChat, ConversacionResumen } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { SupervisorStreamingProveedor } from "../../compartido/SupervisorStreamingProveedor";
import { configuracionProveedor } from "../../../configuracion/ConfiguracionProveedores";
import { CAPI_CONFIG } from "../../../configuracion/ConstantesCapi";
import { scriptEnviarPromptChatGPT } from "../scripts/enviarPrompt";
import { scriptEstadoStreamingChatGPT } from "../scripts/estadoStreaming";
import { scriptListarConversacionesChatGPT } from "../scripts/listarConversaciones";
import { SELECTORES_CHATGPT } from "../selectores/SelectoresChatGPT";
import { detectarTipoArchivo } from "../../../nucleo/archivos/DetectarTipoArchivo";
import { basename, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { normalizarUrlConversacion, canonicalizarConversacion } from "../utilidades/urlConversacion";

const MAX_TAMANIO_ARCHIVO = 100 * 1024 * 1024;
const dormir = (ms: number) => new Promise((cumplir) => setTimeout(cumplir, ms));

export class ChatGPTPaginaChat {
  private asistentesAntes = 0;
  private respuestaAntes = "";
  private ocupado = false;

  constructor(private readonly transporte: TransporteNavegador) {}

  async verificarDisponibilidad(): Promise<void> {
    const disponible = await this.transporte.estaDisponible();
    if (!disponible) throw new Error("WebBridge no está disponible para ChatGPT");
    const seleccionada = await this.transporte.seleccionarPestanaPorHost?.("chatgpt.com");
    if (!seleccionada) await this.transporte.navegar("https://chatgpt.com/", false, "CAPI ChatGPT");
    await this.esperarHostnameChatGPT(5000);
  }

  private async esperarHostnameChatGPT(timeoutMs: number): Promise<void> {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      const resultado = await this.transporte.evaluar<string>("location.hostname");
      if (/chatgpt\.com|chat\.openai\.com/.test(resultado.value || "")) return;
      await dormir(200);
    }
    throw new Error("La pestaña activa no es ChatGPT o no está lista");
  }


  private async esperarEditorChatGPT(timeoutMs = 15000): Promise<void> {
    const selector = this.transporte.cdp
      ? '.ProseMirror[contenteditable="true"]'
      : 'textarea[aria-label*="ChatGPT" i], textarea[aria-label*="Chatear" i], textarea[name="prompt-textarea"]';
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      const listo = await this.transporte.evaluar<boolean>(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (listo.value) return;
      await dormir(200);
    }
    throw new Error("El editor de ChatGPT no apareció");
  }

  private normalizarUrlConversacion(id: string): string {
    const limpio = id.trim();
    if (/^https?:\/\//i.test(limpio)) {
      try {
        const url = new URL(limpio, "https://chatgpt.com");
        const match = url.pathname.match(/\/c\/([^/?#]+)/);
        if (match) return `https://chatgpt.com/c/${match[1]}`;
        return limpio;
      } catch {
        return `https://chatgpt.com/c/${limpio}`;
      }
    }
    if (limpio.startsWith("/")) {
      const match = limpio.match(/\/c\/([^/?#]+)/);
      if (match) return `https://chatgpt.com/c/${match[1]}`;
      return `https://chatgpt.com${limpio}`;
    }
    const uuid = limpio.replace(/^c\//, "");
    return `https://chatgpt.com/c/${uuid}`;
  }

  async abrirConversacion(id?: string, nuevaPestana = false): Promise<void> {
    if (!id) {
      const actual = await this.obtenerConversacionActual();
      if (!actual) await this.transporte.navegar("https://chatgpt.com/", nuevaPestana, "CAPI ChatGPT");
      await this.esperarEditorChatGPT();
      return;
    }
    const url = normalizarUrlConversacion(id);
    if (!nuevaPestana && (await this.obtenerConversacionActual()) === url) {
      await this.esperarEditorChatGPT();
      return;
    }
    await this.transporte.navegar(url, nuevaPestana, "CAPI ChatGPT");
    await this.esperarEditorChatGPT();
    this.asistentesAntes = 0;
    this.respuestaAntes = "";
    this.ocupado = false;
  }

  listarModelos(): ModeloChat[] {
    return [{ id: "auto", nombre: "Auto", descripcion: "Modelo seleccionado por ChatGPT" }];
  }

  async seleccionarModelo(modelo: string): Promise<ModeloChat> {
    const encontrado = this.listarModelos().find((item) => item.id === modelo);
    if (!encontrado) throw new Error(`ChatGPT no expone el modelo ${modelo} mediante el adaptador Web`);
    return encontrado;
  }

  async listarConversaciones(): Promise<ConversacionResumen[]> {
    const resultado = await this.transporte.evaluar<Array<{ href: string; titulo: string }>>(scriptListarConversacionesChatGPT());
    const vistas = new Set<string>();
    return (resultado.value ?? [])
      .map((item) => ({
        id: canonicalizarConversacion(item.href),
        titulo: item.titulo.trim(),
      }))
      .filter((item): item is ConversacionResumen => Boolean(item.id))
      .filter((item) => {
        if (vistas.has(item.id!)) return false;
        vistas.add(item.id!);
        return true;
      });
  }

  private async activarPagina(): Promise<void> {
    if (!this.transporte.cdp) return;
    try { await this.transporte.cdp("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch {}
    try { await this.transporte.cdp("Page.setWebLifecycleState", { state: "active" }); } catch {}
  }

  async enviar(prompt: string): Promise<void> {
    if (this.ocupado) throw new Error("ChatGPT ya tiene una operación en curso");
    this.ocupado = true;
    try {
      const antes = await this.transporte.evaluar<{ turns: number; response: string }>(scriptEstadoStreamingChatGPT());
      this.asistentesAntes = antes.value?.turns ?? 0;
      this.respuestaAntes = antes.value?.response ?? "";
      if (this.transporte.cdp) {
        await this.activarPagina();
        const editorRico = await this.transporte.evaluar<boolean>(`(() => {
          const editor=document.querySelector('.ProseMirror[contenteditable="true"]');
          if (!(editor instanceof HTMLElement)) return false;
          editor.focus();
          return true;
        })()`);
        if (editorRico.value) {
          await this.transporte.cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 4 });
          await this.transporte.cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 4 });
          await this.transporte.cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace" });
          await this.transporte.cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace" });
          await this.transporte.cdp("Input.insertText", { text: prompt });
          let enviado = false;
          for (let intento = 0; intento < 5; intento++) {
            const clic = await this.transporte.evaluar<boolean>(`(() => {
              const btn=[...document.querySelectorAll(${JSON.stringify(SELECTORES_CHATGPT.enviar)})]
                .find(b=>b instanceof HTMLButtonElement && !b.disabled);
              if (!(btn instanceof HTMLButtonElement)) return false;
              btn.click(); return true;
            })()`);
            if (clic.value) { enviado = true; break; }
            await dormir(100);
          }
          if (!enviado) throw new Error("No apareció el botón de envío de ChatGPT tras escribir en ProseMirror");
          await this.confirmarEnvio();
          return;
        }
      }
      if (this.transporte.rellenar) {
        await this.transporte.rellenar(SELECTORES_CHATGPT.editor, prompt);
        if (this.transporte.click) {
          await this.transporte.click(SELECTORES_CHATGPT.enviar);
          await this.confirmarEnvio();
          return;
        }
        await this.transporte.evaluar(`(() => { const boton = document.querySelector(${JSON.stringify(SELECTORES_CHATGPT.enviar)}); if (!(boton instanceof HTMLElement)) throw new Error("No se encontró el botón de envío de ChatGPT"); boton.click(); return true; })()`);
        await this.confirmarEnvio();
        return;
      }
      await this.transporte.evaluar(scriptEnviarPromptChatGPT(prompt));
      await this.confirmarEnvio();
    } finally {
      this.ocupado = false;
    }
  }

  private async confirmarEnvio(): Promise<void> {
    const timeoutMs = 10000;
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      const estado = await this.transporte.evaluar<{ turns: number; response: string; error?: string }>(scriptEstadoStreamingChatGPT());
      if (estado.value?.error) throw new Error(`ChatGPT rechazó el envío: ${estado.value.error}`);
      if ((estado.value?.turns ?? 0) > this.asistentesAntes) return;
      if (estado.value?.response !== this.respuestaAntes && estado.value?.response !== "") return;
      const detenido = await this.transporte.evaluar<boolean>(`Boolean(document.querySelector(${JSON.stringify(SELECTORES_CHATGPT.detener)}))`);
      if (detenido.value) return;
      await dormir(200);
    }
    throw new Error("No se pudo confirmar el envío del prompt en ChatGPT");
  }

  async adjuntar(archivos: string[]): Promise<void> {
    if (!archivos.length) return;
    if (!this.transporte.cdp) throw new Error("WebBridge no admite CDP para adjuntar archivos en ChatGPT");
    const grupos = new Map<string, string[]>();
    for (const archivo of archivos) {
      const selector = detectarTipoArchivo(archivo).mime.startsWith("image/")
        ? SELECTORES_CHATGPT.adjuntarImagenes
        : SELECTORES_CHATGPT.adjuntarArchivos;
      const lista = grupos.get(selector) ?? [];
      lista.push(resolve(archivo));
      grupos.set(selector, lista);
    }
    for (const [selector, rutas] of grupos) {
      const documento = await this.transporte.cdp<{ root: { nodeId: number } }>("DOM.getDocument");
      const nodo = await this.transporte.cdp<{ nodeId: number }>("DOM.querySelector", { nodeId: documento.root.nodeId, selector });
      if (!nodo.nodeId) throw new Error(`No se encontró el input de archivos de ChatGPT: ${selector}`);
      try {
        await this.transporte.cdp("DOM.setFileInputFiles", { nodeId: nodo.nodeId, files: rutas });
      } catch (error) {
        if (!/not allowed|denied|setFileInputFiles/i.test(error instanceof Error ? error.message : String(error))) throw error;
        await this.adjuntarPorDom(rutas, selector);
      }
    }
    await this.confirmarAdjunto(archivos);
  }

  private async confirmarAdjunto(_archivos: string[]): Promise<void> {
    const timeoutMs = 10000;
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      const hayChip = await this.transporte.evaluar<boolean>(`Boolean(document.querySelector('[data-testid="attachment-chip"], [data-testid="file-chip"], [data-testid="image-attachment"]"))`);
      if (hayChip.value) return;
      await dormir(300);
    }
  }

  private async adjuntarPorDom(rutas: string[], selector: string): Promise<void> {
    const transferencia = new DataTransfer();
    for (const ruta of rutas) {
      const buffer = await readFile(ruta);
      if (buffer.length > MAX_TAMANIO_ARCHIVO) throw new Error(`Archivo demasiado grande: ${basename(ruta)} (max ${MAX_TAMANIO_ARCHIVO / 1024 / 1024}MB)`);
      const base64 = buffer.toString("base64");
      const clave = `__capiChatGPTArchivo_${crypto.randomUUID().replaceAll("-", "")}`;
      await this.transporte.evaluar(`window[${JSON.stringify(clave)}]=[]`);
      for (let inicio = 0; inicio < base64.length; inicio += 256 * 1024) {
        await this.transporte.evaluar(`window[${JSON.stringify(clave)}].push(${JSON.stringify(base64.slice(inicio, inicio + 256 * 1024))})`);
      }
      const detectado = detectarTipoArchivo(ruta);
      const binario = (await this.transporte.evaluar<string>(`(() => { const bin = atob(window[${JSON.stringify(clave)}].join("")); delete window[${JSON.stringify(clave)}]; return bin; })()`)).value ?? "";
      const bytes = new Uint8Array(binario.length); for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      const archivo = new File([bytes], basename(ruta), { type: detectado.mime, lastModified: Date.now() });
      transferencia.items.add(archivo);
    }
    const estado = await this.transporte.evaluar<{ ok: boolean; error?: string }>(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement)) return { ok: false, error: "No se encontró el input de ChatGPT" };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")?.set;
      if (!setter) return { ok: false, error: "No se pudo asignar files en el input" };
      setter.call(input, transferencia.files);
      if (!input.files || input.files.length === 0) return { ok: false, error: "El input no aceptó los archivos" };
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, count: input.files.length };
    })()`);
    if (!estado.value?.ok) throw new Error(estado.value?.error ?? `ChatGPT rechazó los archivos`);
  }

  async *observar(conversacionConocida?: string): AsyncGenerator<EventoStreaming> {
    let anterior = this.respuestaAntes;
    const imagenesObservadas = new Set<string>();
    let ultimoCambio = Date.now();
    let fallosConsecutivos = 0;
    const MAX_FALLOS_EVALUAR = 3;
    const supervisor = new SupervisorStreamingProveedor(configuracionProveedor("chatgpt"), Date.now());
    for (;;) {
      await dormir(CAPI_CONFIG.TIMEOUTS_MS.INTERVALO_STREAMING);
      let estado: { response: string; images?: Array<{ url: string; alt?: string }>; turns: number; isGenerating: boolean; done: boolean; error?: string; continueGenerating?: boolean } | undefined;
      try {
        estado = (await this.transporte.evaluar<{ response: string; images?: Array<{ url: string; alt?: string }>; turns: number; isGenerating: boolean; done: boolean; error?: string; continueGenerating?: boolean }>(scriptEstadoStreamingChatGPT())).value;
        fallosConsecutivos = 0;
      } catch {
        fallosConsecutivos++;
        if (fallosConsecutivos >= MAX_FALLOS_EVALUAR) {
          yield { tipo: "estado", estado: "desconectado", progresoDetectado: false, estrategia: "dom", detalles: `reintento ${fallosConsecutivos}` };
          const conversacion = conversacionConocida ?? await this.obtenerConversacionActual();
          const urlRecuperacion = conversacion ? normalizarUrlConversacion(conversacion) : "https://chatgpt.com/";
          await this.transporte.recuperarPestana?.("chatgpt.com", urlRecuperacion);
          await this.activarPagina();
        }
        continue;
      }
      if (estado?.error) {
        yield { tipo: "error", mensaje: estado.error, recuperable: true };
        return;
      }
      const firma = `${estado?.turns ?? 0}:${estado?.response?.length ?? 0}:${estado?.isGenerating ? 1 : 0}:${estado?.done ? 1 : 0}`;
      for (const eventoSupervisor of supervisor.observar(firma, estado?.response ? "respondiendo" : estado?.isGenerating ? "pensando" : "esperando_respuesta", Date.now())) yield eventoSupervisor;
      const esNuevoTurno = (estado?.turns ?? 0) > this.asistentesAntes || (estado?.response !== this.respuestaAntes && estado?.response !== "");
      if (!esNuevoTurno) continue;
      for (const imagen of estado?.images ?? []) if (imagen.url && !imagenesObservadas.has(imagen.url)) { imagenesObservadas.add(imagen.url); ultimoCambio = Date.now(); yield { tipo: "imagen", url: imagen.url, alt: imagen.alt }; }
      if (!estado?.response && !(estado?.images?.length)) continue;
      if (estado.response !== anterior) {
        const esReemplazo = anterior.length > 0 && !estado.response.startsWith(anterior);
        const delta = esReemplazo ? estado.response : estado.response.slice(anterior.length);
        if (delta) yield { tipo: "respuesta", contenido: delta, reemplazo: esReemplazo };
        anterior = estado.response;
        ultimoCambio = Date.now();
      }
      if (estado.done && Date.now() - ultimoCambio >= CAPI_CONFIG.TIMEOUTS_MS.ESTABILIDAD_FIN_GENERICA) {
        if (estado.continueGenerating) {
          yield { tipo: "pausado", motivo: "ChatGPT ofrece continuar generando.", conversacionId: await this.obtenerConversacionActual() ?? undefined };
        } else {
          yield { tipo: "fin" };
        }
        return;
      }
    }
  }

  async obtenerConversacionActual(intentos = 1, esperaMs = 300): Promise<string | null> {
    for (let intento = 0; intento < intentos; intento++) {
      const resultado = await this.transporte.evaluar<string>("location.href");
      const href = resultado.value ?? "";
      if (/chatgpt\.com|chat\.openai\.com/.test(href) && /\/c\//.test(href)) {
        const canonica = canonicalizarConversacion(href);
        if (canonica && !/\/c\/WEB:/i.test(canonica)) return canonica;
      }
      if (intento + 1 < intentos) await dormir(esperaMs);
    }
    return null;
  }

  async diagnosticar(): Promise<Record<string, unknown>> {
    const selectorPresente = (selector: string) => `Boolean(document.querySelector(${JSON.stringify(selector)}))`;
    return {
      proveedor: "chatgpt",
      url: (await this.transporte.evaluar<string>("location.href")).value ?? null,
      conversacionId: await this.obtenerConversacionActual(),
      editor: Boolean((await this.transporte.evaluar<boolean>(selectorPresente(SELECTORES_CHATGPT.editor))).value),
      botonEnvio: Boolean((await this.transporte.evaluar<boolean>(selectorPresente(SELECTORES_CHATGPT.enviar))).value),
      botonDetener: Boolean((await this.transporte.evaluar<boolean>(selectorPresente(SELECTORES_CHATGPT.detener))).value),
      inputImagenes: Boolean((await this.transporte.evaluar<boolean>(selectorPresente(SELECTORES_CHATGPT.adjuntarImagenes))).value),
      inputArchivos: Boolean((await this.transporte.evaluar<boolean>(selectorPresente(SELECTORES_CHATGPT.adjuntarArchivos))).value),
      capacidades: {
        rellenar: Boolean(this.transporte.rellenar),
        click: Boolean(this.transporte.click),
        cdp: Boolean(this.transporte.cdp),
      },
    };
  }
}
