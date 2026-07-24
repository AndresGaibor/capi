import { expect, test } from "bun:test";

test("discover devuelve JSON estricto y versionado", () => {
  const p=Bun.spawnSync(["bun","run","src/cli.ts","discover","--output","json"],{stdout:"pipe",stderr:"pipe"});
  expect(p.exitCode).toBe(0);
  const body=JSON.parse(p.stdout.toString());
  expect(body.protocol).toBe("capi.agent.v1");
  expect(body.data.commands.some((c:any)=>c.name==="chat.send")).toBeTrue();
});

test("chat dry-run no usa navegador y explica la selección", () => {
  const dir=`/tmp/capi-agent-${crypto.randomUUID()}`;
  const p=Bun.spawnSync(["bun","run","src/cli.ts","chat","enviar","--dry-run","--output","json","hola"],{stdout:"pipe",stderr:"pipe",env:{...process.env,CAPI_DATA_DIR:dir}});
  expect(p.exitCode).toBe(0);
  const body=JSON.parse(p.stdout.toString());
  expect(body.command).toBe("chat.send.dry-run");
  expect(body.data.actions).toContain("adquirir lease");
});

test("contexto empaquetar devuelve un único archivo en JSON", () => {
  const proceso = Bun.spawnSync(["bun", "run", "src/cli.ts", "contexto", "empaquetar", "README.md", "--limite", "20000", "--output", "json"], { cwd: process.cwd() });
  expect(proceso.exitCode).toBe(0);
  const salida = JSON.parse(proceso.stdout.toString());
  expect(salida.protocol).toBe("capi.agent.v1");
  expect(salida.data.ruta.endsWith(".txt")).toBeTrue();
  expect(salida.data.archivosIncluidos).toBe(1);
});
