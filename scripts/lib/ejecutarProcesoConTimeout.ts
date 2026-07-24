export interface ResultadoProceso {
  stdout: string;
  stderr: string;
  exitCode: number;
  timeout: boolean;
}

export async function ejecutarProcesoConTimeout(
  comando: string[],
  timeoutMs: number,
): Promise<ResultadoProceso> {
  const proceso = Bun.spawn(comando, {
    stdout: "pipe",
    stderr: "pipe",
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
