export interface ResultadoProcesoSmoke { exitCode: number; timeout: boolean; stdout: string; stderr: string; }

export function crearMarcadorSmoke(tipo: string, uuid: () => string = () => crypto.randomUUID()): string {
  return `CAPI_${tipo}_${uuid().replaceAll("-", "").toUpperCase()}`;
}

export function evaluarSmoke(proveedor: string, marcador: string, resultado: ResultadoProcesoSmoke): { ok: true; proveedor: string; marcador: string } {
  if (resultado.timeout) throw new Error(`Smoke ${proveedor} excedió el timeout`);
  if (resultado.exitCode !== 0 || !resultado.stdout.includes(marcador)) throw new Error(`Smoke ${proveedor} no devolvió el marcador`);
  return { ok: true, proveedor, marcador };
}
