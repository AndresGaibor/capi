import { describe, expect, test } from "bun:test";

describe("tareas limpiar — preview sin --confirmar", () => {
  test("sin --confirmar muestra dry-run con candidatas", async () => {
    const { stdout } = await Bun.spawn(["bun", "run", "src/cli.ts", "tareas", "limpiar", "--anteriores-a", "1d", "--output", "json"], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
    const out = await new Response(stdout).text();
    const json = JSON.parse(out);
    expect(json.ok).toBe(true);
    expect(json.command).toBe("tasks.clean.dry-run");
    expect(json.data.totalEjecuciones).toBeGreaterThanOrEqual(0);
    expect(typeof json.data.candidatasEliminables).toBe("number");
    expect(json.data.siguientePaso).toContain("--confirmar");
  });

  test("con --confirmar ejecuta la limpieza", async () => {
    const { stdout } = await Bun.spawn(["bun", "run", "src/cli.ts", "tareas", "limpiar", "--anteriores-a", "1d", "--confirmar", "--output", "json"], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
    const out = await new Response(stdout).text();
    const json = JSON.parse(out);
    expect(json.ok).toBe(true);
    expect(json.command).toBe("tasks.clean");
    expect(typeof json.data.eliminadas).toBe("number");
    expect(typeof json.data.restantes).toBe("number");
  });

  test("duración inválida produce error con sugerencia", async () => {
    const { stdout } = await Bun.spawn(["bun", "run", "src/cli.ts", "tareas", "limpiar", "--anteriores-a", "invalido", "--output", "json"], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
    const out = await new Response(stdout).text();
    const json = JSON.parse(out);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("ARGUMENTOS_INVALIDOS");
    expect(json.suggestions.length).toBeGreaterThan(0);
  });
});

describe("estado limpiar — preview sin --confirmar", () => {
  test("sin --confirmar muestra dry-run con metricas", async () => {
    const { stdout } = await Bun.spawn(["bun", "run", "src/cli.ts", "estado", "limpiar", "--capas", "cache", "--output", "json"], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
    const out = await new Response(stdout).text();
    const json = JSON.parse(out);
    expect(json.ok).toBe(true);
    expect(json.command).toBe("state.clean.dry-run");
    expect(json.data.capasSeleccionadas).toContain("cache");
    expect(json.data.siguientePaso).toContain("--confirmar");
  });

  test("con --confirmar ejecuta la limpieza", async () => {
    const { stdout } = await Bun.spawn(["bun", "run", "src/cli.ts", "estado", "limpiar", "--capas", "cache", "--confirmar", "--output", "json"], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
    const out = await new Response(stdout).text();
    const json = JSON.parse(out);
    expect(json.ok).toBe(true);
    expect(json.command).toBe("state.clean");
    expect(typeof json.data.eliminadas).toBe("object");
  });

  test("capa inválida produce error", async () => {
    const { stdout } = await Bun.spawn(["bun", "run", "src/cli.ts", "estado", "limpiar", "--capas", "invalida", "--output", "json"], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
    const out = await new Response(stdout).text();
    const json = JSON.parse(out);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("ARGUMENTOS_INVALIDOS");
  });
});
