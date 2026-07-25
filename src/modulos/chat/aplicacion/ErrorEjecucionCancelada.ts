export class ErrorEjecucionCancelada extends Error {
  readonly codigo = "EJECUCION_CANCELADA";

  constructor() {
    super("La ejecución fue cancelada por el usuario");
    this.name = "ErrorEjecucionCancelada";
  }
}

export function esErrorEjecucionCancelada(error: unknown): error is ErrorEjecucionCancelada {
  return error instanceof ErrorEjecucionCancelada
    || Boolean(error && typeof error === "object" && "codigo" in error && (error as { codigo?: unknown }).codigo === "EJECUCION_CANCELADA");
}
