export interface ResultadoEvaluacion<T> { value?: T; }
export interface SnapshotAccesibilidad { url: string; title: string; tree: unknown; }

export interface TransporteNavegador {
  estaDisponible(): Promise<boolean>;
  seleccionarPestanaActiva?(url?: string): Promise<void>;
  seleccionarPestanaPorHost?(host: string): Promise<boolean>;
  subirArchivos?(selector: string, archivos: string[]): Promise<void>;
  rellenar?(selector: string, valor: string): Promise<void>;
  click?(selector: string): Promise<void>;
  navegar(url: string, nuevaPestana?: boolean, titulo?: string): Promise<void>;
  evaluar<T>(codigo: string): Promise<ResultadoEvaluacion<T>>;
  snapshotAccesibilidad?(): Promise<SnapshotAccesibilidad>;
  cdp?<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  recuperarPestana?(host:string,url?:string):Promise<boolean>;
  red?(cmd:"start"|"stop"|"list"|"detail",opciones?:Record<string,unknown>):Promise<unknown>;
  listarRedSaneada?():Promise<unknown[]>;
  cerrarSesion?(): Promise<void>;
}
