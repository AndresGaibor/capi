export interface PresupuestoContexto {
  proveedor: string;
  modelo: string;
  maxBytes: number;
  origen: "solicitado" | "modelo" | "proveedor" | "predeterminado";
}

const MIB = 1024 * 1024;
const POR_MODELO: Record<string, number> = {
  "qwen:preview": 4 * MIB,
  "qwen:max": 6 * MIB,
  "qwen:plus": 8 * MIB,
  "deepseek:expert": 8 * MIB,
  "deepseek:vision": 4 * MIB,
  "deepseek:default": 4 * MIB,
};
const POR_PROVEEDOR: Record<string, number> = { qwen: 4 * MIB, deepseek: 4 * MIB };

export function resolverPresupuestoContexto(proveedor: string, modelo?: string, solicitado?: number): PresupuestoContexto {
  const p = proveedor.toLowerCase();
  const m = (modelo ?? "default").toLowerCase();
  if (solicitado != null) return { proveedor: p, modelo: m, maxBytes: Math.max(1024, solicitado), origen: "solicitado" };
  const porModelo = POR_MODELO[`${p}:${m}`];
  if (porModelo) return { proveedor: p, modelo: m, maxBytes: porModelo, origen: "modelo" };
  const porProveedor = POR_PROVEEDOR[p];
  if (porProveedor) return { proveedor: p, modelo: m, maxBytes: porProveedor, origen: "proveedor" };
  return { proveedor: p, modelo: m, maxBytes: 4 * MIB, origen: "predeterminado" };
}
