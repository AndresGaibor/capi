import type { EventoStreaming } from "../../../nucleo/chat/EventoStreaming";
import type { PeticionChat } from "../../../nucleo/chat/PeticionChat";
import type { ProveedorChat } from "../../../nucleo/proveedores/ProveedorChat";
import {
  esErrorTransitorioProveedor,
  sugerenciaProveedorAlternativo,
  type IntentoProveedor,
} from "./PoliticaRecuperacionProveedor";
import { EjecutarStreamingChat } from "./EjecutarStreamingChat";

export class EjecutarIntentosChat {
  respuesta = "";
  modelo?: string;
  conversacionId?: string;

  async *ejecutar(
    proveedor: ProveedorChat,
    peticion: PeticionChat,
    intentos: IntentoProveedor[],
    conversacionId: string | undefined,
    candidatas: number,
  ): AsyncGenerator<EventoStreaming> {
    let ultimoError: unknown;

    for (let indice = 0; indice < intentos.length; indice++) {
      const intento = intentos[indice]!;
      let emitioRespuesta = false;

      if (indice > 0) {
        yield {
          tipo: "inicio",
          mensaje: `Alta demanda detectada. Reintentando con ${intento.modelo ?? "modelo predeterminado"}...`,
        };
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      try {
        const streaming = new EjecutarStreamingChat();
        for await (const evento of streaming.ejecutar(
          proveedor,
          {
            ...peticion,
            modelo: intento.modelo,
            nuevaPestana: indice > 0,
          },
          conversacionId,
        )) {
          if (evento.tipo === "respuesta") emitioRespuesta = true;
          yield evento;
        }

        this.respuesta += streaming.respuesta;
        this.modelo = streaming.modelo;
        this.conversacionId = streaming.conversacionId;
        return;
      } catch (error) {
        ultimoError = error;
        // Nunca reintentamos después de emitir texto: el segundo intento duplicaría la respuesta.
        if (
          emitioRespuesta ||
          !esErrorTransitorioProveedor(error) ||
          indice === intentos.length - 1
        )
          break;
      }
    }

    const mensaje =
      ultimoError instanceof Error ? ultimoError.message : String(ultimoError);
    throw new Error(
      `${mensaje}\n${sugerenciaProveedorAlternativo(proveedor.id)}`,
    );
  }
}
