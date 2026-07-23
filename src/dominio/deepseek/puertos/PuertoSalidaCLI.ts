export interface PuertoSalidaCLI {
  intro(mensaje: string): void;
  outro(mensaje: string): void;
  cancel(mensaje: string): void;
  info(mensaje: string): void;
  warn(mensaje: string): void;
  error(mensaje: string): void;
  log(mensaje: string): void;
  success(mensaje: string): void;
}
