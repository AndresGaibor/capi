import { ErrorModeloNoDisponible } from "../../../nucleo/errores/ErroresAplicacion";
const MODELOS = ["default", "expert", "vision"] as const;
export type ModeloDeepSeek = typeof MODELOS[number];
export function resolverModeloDeepSeek(modelo?: string): ModeloDeepSeek | undefined {
  if (!modelo) return undefined;
  const normalizado = modelo.trim().toLowerCase();
  if ((MODELOS as readonly string[]).includes(normalizado)) return normalizado as ModeloDeepSeek;
  throw new ErrorModeloNoDisponible(modelo, [...MODELOS]);
}
export function listarModelosDeepSeek() { return MODELOS.map((id) => ({ id, nombre: id })); }
