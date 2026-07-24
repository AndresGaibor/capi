import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { QwenEnvio } from "../../../src/proveedores/qwen/navegador/QwenEnvio";

class TransporteArchivo {
  scripts: string[] = [];
  async estaDisponible(){ return true; }
  async navegar(){ }
  async evaluar<T>(codigo: string){
    this.scripts.push(codigo);
    if (codigo.includes('data-menu-id$="-upload"')) return { value: { ok:true } as T };
    if (codigo.includes("const texto = document.body.innerText")) return { value: { visible:true, procesando:false, error:"" } as T };
    if (codigo.includes("const botones") && codigo.includes("Eliminar archivo")) return { value: 1 as T };
    if (codigo.includes("querySelectorAll") && codigo.includes("Eliminar archivo") && codigo.includes(".length")) return { value: 0 as T };
    if (codigo.includes("new File")) return { value: { ok:true, name:"contexto.txt" } as T };
    return { value: true as T };
  }
  async cdp<T>(): Promise<T> { throw new Error("CDP no debe usarse para Qwen"); }
}

test("Qwen transfiere el archivo por fragmentos y crea un File real", async () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-qwen-file-"));
  const ruta = join(dir, "contexto.txt");
  writeFileSync(ruta, "contenido");
  const transporte = new TransporteArchivo();
  await new QwenEnvio(transporte as any, async () => {}).adjuntar([ruta]);
  expect(transporte.scripts.some(x => x.includes("DataTransfer"))).toBeTrue();
  expect(transporte.scripts.some(x => x.includes("new File"))).toBeTrue();
  expect(transporte.scripts.some(x => x.includes("DOM.setFileInputFiles"))).toBeFalse();
});


test("Qwen elimina adjuntos residuales antes de cargar el nuevo contexto", async () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-qwen-clean-"));
  const ruta = join(dir, "contexto-nuevo.txt");
  writeFileSync(ruta, "contenido nuevo");
  const transporte = new TransporteArchivo();
  await new QwenEnvio(transporte as any, async () => {}).adjuntar([ruta]);
  const indiceLimpieza = transporte.scripts.findIndex(x => x.includes('aria-label="Eliminar archivo"'));
  const indiceCarga = transporte.scripts.findIndex(x => x.includes("new File"));
  expect(indiceLimpieza).toBeGreaterThanOrEqual(0);
  expect(indiceLimpieza).toBeLessThan(indiceCarga);
});


test("Qwen activa la opción de subir archivo antes de inyectar el File", async () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-qwen-menu-"));
  const ruta = join(dir, "contexto.txt");
  writeFileSync(ruta, "contenido");
  const transporte = new TransporteArchivo();
  await new QwenEnvio(transporte as any, async () => {}).adjuntar([ruta]);
  const indiceMenu = transporte.scripts.findIndex(x => x.includes('data-menu-id$="-upload"'));
  const indiceArchivo = transporte.scripts.findIndex(x => x.includes("new File"));
  expect(indiceMenu).toBeGreaterThanOrEqual(0);
  expect(indiceMenu).toBeLessThan(indiceArchivo);
});
