import { TransporteWebBridge } from "../src/plataforma/webbridge/TransporteWebBridge";

const maximoIntentos = 3;
const transporte = new TransporteWebBridge();

for (let intento = 1; intento <= maximoIntentos; intento++) {
  console.log(`\nSmoke Qwen: intento ${intento}/${maximoIntentos}`);
  const proceso = Bun.spawnSync([
    "bun", "run", "src/cli.ts", "chat", "enviar",
    "--proveedor", "qwen", "--modelo", "preview", "--nueva",
    "Responde solamente con la palabra QWEN_OK",
  ], { stdout: "pipe", stderr: "pipe" });

  const salida = proceso.stdout.toString();
  const error = proceso.stderr.toString();
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

  const transitorio = /no produjo respuesta|awaiting-response|respuesta vacía|alta demanda|issue connecting/i.test(`${salida}\n${error}`)
    || !estado.value?.respuesta.includes("QWEN_OK");
  if (!transitorio) process.exit(proceso.exitCode || 1);
}

console.error(`Qwen no respondió correctamente tras ${maximoIntentos} intentos.`);
process.exit(1);
