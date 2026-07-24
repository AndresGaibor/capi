import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function archivosTs(dir: string): Promise<string[]> {
  const resultado: string[] = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) resultado.push(...await archivosTs(ruta));
    else if (entrada.name.endsWith(".ts")) resultado.push(ruta);
  }
  return resultado;
}

test("núcleo no depende de capas externas", async () => {
  for (const archivo of await archivosTs("src/nucleo")) {
    const texto = await readFile(archivo, "utf8");
    expect(texto).not.toMatch(/from ["'].*(proveedores|plataforma|entradas|adaptadores|comandos|di)\//);
  }
});

test("módulos no contienen selectores DOM ni fetch", async () => {
  for (const archivo of await archivosTs("src/modulos")) {
    const texto = await readFile(archivo, "utf8");
    expect(texto).not.toContain("querySelector");
    expect(texto).not.toContain("fetch(");
  }
});
