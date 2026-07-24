export interface PeticionChat {
  conversacionId?: string;
  prompt: string;
  modelo?: string;
  archivos?: string[];
  opciones?: {
    razonamiento?: boolean;
    busquedaWeb?: boolean;
  };
}
