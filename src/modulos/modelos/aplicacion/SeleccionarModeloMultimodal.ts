import { CAPACIDADES_MULTIMODALES, capacidadMultimodal, type Modalidad } from "../../../nucleo/proveedores/CapacidadesMultimodales";

export function seleccionarModeloMultimodal(
  proveedor: string,
  modelo: string | undefined,
  modalidad: Modalidad,
  mimes: string[] = [],
  estricto = false,
): string | undefined {
  const actual = capacidadMultimodal(proveedor, modelo);
  if (actual && actual.modalidades.includes(modalidad) && mimes.every((mime) => actual.mimeAceptados.includes(mime))) return actual.modelo;
  if (estricto && modelo) {
    throw new Error(`El modelo ${modelo} de ${proveedor} no es compatible con ${modalidad}${mimes.length ? ` (${mimes.join(", ")})` : ""}`);
  }
  const candidato = CAPACIDADES_MULTIMODALES.find((x) =>
    x.proveedor === proveedor.toLowerCase()
    && x.modalidades.includes(modalidad)
    && mimes.every((mime) => x.mimeAceptados.includes(mime)),
  );
  if (candidato) return candidato.modelo;
  throw new Error(`El proveedor ${proveedor} no tiene un modelo compatible con ${modalidad}${mimes.length ? ` (${mimes.join(", ")})` : ""}`);
}

export function intentosMultimodales(proveedor: string, modalidad: Modalidad) {
  return CAPACIDADES_MULTIMODALES
    .filter((x) => x.proveedor === proveedor.toLowerCase() && x.modalidades.includes(modalidad))
    .map((x) => x.modelo);
}
