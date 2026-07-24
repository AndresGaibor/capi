import { TransporteWebBridge } from "../src/plataforma/webbridge/TransporteWebBridge";
import { ejecutarProcesoConTimeout } from "./lib/ejecutarProcesoConTimeout";

const maximoIntentos = 3;
const timeoutIntentoMs = Number(process.env.CAPI_SMOKE_TIMEOUT_MS ?? 75_000);
const transporte = new TransporteWebBridge();

for (let intento = 1; intento <= maximoIntentos; intento++) {
  console.log(`\nSmoke Qwen: intento ${intento}/${maximoIntentos}`);
  const proceso = await ejecutarProcesoConTimeout([
    "bun", "run", "src/cli.ts", "chat", "enviar",
    "--proveedor", "qwen", "--modelo", "preview", "--nueva",
    "Responde solamente con la palabra QWEN_OK",
  ], timeoutIntentoMs);

  const salida = proceso.stdout;
  const error = proceso.stderr;
  if (proceso.timeout) {
    console.error(`El intento excedió ${timeoutIntentoMs} ms y fue terminado.`);
  }
  process.stdout.write(salida);
  process.stderr.write(error);

  const estado = await transporte.evaluar<{
    host: string;
    modelo: string | null;
    respuesta: string;
  }>(`(() => ({
    host: location.host,
    modelo: document.querySelector('[aria-label="Select Model"]')?.textContent?.trim() || null,
    respuesta: [...document.querySelectorAll('.qwen-chat-message-assistant')].at(-1)?.innerText?.trim() || ''
  }))()`);

  console.log("Validación DOM Qwen:", estado.value);
  const valido = proceso.exitCode === 0
    && estado.value?.host === "chat.qwen.ai"
    && /Qwen3\.(8-Max-Preview|7-Max|7-Plus)/.test(estado.value?.modelo ?? "")
    && estado.value?.respuesta.includes("QWEN_OK");
  if (valido) process.exit(0);

  const transitorio = proceso.timeout
    || /no produjo respuesta|awaiting-response|respuesta vacía|alta demanda|issue connecting/i.test(`${salida}\n${error}`)
    || !estado.value?.respuesta.includes("QWEN_OK");
  if (!transitorio) process.exit(proceso.exitCode || 1);
}

console.error(`Qwen no respondió correctamente tras ${maximoIntentos} intentos.`);
process.exit(1);
