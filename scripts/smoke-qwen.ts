import { ejecutarSmokeTextoYContinuidad } from "./lib/smokeDeterminista";

const proveedor = (process.argv[2] ?? "qwen") as "qwen" | "deepseek";
if (!new Set(["qwen", "deepseek"]).has(proveedor)) throw new Error("Proveedor debe ser qwen o deepseek");
const modelo = proveedor === "qwen" ? (process.env.CAPI_QWEN_SMOKE_MODEL ?? "preview") : (process.env.CAPI_DEEPSEEK_SMOKE_MODEL ?? "default");

console.log(JSON.stringify(await ejecutarSmokeTextoYContinuidad({ proveedor, modelo })));
