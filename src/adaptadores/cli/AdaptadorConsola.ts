import type { PuertoSalidaCLI } from "../../dominio/deepseek/puertos/PuertoSalidaCLI";
import * as prompts from "@clack/prompts";
import consola from "consola";

export class AdaptadorConsola implements PuertoSalidaCLI {
  intro(mensaje: string): void {
    prompts.intro(mensaje);
  }

  outro(mensaje: string): void {
    prompts.outro(mensaje);
  }

  cancel(mensaje: string): void {
    prompts.cancel(mensaje);
  }

  info(mensaje: string): void {
    consola.info(mensaje);
  }

  warn(mensaje: string): void {
    consola.warn(mensaje);
  }

  error(mensaje: string): void {
    consola.error(mensaje);
  }

  success(mensaje: string): void {
    consola.success(mensaje);
  }

  log(mensaje: string): void {
    consola.log(mensaje);
  }
}
