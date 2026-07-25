import type { ResultadoAdjuntos } from "../../../nucleo/archivos/EstrategiaAdjuntos";
import type { GestorPestanas } from "../../../plataforma/webbridge/GestorPestanas";
import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { ModeloChat } from "../../../nucleo/proveedores/ProveedorChat";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import type { OpcionesDeepSeek } from "../tipos";
import { DeepSeekNavegacion } from "./DeepSeekNavegacion";
import { DeepSeekModelos } from "./DeepSeekModelos";
import { DeepSeekEnvio } from "./DeepSeekEnvio";
import { DeepSeekStreaming } from "./DeepSeekStreaming";
import { scriptDiagnosticarPagina } from "../../preflight/scriptDiagnosticarPagina";
export class DeepSeekPaginaChat {
  private readonly transporte: TransporteNavegador;
  private readonly nav:DeepSeekNavegacion; private readonly modelos:DeepSeekModelos; private readonly envio:DeepSeekEnvio; private readonly stream:DeepSeekStreaming;
  constructor(transporte:TransporteNavegador, gestorPestanas?:GestorPestanas){this.transporte=transporte;this.nav=new DeepSeekNavegacion(transporte,undefined,gestorPestanas);this.modelos=new DeepSeekModelos(transporte);this.envio=new DeepSeekEnvio(transporte);this.stream=new DeepSeekStreaming(transporte);}
  verificar(){return this.nav.verificar();} abrir(id?:string,nuevaPestana=false){return this.nav.abrir(id,nuevaPestana);} listarModelos(){return this.modelos.listar();} seleccionarModelo(m:string):Promise<ModeloChat>{return this.modelos.seleccionar(m);} modeloActual(){return this.modelos.actual();}
  async preparar(op:OpcionesDeepSeek,esNuevo:boolean){await this.envio.configurar(op,esNuevo);await this.envio.adjuntar(op.archivos);} enviar(p:string){return this.envio.enviar(p);} observar():AsyncGenerator<EventoStreaming>{return this.stream.observar();} obtenerConversacionActual(){return this.nav.obtenerConversacionActual();}
  async diagnosticar():Promise<Record<string,unknown>> { return (await this.transporte.evaluar<Record<string, unknown>>(scriptDiagnosticarPagina("deepseek"))).value ?? { proveedor:"deepseek",ok:false,codigo:"PAGINA_NO_COMPATIBLE"}; }
}
