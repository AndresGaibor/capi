import { basename } from "node:path";
import { readFileSync } from "node:fs";
import { ErrorPaginaProveedor, ErrorTimeoutProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { scriptEnviarPromptQwen } from "../scripts/enviarPrompt";
import type { EstrategiaAdjuntos, ResultadoAdjuntos } from "../../../nucleo/archivos/EstrategiaAdjuntos";

const TAMANO_FRAGMENTO_BASE64 = 256 * 1024;

export class QwenEnvio implements EstrategiaAdjuntos {
  readonly nombre = "qwen-dom-data-transfer";
  constructor(
    private readonly transporte: TransporteNavegador,
    private readonly pausa: (ms:number)=>Promise<unknown> = (ms)=>new Promise(r=>setTimeout(r,ms)),
  ) {}

  async adjuntar(rutas: string[] = []): Promise<ResultadoAdjuntos> {
    if (!rutas.length) return { estrategia: this.nombre, archivos: [] };
    await this.limpiarAdjuntosResiduales();
    for (const ruta of rutas) await this.adjuntarUno(ruta);
    return { estrategia: this.nombre, archivos: [...rutas] };
  }

  private async limpiarAdjuntosResiduales(): Promise<void> {
    const eliminados = await this.transporte.evaluar<number>(`(() => {
      const botones = [...document.querySelectorAll('button[aria-label="Eliminar archivo"]')];
      for (const boton of botones) boton.click();
      return botones.length;
    })()`);
    if (!eliminados.value) return;
    for (let intento = 0; intento < 20; intento++) {
      const restantes = await this.transporte.evaluar<number>(
        `document.querySelectorAll('button[aria-label="Eliminar archivo"]').length`,
      );
      if ((restantes.value ?? 0) === 0) return;
      await this.pausa(100);
    }
    throw new ErrorPaginaProveedor("Qwen no pudo limpiar los adjuntos anteriores");
  }

  private async prepararSelectorDeArchivos(): Promise<void> {
    await this.transporte.evaluar(`document.querySelector('.mode-select-open')?.click()`);
    for (let intento = 0; intento < 20; intento++) {
      const resultado = await this.transporte.evaluar<{ ok: boolean }>(`(() => {
        const opcion = document.querySelector('[data-menu-id$="-upload"], [role="menuitem"]');
        const candidata = opcion?.getAttribute('data-menu-id')?.endsWith('-upload')
          ? opcion
          : [...document.querySelectorAll('[role="menuitem"]')].find(e => /subir archivo|upload file/i.test(e.textContent || ''));
        if (!candidata) return { ok:false };
        candidata.click();
        return { ok:true };
      })()`);
      if (resultado.value?.ok) {
        await this.pausa(150);
        return;
      }
      await this.pausa(100);
    }
    throw new ErrorPaginaProveedor("No se encontró la opción de subir archivo de Qwen");
  }

  private async adjuntarUno(ruta: string): Promise<void> {
    await this.prepararSelectorDeArchivos();
    const nombre = basename(ruta);
    const base64 = readFileSync(ruta).toString("base64");
    const clave = `__capiArchivo_${crypto.randomUUID().replaceAll("-", "")}`;
    await this.transporte.evaluar(`window[${JSON.stringify(clave)}]=[]`);
    for (let inicio = 0; inicio < base64.length; inicio += TAMANO_FRAGMENTO_BASE64) {
      const fragmento = base64.slice(inicio, inicio + TAMANO_FRAGMENTO_BASE64);
      await this.transporte.evaluar(`window[${JSON.stringify(clave)}].push(${JSON.stringify(fragmento)})`);
    }
    const resultado = await this.transporte.evaluar<{ ok: boolean; error?: string; name?: string }>(`(() => {
      const input = document.querySelector('#filesUpload, input[type="file"][aria-label*="archivos" i], input[type="file"]');
      if (!input) return { ok:false, error:'No se encontró el input de archivos de Qwen' };
      const base64 = window[${JSON.stringify(clave)}].join('');
      delete window[${JSON.stringify(clave)}];
      const binario = atob(base64);
      const bytes = new Uint8Array(binario.length);
      for (let i=0;i<binario.length;i++) bytes[i]=binario.charCodeAt(i);
      const archivo = new File([bytes], ${JSON.stringify(nombre)}, { type:'text/plain', lastModified:Date.now() });
      const transferencia = new DataTransfer();
      transferencia.items.add(archivo);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files').set.call(input, transferencia.files);
      input.dispatchEvent(new Event('change', { bubbles:true }));
      return { ok:true, name:archivo.name };
    })()`);
    if (!resultado.value?.ok) throw new ErrorPaginaProveedor(resultado.value?.error ?? "Qwen rechazó el archivo");

    let listoConsecutivo = 0;
    for (let intento = 0; intento < 120; intento++) {
      const estado = await this.transporte.evaluar<{ visible: boolean; procesando: boolean; error: string }>(`(() => {
        const texto = document.body.innerText || '';
        const visible = texto.includes(${JSON.stringify(nombre.replace(/\.txt$/i, ""))});
        const alerta = [...document.querySelectorAll('[role="alert"], .ant-message-error, [class*="error"]')]
          .map(e => (e.innerText || e.textContent || '').trim()).filter(Boolean).at(-1) || '';
        const alertaTransitoria = /aún hay archivos cargándose|archivos cargando|still (?:uploading|loading)|wait for (?:the )?upload|espera a que la carga/i.test(alerta);
        const procesando = /Analizando\.\.\.|Parsing\.\.\.|Uploading\.\.\./i.test(texto) || alertaTransitoria;
        const error = alertaTransitoria ? '' : alerta;
        return { visible, procesando, error };
      })()`);
      if (estado.value?.error) throw new ErrorPaginaProveedor(`Qwen no pudo procesar ${nombre}: ${estado.value.error}`);
      listoConsecutivo = estado.value?.visible && !estado.value.procesando ? listoConsecutivo + 1 : 0;
      if (listoConsecutivo >= 8) return;
      await this.pausa(500);
    }
    throw new ErrorTimeoutProveedor(`Timeout procesando el archivo ${nombre} en Qwen`);
  }

  async enviar(prompt: string): Promise<void> {
    const resultado = await this.transporte.evaluar<{ ok: boolean; error?: string }>(scriptEnviarPromptQwen(prompt));
    if (!resultado.value?.ok) throw new ErrorPaginaProveedor(resultado.value?.error ?? "No se pudo enviar el prompt a Qwen");
  }
}
