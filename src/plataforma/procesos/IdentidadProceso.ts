import { hostname } from 'node:os';
import { readFileSync } from 'node:fs';
export interface IdentidadProceso { propietarioId:string; pid:number; hostname:string; bootId:string; }
function obtenerBootId():string { try{return readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()}catch{return `darwin-${Math.floor(Date.now()-process.uptime()*1000)}`} }
export function identidadProceso():IdentidadProceso { const host=hostname();const bootId=obtenerBootId();return{pid:process.pid,hostname:host,bootId,propietarioId:`${host}:${bootId}:${process.pid}:${crypto.randomUUID()}`}; }
export function procesoVivo(pid:number,host:string,bootId:string,actual=identidadProceso()):boolean { if(host!==actual.hostname||bootId!==actual.bootId)return false;try{process.kill(pid,0);return true}catch{return false} }
