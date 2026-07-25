import { basename, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import type { OpcionesDeepSeek } from "../tipos";
import { scriptEnviarPromptDeepSeek } from "../scripts/enviarPrompt";
import type { EstrategiaAdjuntos, ResultadoAdjuntos } from "../../../nucleo/archivos/EstrategiaAdjuntos";
import { detectarTipoArchivo } from "../../../nucleo/archivos/DetectarTipoArchivo";

const TAMANO_FRAGMENTO_BASE64 = 256 * 1024;

export class DeepSeekEnvio implements EstrategiaAdjuntos {
  readonly nombre = "deepseek-cdp-file-input";
  constructor(private readonly transporte: TransporteNavegador, private readonly pausa: (ms:number)=>Promise<unknown> = ms => new Promise(r => setTimeout(r, ms))) {}

  async configurar(opciones: OpcionesDeepSeek, esNuevo: boolean): Promise<void> {
    const script=`(() => { const modelo=${JSON.stringify(opciones.modelo ?? null)}; if(${esNuevo} && modelo){document.querySelector('div[data-model-type="'+modelo+'"]')?.click();} const toggles=[...document.querySelectorAll('[aria-pressed]')]; const set=(n,v)=>{if(v==null)return;const b=toggles.find(x=>x.textContent?.includes(n));if(b && (b.getAttribute('aria-pressed')==='true')!==v)b.click();}; set('DeepThink',${JSON.stringify(opciones.deepThink)});set('Search',${JSON.stringify(opciones.search)});return true;})()`;
    await this.transporte.evaluar<boolean>(script);
  }

  async adjuntar(rutas: string[] = []): Promise<ResultadoAdjuntos> {
    if (!rutas.length) return { estrategia: this.nombre, archivos: [] };
    await this.limpiarAdjuntosResiduales();
    if (this.transporte.cdp) {
      try {
        const doc = await this.transporte.cdp<{root:{nodeId:number}}>("DOM.getDocument");
        const nodo = await this.transporte.cdp<{nodeId:number}>("DOM.querySelector", { nodeId: doc.root.nodeId, selector: 'input[type="file"]' });
        if (!nodo.nodeId) throw new ErrorPaginaProveedor("No se encontró el input de archivos de DeepSeek");
        await this.transporte.cdp("DOM.setFileInputFiles", { nodeId: nodo.nodeId, files: rutas.map(ruta => resolve(ruta)) });
        return { estrategia: this.nombre, archivos: [...rutas] };
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        if (!/not allowed|denied|setFileInputFiles/i.test(mensaje)) throw error;
      }
    }
    for (const ruta of rutas) await this.adjuntarPorDom(ruta);
    return { estrategia: "deepseek-dom-data-transfer", archivos: [...rutas] };
  }


  private async limpiarAdjuntosResiduales(): Promise<void> {
    for (let ronda = 0; ronda < 12; ronda++) {
      const resultado = await this.transporte.evaluar<{cerrados:number;restantes:number}>(`(() => {
        const cierres = [...document.querySelectorAll('div[tabindex="0"]')]
          .filter(e => e.querySelector('svg path[d^="M10.6074 4.40278"]'));
        for (const cierre of cierres) cierre.click();
        const restantes = [...document.querySelectorAll('div')]
          .filter(e => {
            const texto = (e.innerText || e.textContent || '').trim();
            return texto.startsWith('contexto-') && texto.includes('.txt') && texto.length < 180;
          }).length;
        return { cerrados: cierres.length, restantes };
      })()`);
      if ((resultado.value?.restantes ?? 0) === 0) return;
      await this.pausa(250);
    }
    const restantes = await this.transporte.evaluar<number>(`[...document.querySelectorAll('div')].filter(e => { const texto=(e.innerText||e.textContent||'').trim(); return texto.startsWith('contexto-') && texto.includes('.txt') && texto.length < 180; }).length`);
    if ((restantes.value ?? 0) > 0) throw new ErrorPaginaProveedor('DeepSeek no pudo limpiar los adjuntos anteriores');
  }

  private async adjuntarPorDom(ruta: string): Promise<void> {
    const nombre = basename(ruta);
    const detectado = detectarTipoArchivo(ruta);
    if (!detectado.soportado) throw new ErrorPaginaProveedor(`Archivo no soportado: ${nombre} (${detectado.motivo})`);
    const base64 = readFileSync(ruta).toString("base64");
    const clave = `__capiDeepSeekArchivo_${crypto.randomUUID().replaceAll("-", "")}`;
    await this.transporte.evaluar(`window[${JSON.stringify(clave)}]=[]`);
    for (let inicio = 0; inicio < base64.length; inicio += TAMANO_FRAGMENTO_BASE64) {
      await this.transporte.evaluar(`window[${JSON.stringify(clave)}].push(${JSON.stringify(base64.slice(inicio, inicio + TAMANO_FRAGMENTO_BASE64))})`);
    }
    const resultado = await this.transporte.evaluar<{ok:boolean;error?:string}>(`(() => {
      const input = document.querySelector('input[type="file"]');
      if (!input) return {ok:false,error:'No se encontró el input de archivos de DeepSeek'};
      const binario = atob(window[${JSON.stringify(clave)}].join('')); delete window[${JSON.stringify(clave)}];
      const bytes = new Uint8Array(binario.length); for(let i=0;i<binario.length;i++) bytes[i]=binario.charCodeAt(i);
      const archivo = new File([bytes], ${JSON.stringify(nombre)}, {type:${JSON.stringify(detectado.mime)},lastModified:Date.now()});
      const transferencia = new DataTransfer(); transferencia.items.add(archivo);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files').set.call(input,transferencia.files);
      input.dispatchEvent(new Event('change',{bubbles:true}));
      return {ok:true};
    })()`);
    if (!resultado.value?.ok) throw new ErrorPaginaProveedor(resultado.value?.error ?? `DeepSeek rechazó ${nombre}`);
    for (let i=0;i<180;i++) {
      const estado = await this.transporte.evaluar<{visible:boolean;procesando:boolean;error:string}>(`(() => {
        const texto=document.body.innerText||''; return {
          visible:texto.includes(${JSON.stringify(nombre)}) || texto.includes(${JSON.stringify(nombre.replace(/\.[^.]+$/i,""))}) || [...document.images].some(i => (i.alt || '').includes(${JSON.stringify(nombre)})),
          procesando:/Uploading|Parsing(?: file)?|Pending|Analizando|Procesando/i.test(texto),
          error:[...document.querySelectorAll('[role="alert"],[class*="error"]')].map(e=>(e.innerText||'').trim()).filter(Boolean).at(-1)||''
        };
      })()`);
      if (estado.value?.error) throw new ErrorPaginaProveedor(`DeepSeek no pudo procesar ${nombre}: ${estado.value.error}`);
      if (estado.value?.visible && !estado.value.procesando) { await this.pausa(3000); return; }
      await this.pausa(500);
    }
    throw new ErrorPaginaProveedor(`DeepSeek no confirmó el procesamiento de ${nombre}`);
  }

  async enviar(prompt: string): Promise<void> {
    const rutaInicial = (await this.transporte.evaluar<string>('location.pathname')).value ?? '';
    const resultado = await this.transporte.evaluar<{ok:boolean;error?:string;x?:number;y?:number}>(scriptEnviarPromptDeepSeek(prompt));
    if (!resultado.value?.ok) throw new ErrorPaginaProveedor(resultado.value?.error ?? 'No se pudo enviar el prompt a DeepSeek');
    if (this.transporte.cdp && Number.isFinite(resultado.value.x) && Number.isFinite(resultado.value.y)) {
      const x = resultado.value.x as number;
      const y = resultado.value.y as number;
      try {
        await this.transporte.cdp('Input.dispatchMouseEvent', { type:'mouseMoved', x, y });
        await this.transporte.cdp('Input.dispatchMouseEvent', { type:'mousePressed', x, y, button:'left', clickCount:1 });
        await this.transporte.cdp('Input.dispatchMouseEvent', { type:'mouseReleased', x, y, button:'left', clickCount:1 });
      } catch {
        await this.transporte.evaluar(`document.elementFromPoint(${x},${y})?.click()`);
      }
    }
    await this.transporte.evaluar(`(() => {
      const textarea = document.querySelector('textarea[name="search"]');
      const compositor = textarea?.closest('form') || textarea?.parentElement?.parentElement?.parentElement || document;
      const btn = [...compositor.querySelectorAll('div[role="button"], button')].find(b => {
        const r = b.getBoundingClientRect(); const s = getComputedStyle(b);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && !b.disabled;
      });
      btn?.click();
    })()`);
    for (let intento = 0; intento < 80; intento++) {
      const estado = await this.transporte.evaluar<{vacio:boolean;conversacionNueva:boolean}>(`(() => {
        const textarea = document.querySelector('textarea[name="search"]');
        return { vacio: !textarea || textarea.value.trim() === '', conversacionNueva: location.pathname.includes('/a/chat/s/') && location.pathname !== ${JSON.stringify(rutaInicial)} };
      })()`);
      if (estado.value?.vacio || estado.value?.conversacionNueva) return;
      if (intento === 20) {
        await this.transporte.evaluar(`(() => {
          const textarea = document.querySelector('textarea[name="search"]');
          textarea?.focus();
          textarea?.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
          textarea?.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
          return true;
        })()`);
      }
      await this.pausa(100);
    }
    throw new ErrorPaginaProveedor('DeepSeek no inició el envío tras click y fallback Enter');
  }
}
