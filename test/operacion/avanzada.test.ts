import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rankearContextoLocal } from "../../src/modulos/contexto/aplicacion/RankearContextoLocal";
import { compactarResumen } from "../../src/modulos/historial/aplicacion/CompactarResumen";
import { CifradorLocal } from "../../src/plataforma/seguridad/CifradorLocal";
import { RepositorioContextoSqlite } from "../../src/plataforma/persistencia/RepositorioContextoSqlite";

const proyecto={id:"p1",rutaRaiz:"/tmp/proyecto",nombre:"proyecto",tipoDeteccion:"ruta" as const};

test("ranking local prioriza nombre y contenido relacionados",()=>{
  const d=mkdtempSync(join(tmpdir(),"capi-rank-"));
  writeFileSync(join(d,"oauth.ts"),"export function validarToken(){}\n");
  writeFileSync(join(d,"ventas.ts"),"export const total=1\n");
  const r=rankearContextoLocal("corrige validación oauth token",["ventas.ts","oauth.ts"],d);
  expect(r[0]?.ruta).toBe("oauth.ts");
  expect(r[0]?.puntuacion).toBeGreaterThan(r[1]?.puntuacion ?? 0);
});

test("compactación conserva bloques importantes y limita tamaño",()=>{
  const texto=Array.from({length:30},(_,i)=>`## Paso ${i}\nResultado y archivo ${i}: ${"x".repeat(300)}`).join("\n");
  const r=compactarResumen(texto,1200);
  expect(r.length).toBeLessThanOrEqual(1200);
  expect(r).toContain("Resumen compactado");
  expect(r).toContain("Paso 29");
});

test("cifrado local roundtrip y texto plano compatible",()=>{
  const c=new CifradorLocal("clave-prueba"); const protegido=c.cifrar("secreto");
  expect(protegido).toStartWith("capi.enc.v1:");
  expect(c.descifrar(protegido)).toBe("secreto");
  expect(c.descifrar("plano")).toBe("plano");
});

test("repositorio exporta, importa, mide y limpia capas",()=>{
  const d=mkdtempSync(join(tmpdir(),"capi-state-")); const repo=new RepositorioContextoSqlite(join(d,"a.sqlite"));
  repo.registrarProyecto(proyecto); repo.registrarConversacion({id:"c1",proveedor:"deepseek",proyectoLocalId:"p1"});
  repo.guardarResumenConversacion("p1","deepseek","c1","## Decisión\nMantener arquitectura");
  repo.guardarSnapshotContexto("p1","deepseek","c1",[{ruta:"a.ts",hash:"h"}]);
  repo.registrarAdjuntosConfirmados("p1","deepseek","c1",[{ruta:"a.ts",hash:"h"}]);
  repo.iniciarEjecucionHistorial({id:"e1",proyectoLocalId:"p1",proveedor:"deepseek"},100);
  repo.finalizarEjecucionHistorial("e1",{estado:"completada",respuestaCaracteres:10},200);
  expect(repo.obtenerMetricasProyecto("p1").total).toBe(1);
  const exp=repo.exportarProyecto("p1"); expect(exp.formato).toBe("capi.project.v1"); expect(JSON.stringify(exp)).not.toContain("userToken");
  const repo2=new RepositorioContextoSqlite(join(d,"b.sqlite")); expect(repo2.importarProyecto(exp).filas).toBeGreaterThan(1); expect(repo2.obtenerResumenConversacion("p1","deepseek","c1")).toContain("arquitectura");
  expect(repo.limpiarProyecto("p1",["cache","snapshots","historial","resumenes"])).toEqual({cache:1,snapshots:1,historial:1,resumenes:1});
});
