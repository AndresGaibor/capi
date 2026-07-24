export interface ResultadoAdjuntos {
  estrategia: string;
  archivos: string[];
}

export interface EstrategiaAdjuntos {
  readonly nombre: string;
  adjuntar(rutas: string[]): Promise<ResultadoAdjuntos>;
}
