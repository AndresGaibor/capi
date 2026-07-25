import { readFileSync } from "node:fs";
import {expect,test} from 'bun:test';import{mkdtempSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{RepositorioContextoSqlite}from'../../src/plataforma/persistencia/RepositorioContextoSqlite';
const repo=()=>new RepositorioContextoSqlite(join(mkdtempSync(join(tmpdir(),'capi-life-')),'db.sqlite'));
const base=(id:string,state:any='reconectando')=>({id,proyectoLocalId:'p',proveedor:'qwen',estado:state,propietarioId:'old',modo:'foreground' as const,conversacionId:'c'});
test('cancelar terminal no ensucia flag',()=>{const r=repo();r.crearEjecucionChat(base('x','completada'),1);r.actualizarEjecucionChat('x',{completadaEn:2},2);expect(r.solicitarCancelacionEjecucion('x',3)).toBe('ya_finalizada');expect(r.obtenerEjecucionChat('x')?.cancelacionSolicitada).toBeFalse();r.cerrar()});
test('solo un proceso adopta ejecución',()=>{const r=repo();r.crearEjecucionChat(base('x'),1);expect(r.adoptarEjecucionChat('x',{propietarioId:'a',pid:1,hostname:'h',bootId:'b'},2)).toBeTrue();expect(r.adoptarEjecucionChat('x',{propietarioId:'b',pid:2,hostname:'h',bootId:'b'},3)).toBeFalse();r.cerrar()});
test('secuencia de eventos es atómica y monotónica',()=>{const r=repo();r.crearEjecucionChat(base('x'),1);expect(r.anexarEventoEjecucion('x','a',{},2).secuencia).toBe(1);expect(r.anexarEventoEjecucion('x','b',{},3).secuencia).toBe(2);r.cerrar()});

test('reanudar reconcilia propietarios muertos antes de validar estado',()=>{
  const fuente=readFileSync('src/entradas/cli/comandos/tareas/reanudar.ts','utf8');
  expect(fuente).toContain('ReconciliadorEjecuciones');
  expect(fuente).toContain('.ejecutar(0)');
});
