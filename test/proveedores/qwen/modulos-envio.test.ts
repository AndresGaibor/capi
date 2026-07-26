import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QwenAdjuntos } from "../../../src/proveedores/qwen/navegador/QwenAdjuntos";
import { QwenControlEnvio } from "../../../src/proveedores/qwen/navegador/QwenControlEnvio";

class TransporteQwen {
  scripts: string[] = [];

  async evaluar<T>(codigo: string) {
    this.scripts.push(codigo);
    if (codigo === "location.pathname") return { value: "/" as T };
    if (codigo.includes("__capiQwenPrompt")) return { value: { ok: true, x: 10, y: 10 } as T };
    if (codigo.includes('data-menu-id$="-upload"')) return { value: { ok: true } as T };
    if (codigo.includes("const texto = document.body.innerText")) {
      return { value: { visible: true, procesando: false, error: "" } as T };
    }
    if (codigo.includes("conversacionNueva")) return { value: { promptAparecio: true, entradaVacia: true, conversacionNueva: false, conversacionId: "c1", generando: false } as T };
    if (codigo.includes("new File")) return { value: { ok: true } as T };
    return { value: 0 as T };
  }
}

test("QwenAdjuntos encapsula la carga DOM sin cambiar su resultado", async () => {
  const directorio = mkdtempSync(join(tmpdir(), "capi-qwen-adjuntos-"));
  const ruta = join(directorio, "contexto.txt");
  writeFileSync(ruta, "contenido");
  const transporte = new TransporteQwen();

  const resultado = await new QwenAdjuntos(transporte as any, async () => {}).adjuntar([ruta]);

  expect(resultado).toEqual({ estrategia: "qwen-dom-data-transfer", archivos: [ruta] });
  expect(transporte.scripts.some((script) => script.includes("DataTransfer"))).toBeTrue();
});

test("QwenControlEnvio encapsula la confirmación del envío", async () => {
  const transporte = new TransporteQwen();

  await new QwenControlEnvio(transporte as any, async () => {}).enviar("marcador");

  expect(transporte.scripts.some((script) => script.includes("conversacionNueva"))).toBeTrue();
});
