export interface PeticionChat {
  conversacionId?: string;
  prompt: string;
  modelo?: string;
  archivos?: string[];
  nuevaPestana?: boolean;
  forzarNueva?: boolean;
  permitirFallback?: boolean;
  opciones?: {
    razonamiento?: boolean;
    busquedaWeb?: boolean;
  };
}
