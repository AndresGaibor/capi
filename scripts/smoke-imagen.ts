import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ejecutarProcesoConTimeout } from "./lib/ejecutarProcesoConTimeout";
import { crearMarcadorSmoke, evaluarSmoke } from "./lib/smokeDeterminista";

const proveedor = (process.argv[2] ?? "qwen") as "qwen" | "deepseek";
const marcador = crearMarcadorSmoke("VISION");
const dir = mkdtempSync(join(tmpdir(), "capi-smoke-vision-"));
const svg = join(dir, "marcador.svg");
const png = join(dir, "marcador.png");
writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="500"><rect width="100%" height="100%" fill="white"/><text x="700" y="280" text-anchor="middle" font-family="Arial,sans-serif" font-size="96" font-weight="700" fill="black">${marcador}</text></svg>`);
const convertido = Bun.spawnSync(["rsvg-convert", "-o", png, svg], { stdout: "pipe", stderr: "pipe" });
if (convertido.exitCode !== 0) throw new Error(`No se pudo generar PNG: ${convertido.stderr.toString()}`);

const modelo = proveedor === "qwen" ? (process.env.CAPI_QWEN_VISION_MODEL ?? "preview") : "vision";
const timeout = Number(process.env.CAPI_SMOKE_VISION_TIMEOUT_MS ?? 180_000);
const argumentos = [
  "bun", "run", "src/cli.ts", "chat", "--proveedor", proveedor, "--modelo", modelo,
  "--nueva", "--imagen", png, "--output", "jsonl", "--no-busqueda", "--no-razonamiento",
  ...(process.env.CAPI_QWEN_VISION_NO_FALLBACK === "1" ? ["--no-fallback"] : []),
  "--timeout", String(timeout - 5000),
  "Lee el texto grande visible en la imagen y responde solamente con el marcador exacto, sin comillas ni explicación.",
];
const resultado = await ejecutarProcesoConTimeout(argumentos, timeout, { CAPI_WEBBRIDGE_SESSION: `capi-vision-${crypto.randomUUID()}` });
console.log(JSON.stringify({ ...evaluarSmoke(proveedor, marcador, resultado), modelo }));
