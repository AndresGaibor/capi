import type { EstrategiaAdjuntos, ResultadoAdjuntos } from "../../../nucleo/archivos/EstrategiaAdjuntos";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { QwenAdjuntos } from "./QwenAdjuntos";
import { QwenControlEnvio } from "./QwenControlEnvio";

/** Fachada compatible que reúne adjuntos y control de envío de Qwen. */
export class QwenEnvio implements EstrategiaAdjuntos {
  readonly nombre = "qwen-dom-data-transfer";
  private readonly adjuntos: QwenAdjuntos;
  private readonly control: QwenControlEnvio;

  constructor(
    transporte: TransporteNavegador,
    pausa: (ms: number) => Promise<unknown> = (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
  ) {
    this.adjuntos = new QwenAdjuntos(transporte, pausa);
    this.control = new QwenControlEnvio(transporte, pausa);
  }

  adjuntar(rutas: string[] = []): Promise<ResultadoAdjuntos> {
    return this.adjuntos.adjuntar(rutas);
  }

  enviar(prompt: string): Promise<void> {
    return this.control.enviar(prompt);
  }
}
