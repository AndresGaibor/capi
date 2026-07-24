export interface ResultadoEvaluacion<T> { value?: T; }

export interface TransporteNavegador {
  estaDisponible(): Promise<boolean>;
  navegar(url: string, nuevaPestana?: boolean, titulo?: string): Promise<void>;
  evaluar<T>(codigo: string): Promise<ResultadoEvaluacion<T>>;
  cdp?<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  cerrarSesion?(): Promise<void>;
}
