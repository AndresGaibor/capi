export interface ConfiguracionProveedorWeb {
  intervaloPollingMs:number;
  intervaloSnapshotMs:number;
  intervaloHeartbeatMs:number;
  marcarEstancadaMs:number;
  cancelarPorInactividad:boolean;
  reabrirPestana:boolean;
  recuperarWebBridge:boolean;
  maxReintentosConsecutivosAntesRecuperar:number;
}
export const CONFIGURACION_PROVEEDORES:Record<string,ConfiguracionProveedorWeb>={
  qwen:{intervaloPollingMs:2_000,intervaloSnapshotMs:30_000,intervaloHeartbeatMs:15_000,marcarEstancadaMs:30*60_000,cancelarPorInactividad:false,reabrirPestana:true,recuperarWebBridge:true,maxReintentosConsecutivosAntesRecuperar:3},
  deepseek:{intervaloPollingMs:2_000,intervaloSnapshotMs:30_000,intervaloHeartbeatMs:15_000,marcarEstancadaMs:20*60_000,cancelarPorInactividad:false,reabrirPestana:true,recuperarWebBridge:true,maxReintentosConsecutivosAntesRecuperar:3},
  chatgpt:{intervaloPollingMs:2_000,intervaloSnapshotMs:30_000,intervaloHeartbeatMs:15_000,marcarEstancadaMs:20*60_000,cancelarPorInactividad:false,reabrirPestana:true,recuperarWebBridge:true,maxReintentosConsecutivosAntesRecuperar:3},
};
export const configuracionProveedor=(id:string):ConfiguracionProveedorWeb=>CONFIGURACION_PROVEEDORES[id]??CONFIGURACION_PROVEEDORES.qwen!;
