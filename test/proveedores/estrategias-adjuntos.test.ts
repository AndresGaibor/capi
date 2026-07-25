import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { QwenEnvio } from "../../src/proveedores/qwen/navegador/QwenEnvio";
import { DeepSeekEnvio } from "../../src/proveedores/deepseek/navegador/DeepSeekEnvio";

test("Qwen informa estrategia DOM", async () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-strategy-q-")); const file = join(dir, "a.txt"); writeFileSync(file, "x");
  const t:any = { evaluar: async (code:string) => ({ value: code.includes("const texto") ? { visible:true, procesando:false, error:"" } : code.includes("data-menu-id") || code.includes("new File") ? { ok:true } : code.includes("Eliminar") ? 0 : true }) };
  const resultado = await new QwenEnvio(t, async()=>{}).adjuntar([file]);
  expect(resultado.estrategia).toBe("qwen-dom-data-transfer");
});

test("DeepSeek informa estrategia CDP", async () => {
  const llamadas:string[]=[]; const t:any={ evaluar:async(code:string)=>({value:code.includes("const cierres") ? {cerrados:0,restantes:0} : code.includes("querySelectorAll('div')") ? 0 : true}), cdp:async(method:string)=>{ llamadas.push(method); if(method==="DOM.getDocument") return {root:{nodeId:1}}; if(method==="DOM.querySelector") return {nodeId:2}; return {}; } };
  const resultado = await new DeepSeekEnvio(t).adjuntar(["a.txt"]);
  expect(resultado.estrategia).toBe("deepseek-cdp-file-input");
  expect(llamadas).toContain("DOM.setFileInputFiles");
});


test("DeepSeek usa DataTransfer si CDP está bloqueado", async () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-strategy-ds-")); const file = join(dir, "a.txt"); writeFileSync(file, "x");
  const scripts:string[]=[]; const t:any={ cdp:async(method:string)=>{ if(method==="DOM.getDocument") return {root:{nodeId:1}}; if(method==="DOM.querySelector") return {nodeId:2}; throw new Error("Not allowed"); }, evaluar:async(code:string)=>{ scripts.push(code); return {value:code.includes("const cierres") ? {cerrados:0,restantes:0} : code.includes("querySelectorAll('div')") ? 0 : code.includes("const texto=document.body")?{visible:true,procesando:false,error:""}:code.includes("new File")?{ok:true}:true}; } };
  const resultado=await new DeepSeekEnvio(t,async()=>{}).adjuntar([file]);
  expect(resultado.estrategia).toBe("deepseek-dom-data-transfer");
  expect(scripts.some(x=>x.includes("DataTransfer"))).toBeTrue();
});


test("DeepSeek limpia adjuntos residuales antes de cargar", async () => {
  const llamadas: string[] = [];
  const t: any = {
    evaluar: async (code: string) => {
      llamadas.push(code);
      if (code.includes("const cierres")) return { value: { cerrados: 2, restantes: 0 } };
      if (code.includes("querySelectorAll('div')")) return { value: 0 };
      return { value: true };
    },
    cdp: async (method: string) => {
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelector") return { nodeId: 2 };
      return {};
    },
  };
  await new DeepSeekEnvio(t, async () => {}).adjuntar(["a.txt"]);
  expect(llamadas.some(x => x.includes("const cierres"))).toBeTrue();
});


test("DeepSeek DOM conserva MIME real para imágenes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "capi-strategy-ds-image-")); const file = join(dir, "a.webp"); writeFileSync(file, Buffer.from([82,73,70,70,0,0,0,0,87,69,66,80]));
  const scripts:string[]=[]; const t:any={ cdp:async(method:string)=>{ if(method==="DOM.getDocument") return {root:{nodeId:1}}; if(method==="DOM.querySelector") return {nodeId:2}; throw new Error("Not allowed"); }, evaluar:async(code:string)=>{ scripts.push(code); return {value:code.includes("const cierres") ? {cerrados:0,restantes:0} : code.includes("querySelectorAll('div')") ? 0 : code.includes("const texto=document.body")?{visible:true,procesando:false,error:""}:code.includes("new File")?{ok:true}:true}; } };
  await new DeepSeekEnvio(t,async()=>{}).adjuntar([file]);
  const script=scripts.find(x=>x.includes("new File"))??"";
  expect(script).toContain("image/webp");
  expect(script).not.toContain("text/plain");
});
