export class ErrorAplicacion extends Error {
  constructor(message: string, public readonly codigo: string, public readonly causa?: unknown) {
    super(message);
    this.name = new.target.name;
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
