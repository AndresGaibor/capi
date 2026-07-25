import {expect,test} from "bun:test";
import {mkdtempSync} from "node:fs";import{tmpdir}from"node:os";import{join}from"node:path";
import{RepositorioContextoSqlite}from"../../src/plataforma/persistencia/RepositorioContextoSqlite";
const crear=()=>new RepositorioContextoSqlite(join(mkdtempSync(join(tmpdir(),"capi-idem-")),"db.sqlite"));
test("persiste transición idempotente y bloquea estado incierto",()=>{const r=crear();r.registrarEnvioIdempotente({huella:"h",proveedor:"qwen",promptHash:"p",estado:"preparado"},100);r.actualizarEnvioIdempotente("h","intentando_enviar",200);expect(r.obtenerEnvioIdempotente("h")?.estado).toBe("intentando_enviar");r.actualizarEnvioIdempotente("h","desconocido",300);expect(r.debeEvitarReenvio("h")).toBeTrue();r.cerrar();});
