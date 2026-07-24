import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
function archivos(dir:string):string[]{return readdirSync(dir).flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?archivos(p):p.endsWith('.ts')?[p]:[]})}
test("núcleo no depende de capas externas",()=>{for(const f of archivos("src/nucleo")){const s=readFileSync(f,"utf8");expect(s).not.toMatch(/from ["']\.\.\/(proveedores|plataforma|entradas|adaptadores|di)/)}});
test("módulos no contienen DOM ni fetch",()=>{for(const f of archivos("src/modulos")){const s=readFileSync(f,"utf8");expect(s).not.toMatch(/querySelector|document\.|fetch\(/)}});
test("proveedores no importan DI ni otros proveedores",()=>{for(const f of archivos("src/proveedores")){const s=readFileSync(f,"utf8");expect(s).not.toMatch(/\/di\//);const proveedor=f.includes('/qwen/')?'deepseek':'qwen';expect(s).not.toContain(`/proveedores/${proveedor}`)}});
test("proveedores no usan fetch directo",()=>{for(const f of archivos("src/proveedores")){expect(readFileSync(f,"utf8")).not.toMatch(/fetch\(/)}});
