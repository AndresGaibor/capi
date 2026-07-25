export interface ResultadoControlEjecucion {
  procesoId: string;
  ocupacionFallida: boolean;
}

export class ControlEjecucionChat {
  private intervalId?: ReturnType<typeof setInterval>;
  private _procesoId?: string;
  private _proveedorId?: string;
  private _conversacionIdOcupada?: string;
  private leasePerdido = false;

  constructor(
    private readonly repositorio: {
      adquirirEjecucion: (
        procesoId: string,
        ahora: number,
        ttlMs: number,
        pid: number,
        limite: number,
      ) => boolean;
      adquirirOcupacion: (
        conversacionId: string,
        procesoId: string,
        ahora: number,
        ttlMs: number,
        proveedor: string,
        pid: number,
      ) => boolean;
      renovarEjecucion: (
        procesoId: string,
        ahora: number,
        ttlMs: number,
      ) => boolean;
      renovarOcupacion: (
        conversacionId: string,
        procesoId: string,
        ahora: number,
        ttlMs: number,
        proveedor: string,
      ) => boolean;
      liberarEjecucion: (procesoId: string) => void;
      liberarOcupacion: (
        conversacionId: string,
        procesoId: string,
        proveedor: string,
      ) => void;
    },
  ) {}

  get procesoId(): string | undefined {
    return this._procesoId;
  }

  iniciar(
    datos: { proyectoId: string; proveedorId: string; conversacionId?: string },
    opciones: { limiteConcurrentes?: number; ttlMs?: number } = {},
  ): ResultadoControlEjecucion {
    const { limiteConcurrentes = 3, ttlMs = 90_000 } = opciones;
    const ahora = Date.now();
    this._procesoId = `${process.pid}-${crypto.randomUUID()}`;
    this._proveedorId = datos.proveedorId;

    if (
      !this.repositorio.adquirirEjecucion(
        this._procesoId,
        ahora,
        ttlMs,
        process.pid,
        limiteConcurrentes,
      )
    ) {
      this._procesoId = undefined;
      this._proveedorId = undefined;
      throw new Error(
        "Ya existen 3 envíos simultáneos. Espera a que termine uno y vuelve a intentar.",
      );
    }

    let ocupacionFallida = false;
    if (datos.conversacionId) {
      if (
        !this.repositorio.adquirirOcupacion(
          datos.conversacionId,
          this._procesoId,
          ahora,
          ttlMs,
          datos.proveedorId,
          process.pid,
        )
      ) {
        this._proveedorId = undefined;
        ocupacionFallida = true;
        // La ejecución global sigue reservada: el caso de uso cambiará a una conversación nueva.
        this.programarRenovacionEjecucion(ttlMs);
      } else {
        this._conversacionIdOcupada = datos.conversacionId;
        this.programarRenovacionCompleta(ttlMs);
      }
    } else {
      this.programarRenovacionEjecucion(ttlMs);
    }

    return { procesoId: this._procesoId!, ocupacionFallida };
  }

  renovarAhora(ttlMs:number): boolean {
    if (!this._procesoId) return false;
    const ahora=Date.now();
    const ejecucionOk=this.repositorio.renovarEjecucion(this._procesoId,ahora,ttlMs);
    const ocupacionOk=!this._conversacionIdOcupada||!this._proveedorId||this.repositorio.renovarOcupacion(this._conversacionIdOcupada,this._procesoId,ahora,ttlMs,this._proveedorId);
    if(!ejecucionOk||!ocupacionOk) this.leasePerdido=true;
    return ejecucionOk&&ocupacionOk;
  }

  verificarLease(): void { if(this.leasePerdido){ const e=new Error("Se perdió el lease de la ejecución; CAPI no reenviará el prompt"); Object.assign(e,{codigo:"LEASE_PERDIDO"}); throw e; } }

  liberar(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this._conversacionIdOcupada && this._procesoId && this._proveedorId) {
      this.repositorio.liberarOcupacion(
        this._conversacionIdOcupada,
        this._procesoId,
        this._proveedorId,
      );
      this._conversacionIdOcupada = undefined;
    }
    if (this._procesoId) {
      this.repositorio.liberarEjecucion(this._procesoId);
      this._procesoId = undefined;
    }
    this._proveedorId = undefined;
    this.leasePerdido = false;
  }

  private programarRenovacionEjecucion(ttlMs: number): void {
    this.intervalId = setInterval(() => {
      this.renovarAhora(ttlMs);
    }, 30_000);
  }

  private programarRenovacionCompleta(ttlMs: number): void {
    this.intervalId = setInterval(() => {
      this.renovarAhora(ttlMs);
    }, 30_000);
  }
}
