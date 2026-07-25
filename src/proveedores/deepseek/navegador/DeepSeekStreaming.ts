import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import { ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { configuracionProveedor } from "../../../configuracion/ConfiguracionProveedores";
import { SupervisorStreamingProveedor } from "../../compartido/SupervisorStreamingProveedor";
import { scriptEstadoStreamingDeepSeek } from "../scripts/estadoStreaming";
import { scriptRespuestaHistorialDeepSeek } from "../scripts/respuestaHistorial";
import type { EstadoStreamingDeepSeek } from "../tipos";
import { convertirRegistroHistoria } from "../servicios/ConvertirRegistroHistoria";
import { fusionarRespuesta } from "../servicios/FusionarRespuesta";
import { respuestaPosteriorAlUltimoUsuario } from "../servicios/CorrelacionarTurnoDeepSeek";

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CFG = configuracionProveedor("deepseek");

export class DeepSeekStreaming {
  constructor(
    private readonly transporte: TransporteNavegador,
    private readonly pausa: (ms: number) => Promise<unknown> = dormir,
    private readonly ahora: () => number = Date.now,
  ) {}

  private async respuestaIndexedDB(id: string): Promise<{ contenido: string; terminado: boolean }> {
    if (!id) return { contenido: "", terminado: false };
    const registro = (await this.transporte.evaluar<unknown>(`new Promise(resolve=>{const q=indexedDB.open('deepseek-chat');q.onerror=()=>resolve(null);q.onsuccess=()=>{const d=q.result;if(!d.objectStoreNames.contains('history-message'))return resolve(null);const g=d.transaction('history-message','readonly').objectStore('history-message').get(${JSON.stringify(id)});g.onerror=()=>resolve(null);g.onsuccess=()=>resolve(g.result??null)}})`)).value;
    const conversacion = convertirRegistroHistoria(registro);
    if (!conversacion) return { contenido: "", terminado: false };
    return respuestaPosteriorAlUltimoUsuario(conversacion.mensajes.map((mensaje) => ({
      rol: mensaje.rol,
      contenido: mensaje.fragmentos
        .filter((fragmento) => fragmento.type === (mensaje.rol === "usuario" ? "REQUEST" : "RESPONSE"))
        .map((fragmento) => fragmento.content)
        .join(""),
      terminado: false,
    })));
  }

  private async respuestaApi(id: string): Promise<{ contenido: string; terminado: boolean }> {
    if (!id) return { contenido: "", terminado: false };
    const resultado = await this.transporte.evaluar<{ contenido: string; terminado: boolean }>(scriptRespuestaHistorialDeepSeek(id));
    const valor = resultado.value;
    return valor && typeof valor.contenido === "string" && typeof valor.terminado === "boolean"
      ? valor
      : { contenido: "", terminado: false };
  }

  async *observar(): AsyncGenerator<EventoStreaming> {
    const id = (await this.transporte.evaluar<string>("location.pathname.split('/a/chat/s/')[1]?.split('?')[0]?.split('#')[0] || ''")).value ?? "";
    let ultimoPensamiento = "";
    let ultimaRespuesta = "";
    let sondeosSinCambio = 0;
    let reintentos = 0;
    let fallos = 0;
    let iteracion = 0;
    let confirmacionesDom = 0;
    let confirmacionesApi = 0;
    let ultimaRespuestaApi = "";
    let confirmacionesIndexed = 0;
    let ultimaRespuestaIndexed = "";
    const supervisor = new SupervisorStreamingProveedor(CFG, this.ahora());

    while (true) {
      iteracion++;
      await this.pausa(CFG.intervaloPollingMs);
      let observacion: EstadoStreamingDeepSeek | undefined;
      try {
        observacion = (await this.transporte.evaluar<EstadoStreamingDeepSeek>(scriptEstadoStreamingDeepSeek())).value;
        fallos = 0;
      } catch {
        fallos++;
        if (fallos >= CFG.maxReintentosConsecutivosAntesRecuperar) {
          yield { tipo: "estado", estado: "desconectado", progresoDetectado: false, estrategia: "dom", detalles: `reintento ${fallos}` };
          await this.transporte.recuperarPestana?.("chat.deepseek.com", id ? `https://chat.deepseek.com/a/chat/s/${id}` : undefined);
        }
        continue;
      }
      if (!observacion) {
        for (const evento of supervisor.observar(`vacio:${fallos}`, "desconocido", this.ahora())) yield evento;
        continue;
      }
      if (observacion.isError) {
        if (reintentos++ < 3) {
          await this.transporte.evaluar("document.querySelector('.ds-button--warning')?.click()");
          await this.pausa(1500);
          continue;
        }
        throw new ErrorPaginaProveedor(observacion.errorMessage);
      }

      const pensamiento = observacion.think ?? "";
      const respuestaDom = observacion.response ?? "";
      const firma = `${pensamiento.length}:${respuestaDom.length}:${observacion.done ? 1 : 0}`;
      for (const evento of supervisor.observar(firma, respuestaDom ? "respondiendo" : pensamiento ? "pensando" : "esperando_respuesta", this.ahora())) yield evento;

      if (pensamiento.startsWith(ultimoPensamiento) && pensamiento.length > ultimoPensamiento.length) {
        yield { tipo: "pensamiento", contenido: pensamiento.slice(ultimoPensamiento.length) };
        ultimoPensamiento = pensamiento;
      }
      const fusionDom = fusionarRespuesta({ contenidoActual: ultimaRespuesta, contenidoEntrante: respuestaDom, fuente: "dom", terminado: observacion.done });
      if (fusionDom.contenido.length > ultimaRespuesta.length) {
        yield { tipo: "respuesta", contenido: fusionDom.contenido.slice(ultimaRespuesta.length), estrategia: observacion.extractionStrategy ?? "dom" };
        ultimaRespuesta = fusionDom.contenido;
        sondeosSinCambio = 0;
      } else if (ultimaRespuesta) {
        sondeosSinCambio++;
      }
      confirmacionesDom = observacion.done && ultimaRespuesta ? confirmacionesDom + 1 : 0;
      if (confirmacionesDom >= 3) {
        yield { tipo: "fin" };
        return;
      }

      if (iteracion >= 4 && iteracion % 2 === 0) {
        const api = await this.respuestaApi(id);
        const fusionApi = fusionarRespuesta({ contenidoActual: ultimaRespuesta, contenidoEntrante: api.contenido, fuente: "api", terminado: api.terminado });
        if (fusionApi.contenido.length > ultimaRespuesta.length) {
          yield { tipo: "respuesta", contenido: fusionApi.contenido.slice(ultimaRespuesta.length), estrategia: "historial" };
          ultimaRespuesta = fusionApi.contenido;
          sondeosSinCambio = 0;
        }
        if (api.terminado && api.contenido) {
          confirmacionesApi = api.contenido === ultimaRespuestaApi ? confirmacionesApi + 1 : 1;
          ultimaRespuestaApi = api.contenido;
          if (confirmacionesApi >= 2) {
            yield { tipo: "fin" };
            return;
          }
        } else {
          confirmacionesApi = 0;
          ultimaRespuestaApi = "";
        }
      }

      if (!ultimaRespuesta && iteracion >= 12 && iteracion % 4 === 0) {
        const indexed = await this.respuestaIndexedDB(id);
        if (indexed.contenido) {
          const fusionIndexed = fusionarRespuesta({ contenidoActual: ultimaRespuesta, contenidoEntrante: indexed.contenido, fuente: "indexeddb", terminado: indexed.terminado });
          if (fusionIndexed.contenido.length > ultimaRespuesta.length) {
            yield { tipo: "respuesta", contenido: fusionIndexed.contenido.slice(ultimaRespuesta.length), estrategia: "historial" };
            ultimaRespuesta = fusionIndexed.contenido;
            sondeosSinCambio = 0;
          }
          confirmacionesIndexed = indexed.contenido === ultimaRespuestaIndexed ? confirmacionesIndexed + 1 : 1;
          ultimaRespuestaIndexed = indexed.contenido;
        } else {
          confirmacionesIndexed = 0;
          ultimaRespuestaIndexed = "";
        }
      }
      if (ultimaRespuesta && (confirmacionesIndexed >= 3 || sondeosSinCambio > 40)) {
        yield { tipo: "fin" };
        return;
      }
    }
  }
}
