import consola from "consola";

export async function ejecutarComando(accion: () => Promise<void> | void, sugerencia?: string): Promise<void> {
  try {
    await accion();
    if (sugerencia) consola.info(`Siguiente acción sugerida: ${sugerencia}`);
  } catch (error) {
    consola.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
