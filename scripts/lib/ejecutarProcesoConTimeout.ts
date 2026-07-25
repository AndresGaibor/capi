export interface ResultadoProceso {
  stdout: string;
  stderr: string;
  exitCode: number;
  timeout: boolean;
}

export interface OpcionesProcesoConTimeout {
  cwd?: string;
  env?: Record<string, string>;
}

export async function ejecutarProcesoConTimeout(
  comando: string[],
  timeoutMs: number,
  opciones?: OpcionesProcesoConTimeout | Record<string, string>,
): Promise<ResultadoProceso> {
  const procesoOpciones: OpcionesProcesoConTimeout = opciones && ("cwd" in opciones || "env" in opciones)
    ? opciones as OpcionesProcesoConTimeout
    : { env: opciones as Record<string, string> | undefined };
  const proceso = Bun.spawn(comando, {
    stdout: "pipe",
    stderr: "pipe",
    cwd: procesoOpciones.cwd,
    env: { ...process.env, ...procesoOpciones.env },
  });

  let timeout = false;
  const temporizador = setTimeout(() => {
    timeout = true;
    proceso.kill("SIGTERM");
  }, timeoutMs);

  const [exitCode, stdout, stderr] = await Promise.all([
    proceso.exited,
    new Response(proceso.stdout).text(),
    new Response(proceso.stderr).text(),
  ]);
  clearTimeout(temporizador);

  return { stdout, stderr, exitCode, timeout };
}
