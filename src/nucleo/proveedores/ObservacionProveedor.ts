export type EstadoProveedorNormalizado="esperando_turno"|"pensando"|"esperando_respuesta"|"respondiendo"|"estabilizando"|"completado"|"error"|"desconectado"|"estancado"|"desconocido";
export type EstrategiaObservacion="dom"|"snapshot"|"red"|"historial"|"tampermonkey";
export interface ObservacionProveedor { estado:EstadoProveedorNormalizado; pensamiento:string; respuesta:string; conversacionId?:string; generando:boolean; progresoDetectado:boolean; estrategia:EstrategiaObservacion; codigoError?:string; }
