export function obtenerDiffGit(rutaProyecto: string): string {
  const ejecutar = (args: string[]) => {
    const proceso = Bun.spawnSync(["git", "-C", rutaProyecto, ...args], { stderr: "ignore" });
    return proceso.exitCode === 0 ? proceso.stdout.toString() : "";
  };
  const staged = ejecutar(["diff", "--cached", "--no-ext-diff", "--"]);
  const unstaged = ejecutar(["diff", "--no-ext-diff", "--"]);
  return [staged && "# GIT DIFF --CACHED\n" + staged, unstaged && "# GIT DIFF\n" + unstaged].filter(Boolean).join("\n");
}
