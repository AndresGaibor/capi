export interface PeticionChat {
  conversacionId?: string;
  prompt: string;
  modelo?: string;
  archivos?: string[];
  contexto?: {
    empaquetar?: boolean;
    incluirDiff?: boolean;
    maxBytes?: number;
    cwd?: string;
    automatico?: boolean;
    incremental?: boolean;
    incluirResumen?: boolean;
  };
  nuevaPestana?: boolean;
  forzarNueva?: boolean;
  permitirFallback?: boolean;
  timeoutMs?: number;
  opciones?: {
    razonamiento?: boolean;
    busquedaWeb?: boolean;
  };
}
