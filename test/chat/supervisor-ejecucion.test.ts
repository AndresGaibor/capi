import { expect, test } from "bun:test";
import { SupervisorEjecucionChat } from "../../src/modulos/chat/aplicacion/SupervisorEjecucionChat";

class RepoFake {
  ejecucion:any; eventos:any[]=[];
  crearEjecucionChat(e:any, ahora:number){ this.ejecucion={...e,respuestaParcial:"",pensamientoParcial:"",cancelacionSolicitada:false,reintentos:0,ultimoProgresoEn:ahora,creadaEn:ahora,actualizadaEn:ahora}; }
  actualizarEjecucionChat(_id:string,c:any,ahora:number){ this.ejecucion={...this.ejecucion,...c,actualizadaEn:ahora}; }
  anexarEventoEjecucion(_id:string,tipo:string,datos:any,ahora:number){ this.eventos.push({tipo,datos,ahora}); }
  obtenerEjecucionChat(){ return this.ejecucion; }
}

test("supervisor traduce eventos a estado durable", () => {
  const repo=new RepoFake(); let reloj=100;
  const s=new SupervisorEjecucionChat(repo as any,{id:"e",proyectoLocalId:"p",proveedor:"qwen",propietarioId:"o",prompt:"secreto"},()=>++reloj);
  s.iniciar(); s.registrar({tipo:"pensamiento",contenido:"abc"}); s.registrar({tipo:"respuesta",contenido:"ok",estrategia:"snapshot-accesible"}); s.registrar({tipo:"fin"});
  expect(repo.ejecucion.estado).toBe("completada");
  expect(repo.ejecucion.pensamientoParcial).toBe("abc");
  expect(repo.ejecucion.respuestaParcial).toBe("ok");
  expect(repo.ejecucion.promptHash).toHaveLength(64);
  expect(JSON.stringify(repo.eventos)).not.toContain("secreto");
});

test("supervisor detecta cancelación persistida", () => {
  const repo=new RepoFake(); const s=new SupervisorEjecucionChat(repo as any,{id:"e",proyectoLocalId:"p",proveedor:"qwen",propietarioId:"o",prompt:"x"}); s.iniciar(); repo.ejecucion.cancelacionSolicitada=true;
  expect(()=>s.verificarCancelacion()).toThrow("cancelada");
});
