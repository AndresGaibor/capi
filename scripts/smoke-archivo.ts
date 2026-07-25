import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ejecutarProcesoConTimeout } from "./lib/ejecutarProcesoConTimeout";
import { crearMarcadorSmoke, evaluarSmoke } from "./lib/smokeDeterminista";

const proveedor = (process.argv[2] ?? "deepseek") as "qwen" | "deepseek";
if (!new Set(["qwen", "deepseek"]).has(proveedor)) throw new Error("Proveedor debe ser qwen o deepseek");
const marcador = crearMarcadorSmoke("FILE");
const dir = mkdtempSync(join(tmpdir(), "capi-smoke-file-"));
const archivo = join(dir, "contexto-smoke.txt");
writeFileSync(archivo, `El marcador secreto de esta prueba es ${marcador}.\n`);
const modelo = proveedor === "qwen" ? (process.env.CAPI_QWEN_SMOKE_MODEL ?? "max") : "default";
const timeout = Number(process.env.CAPI_SMOKE_TIMEOUT_MS ?? 90_000);
const resultado = await ejecutarProcesoConTimeout([
  "bun", "run", "src/cli.ts", "chat", "--proveedor", proveedor, "--modelo", modelo,
  "--nueva", "--archivo", archivo, "--output", "jsonl", "--no-busqueda", "--no-razonamiento",
  "Lee el archivo adjunto y responde solamente con el marcador exacto que contiene.",
], timeout);
console.log(JSON.stringify(evaluarSmoke(proveedor, marcador, resultado)));
