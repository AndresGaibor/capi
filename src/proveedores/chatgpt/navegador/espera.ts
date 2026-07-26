export class ErrorTiempoEsperaAgotado extends Error {
  constructor(
    public readonly operacion: string,
    public readonly timeoutMs: number,
    public readonly ultimoEstado?: unknown,
  ) {
    super(`La operacion "${operacion}" supero el tiempo maximo de ${timeoutMs}ms`);
    this.name = "ErrorTiempoEsperaAgotado";
  }
}

export class ErrorOperacionCancelada extends Error {
  constructor(public readonly operacion: string) {
    super(`La operacion "${operacion}" fue cancelada`);
    this.name = "ErrorOperacionCancelada";
  }
}

export interface ProgresoEspera {
  operacion: string;
  transcurridoMs: number;
  restanteMs: number;
  intento: number;
  ultimoEstado?: unknown;
}

export interface OpcionesEsperarHasta<T> {
  operacion: string;
  verificar: () => Promise<T>;
  completado: (resultado: T) => boolean;
  timeoutMs: number;
  intervaloMs?: number;
  signal?: AbortSignal;
  alProgresar?: (progreso: ProgresoEspera) => void;
  intervaloFeedbackMs?: number;
}

export async function esperarHasta<T>(opciones: OpcionesEsperarHasta<T>): Promise<T> {
  const intervaloMs = opciones.intervaloMs ?? 500;
  const intervaloFeedbackMs = opciones.intervaloFeedbackMs ?? 1000;
  const inicio = Date.now();
  const limite = inicio + opciones.timeoutMs;
  let siguienteFeedback = inicio;
  let intento = 0;
  let ultimoEstado: T | undefined;

  while (Date.now() < limite) {
    if (opciones.signal?.aborted) throw new ErrorOperacionCancelada(opciones.operacion);
    intento++;
    ultimoEstado = await opciones.verificar();
    if (opciones.completado(ultimoEstado)) return ultimoEstado;
    const ahora = Date.now();
    if (ahora >= siguienteFeedback) {
      opciones.alProgresar?.({ operacion: opciones.operacion, transcurridoMs: ahora - inicio, restanteMs: Math.max(0, limite - ahora), intento, ultimoEstado });
      siguienteFeedback = ahora + intervaloFeedbackMs;
    }
    const esperaRestante = Math.min(intervaloMs, limite - Date.now());
    if (esperaRestante > 0) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, esperaRestante);
        const cancelar = () => { clearTimeout(timeout); reject(new ErrorOperacionCancelada(opciones.operacion)); };
        opciones.signal?.addEventListener("abort", cancelar, { once: true });
      });
    }
  }
  throw new ErrorTiempoEsperaAgotado(opciones.operacion, opciones.timeoutMs, ultimoEstado);
}
