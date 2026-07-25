import { readFileSync } from "node:fs";

export class RegistroChatHistorial {
  constructor(
    private readonly repositorio: {
      iniciarEjecucionHistorial: (
        entrada: {
          id: string;
          proyectoLocalId: string;
          proveedor: string;
          modelo?: string;
          conversacionId?: string;
          rama?: string;
          commitGit?: string;
          contextoHash?: string;
          archivos?: string[];
        },
        ahora?: number,
      ) => void;
      finalizarEjecucionHistorial: (
        id: string,
        entrada: {
          estado: "completada" | "pausada" | "fallida";
          conversacionId?: string;
          modelo?: string;
          contextoHash?: string;
          archivos?: string[];
          respuestaCaracteres?: number;
          error?: string;
        },
        ahora?: number,
      ) => void;
      registrarConversacion: (
        entrada: {
          id: string;
          proveedor: string;
          proyectoLocalId: string;
          titulo?: string;
          modelo?: string;
        },
        ahora?: number,
      ) => void;
      marcarConversacionPrincipal: (id: string, proveedor: string, proyectoLocalId: string) => void;
      guardarSnapshotContexto: (
        proyectoLocalId: string,
        proveedor: string,
        conversacionId: string,
        archivos: Array<{ ruta: string; hash: string }>,
        ahora?: number,
      ) => void;
      registrarAdjuntosConfirmados: (
        proyectoLocalId: string,
        proveedor: string,
        conversacionId: string,
        archivos: Array<{ hash: string; ruta: string }>,
        ahora?: number,
      ) => void;
      obtenerResumenConversacion: (
        proyectoLocalId: string,
        proveedor: string,
        conversacionId: string,
      ) => string | null;
      guardarResumenConversacion: (
        proyectoLocalId: string,
        proveedor: string,
        conversacionId: string,
        resumen: string,
        ahora?: number,
      ) => void;
    },
  ) {}

  iniciar(datos: {
    historialId: string;
    proyectoId: string;
    proveedorId: string;
    modelo?: string;
    conversacionId?: string;
    rama?: string;
    commitGit?: string;
    contextoHash?: string;
    archivos: string[];
  }): void {
    this.repositorio.iniciarEjecucionHistorial({
      id: datos.historialId,
      proyectoLocalId: datos.proyectoId,
      proveedor: datos.proveedorId,
      modelo: datos.modelo,
      conversacionId: datos.conversacionId,
      rama: datos.rama,
      commitGit: datos.commitGit,
      contextoHash: datos.contextoHash,
      archivos: datos.archivos,
    });
  }

  registrarConversacionYAdjuntos(datos: {
    conversacionId: string;
    proyectoId: string;
    proveedorId: string;
    modelo?: string;
    archivos: string[];
    adjuntosNativos: string[];
    paquete?: { archivos?: Array<{ ruta: string; hash: string }> };
    prompt: string;
    respuesta: string;
    hacerPrincipal?: boolean;
  }): void {
    this.repositorio.registrarConversacion({
      id: datos.conversacionId,
      proveedor: datos.proveedorId,
      proyectoLocalId: datos.proyectoId,
      modelo: datos.modelo,
    });

    if (datos.hacerPrincipal) {
      this.repositorio.marcarConversacionPrincipal(
        datos.conversacionId,
        datos.proveedorId,
        datos.proyectoId,
      );
    }

    if (datos.paquete?.archivos?.length) {
      this.repositorio.guardarSnapshotContexto(
        datos.proyectoId,
        datos.proveedorId,
        datos.conversacionId,
        datos.paquete.archivos,
      );
      this.repositorio.registrarAdjuntosConfirmados(
        datos.proyectoId,
        datos.proveedorId,
        datos.conversacionId,
        datos.paquete.archivos,
      );
    }

    if (datos.adjuntosNativos.length) {
      const nativos = datos.adjuntosNativos.map((ruta) =>
        this.hashAdjunto(ruta),
      );
      this.repositorio.registrarAdjuntosConfirmados(
        datos.proyectoId,
        datos.proveedorId,
        datos.conversacionId,
        nativos,
      );
    }

    const resumenPrevio = this.repositorio.obtenerResumenConversacion(
      datos.proyectoId,
      datos.proveedorId,
      datos.conversacionId,
    );
    // Estos límites mantienen el resumen útil sin permitir que crezca indefinidamente.
    const bloque = `## ${new Date().toISOString()}\n\n**Solicitud:** ${datos.prompt.slice(0, 800)}\n\n**Resultado:** ${datos.respuesta.slice(0, 2400)}\n\n**Archivos:** ${datos.archivos.join(", ") || "ninguno"}`;
    this.repositorio.guardarResumenConversacion(
      datos.proyectoId,
      datos.proveedorId,
      datos.conversacionId,
      `${resumenPrevio ? `${resumenPrevio}\n\n` : ""}${bloque}`.slice(-12000),
    );
  }

  private hashAdjunto(ruta: string): { ruta: string; hash: string } {
    return {
      ruta,
      hash: new Bun.CryptoHasher("sha256")
        .update(readFileSync(ruta))
        .digest("hex"),
    };
  }

  finalizar(datos: {
    historialId: string;
    estado: "completada" | "pausada" | "fallida";
    conversacionId?: string;
    modelo?: string;
    contextoHash?: string;
    archivos: string[];
    respuestaCaracteres: number;
    error?: string;
  }): void {
    this.repositorio.finalizarEjecucionHistorial(datos.historialId, {
      estado: datos.estado,
      conversacionId: datos.conversacionId,
      modelo: datos.modelo,
      contextoHash: datos.contextoHash,
      archivos: datos.archivos,
      respuestaCaracteres: datos.respuestaCaracteres,
      error: datos.error,
    });
  }
}
