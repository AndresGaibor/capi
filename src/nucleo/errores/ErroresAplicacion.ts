export class ErrorAplicacion extends Error {
  constructor(message: string, public readonly codigo: string, public readonly causa?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export interface SugerenciaCAPI { command: string; reason: string; }

export class ErrorCAPI extends ErrorAplicacion {
  readonly retryable: boolean;
  readonly suggestions: SugerenciaCAPI[];
  readonly requestId?: string;
  readonly details?: unknown;
  constructor(opciones: { codigo: string; mensaje: string; retryable?: boolean; suggestions?: SugerenciaCAPI[]; requestId?: string; details?: unknown; causa?: unknown }) {
    super(opciones.mensaje, opciones.codigo, opciones.causa);
    this.retryable = opciones.retryable ?? false;
    this.suggestions = opciones.suggestions ?? [];
    this.requestId = opciones.requestId;
    this.details = opciones.details;
  }
}

export class ErrorOperacionNoPermitida extends ErrorCAPI {
  constructor(mensaje: string, codigo: string = "OPERACION_NO_PERMITIDA") {
    super({ codigo, mensaje, retryable: false });
  }
}

export class ErrorArgumentosInvalidos extends ErrorCAPI {
  constructor(mensaje: string, suggestions: SugerenciaCAPI[] = []) {
    super({ codigo: "ARGUMENTOS_INVALIDOS", mensaje, retryable: false, suggestions });
  }
}

export class ErrorProveedorNoEncontrado extends ErrorAplicacion {
  constructor(id: string) { super(`Proveedor no registrado: ${id}`, "PROVEEDOR_NO_ENCONTRADO"); }
}
export class ErrorCapacidadNoSoportada extends ErrorAplicacion {
  constructor(proveedor: string, capacidad: string) { super(`${proveedor} no soporta ${capacidad}`, "CAPACIDAD_NO_SOPORTADA"); }
}
export class ErrorProveedorNoDisponible extends ErrorAplicacion {
  constructor(proveedor: string) { super(`${proveedor} no está disponible`, "PROVEEDOR_NO_DISPONIBLE"); }
}
export class ErrorTimeoutProveedor extends ErrorAplicacion {
  constructor(mensaje: string) { super(mensaje, "TIMEOUT_PROVEEDOR"); }
}
export class ErrorModeloNoDisponible extends ErrorAplicacion {
  constructor(modelo: string, disponibles: string[] = []) { super(`Modelo no disponible: ${modelo}${disponibles.length ? `. Disponibles: ${disponibles.join(", ")}` : ""}`, "MODELO_NO_DISPONIBLE"); }
}
export class ErrorRespuestaVacia extends ErrorAplicacion {
  constructor(proveedor: string) { super(`${proveedor} terminó de procesar, pero no produjo respuesta`, "RESPUESTA_VACIA"); }
}
export class ErrorPaginaProveedor extends ErrorAplicacion {
  constructor(mensaje: string) { super(mensaje, "PAGINA_PROVEEDOR"); }
}
export class ErrorPreflightProveedor extends ErrorAplicacion {
  constructor(codigo: "SESION_EXPIRADA" | "CAPTCHA_REQUERIDO" | "CONVERSACION_INVALIDA" | "PAGINA_NO_COMPATIBLE" | "SELECTOR_NO_ENCONTRADO" | "PROVEEDOR_OCUPADO", mensaje: string) { super(mensaje, codigo); }
}
