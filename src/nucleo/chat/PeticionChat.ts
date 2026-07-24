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
  };
  nuevaPestana?: boolean;
  forzarNueva?: boolean;
  permitirFallback?: boolean;
  opciones?: {
    razonamiento?: boolean;
    busquedaWeb?: boolean;
  };
}
