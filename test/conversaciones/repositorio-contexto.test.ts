import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RepositorioContextoSqlite } from "../../src/plataforma/persistencia/RepositorioContextoSqlite";

const directorios: string[] = [];
afterEach(() => { for (const d of directorios.splice(0)) rmSync(d, { recursive: true, force: true }); });

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "capi-contexto-"));
  directorios.push(dir);
  return new RepositorioContextoSqlite(join(dir, "contexto.sqlite"));
}

test("aísla conversaciones de dos proyectos físicos", () => {
  const r = repo();
  r.registrarProyecto({ id: "p1", rutaRaiz: "/a", nombre: "a", tipoDeteccion: "git" });
  r.registrarProyecto({ id: "p2", rutaRaiz: "/b", nombre: "b", tipoDeteccion: "git" });
  r.registrarConversacion({ id: "c1", proveedor: "qwen", proyectoLocalId: "p1", titulo: "A" });
  expect(r.listarConversacionesProyecto("p1").map((x) => x.id)).toEqual(["c1"]);
  expect(r.listarConversacionesProyecto("p2")).toEqual([]);
  r.cerrar();
});

test("vincula rutas y ordena primero la ruta actual", () => {
  const r = repo();
  r.registrarProyecto({ id: "p1", rutaRaiz: "/a", nombre: "a", tipoDeteccion: "git" });
  r.registrarProyecto({ id: "p2", rutaRaiz: "/b", nombre: "b", tipoDeteccion: "git" });
  r.vincularProyecto("p1", "comun");
  r.vincularProyecto("p2", "comun");
  r.registrarConversacion({ id: "c2", proveedor: "qwen", proyectoLocalId: "p2", titulo: "B" });
  r.registrarConversacion({ id: "c1", proveedor: "qwen", proyectoLocalId: "p1", titulo: "A" });
  expect(r.listarConversacionesProyecto("p1").map((x) => x.id)).toEqual(["c1", "c2"]);
  r.cerrar();
});

test("un lease impide usar la misma conversación desde otro proceso", () => {
  const r = repo();
  expect(r.adquirirOcupacion("c1", "proceso-1", 1000, 90_000)).toBeTrue();
  expect(r.adquirirOcupacion("c1", "proceso-2", 1001, 90_000)).toBeFalse();
  r.liberarOcupacion("c1", "proceso-1");
  expect(r.adquirirOcupacion("c1", "proceso-2", 1002, 90_000)).toBeTrue();
  r.cerrar();
});

test("reserva como máximo tres ejecuciones globales de forma atómica",()=>{
 const ruta=join(mkdtempSync(join(tmpdir(),"capi-ejecuciones-")),"contexto.sqlite");
 const repo=new RepositorioContextoSqlite(ruta);
 expect(repo.adquirirEjecucion("p1",1000,90000,11,3)).toBeTrue();
 expect(repo.adquirirEjecucion("p2",1000,90000,12,3)).toBeTrue();
 expect(repo.adquirirEjecucion("p3",1000,90000,13,3)).toBeTrue();
 expect(repo.adquirirEjecucion("p4",1000,90000,14,3)).toBeFalse();
 repo.liberarEjecucion("p2");
 expect(repo.adquirirEjecucion("p4",1001,90000,14,3)).toBeTrue();
 repo.cerrar();
});

test("guarda preferencias aisladas por proyecto",()=>{
 const ruta=join(mkdtempSync(join(tmpdir(),"capi-preferencias-")),"contexto.sqlite");
 const repo=new RepositorioContextoSqlite(ruta);
 const a={id:"a",rutaRaiz:"/a",nombre:"a",tipoDeteccion:"ruta" as const};
 const b={id:"b",rutaRaiz:"/b",nombre:"b",tipoDeteccion:"ruta" as const};
 repo.registrarProyecto(a); repo.registrarProyecto(b);
 repo.guardarPreferencias("a",{proveedor:"qwen",modelo:"preview",razonamiento:true,busquedaWeb:false});
 expect(repo.obtenerPreferencias("a")).toEqual({proveedor:"qwen",modelo:"preview",razonamiento:true,busquedaWeb:false});
 expect(repo.obtenerPreferencias("b")).toBeNull();
 repo.cerrar();
});

test("reutilizar una conversación compartida conserva su ruta de origen",()=>{
 const ruta=join(mkdtempSync(join(tmpdir(),"capi-origen-")),"contexto.sqlite");
 const repo=new RepositorioContextoSqlite(ruta);
 const a={id:"a",rutaRaiz:"/a",nombre:"a",tipoDeteccion:"ruta" as const};
 const b={id:"b",rutaRaiz:"/b",nombre:"b",tipoDeteccion:"ruta" as const};
 repo.registrarProyecto(a); repo.registrarProyecto(b);
 repo.vincularProyecto("a","grupo"); repo.vincularProyecto("b","grupo");
 repo.registrarConversacion({id:"c",proveedor:"qwen",proyectoLocalId:"a"},1000);
 repo.registrarConversacion({id:"c",proveedor:"qwen",proyectoLocalId:"b"},2000);
 const c=repo.listarConversacionesProyecto("b")[0]!;
 expect(c.proyectoLocalId).toBe("a");
 expect(c.rutaOrigen).toBe("/a");
 expect(c.usadaEn).toBe(2000);
 repo.cerrar();
});


test("marca una sola conversación principal por proyecto y proveedor", () => {
  const r = repo();
  r.registrarProyecto({ id: "p1", rutaRaiz: "/a", nombre: "a", tipoDeteccion: "git" });
  r.registrarConversacion({ id: "c1", proveedor: "qwen", proyectoLocalId: "p1" }, 1000);
  r.registrarConversacion({ id: "c2", proveedor: "qwen", proyectoLocalId: "p1" }, 2000);
  r.marcarConversacionPrincipal("c2", "qwen", "p1");
  const conversaciones = r.listarConversacionesProyecto("p1");
  expect(conversaciones.find((c) => c.id === "c1")?.principal).toBeFalse();
  expect(conversaciones.find((c) => c.id === "c2")?.principal).toBeTrue();
  r.cerrar();
});
