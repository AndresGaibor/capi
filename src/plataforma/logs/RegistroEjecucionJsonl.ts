import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';import{join}from'node:path';
const MAX=10*1024*1024;
function sanear(v:unknown):unknown{if(Array.isArray(v))return v.map(sanear);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v as any).filter(([k])=>!/prompt|respuesta|pensamiento|authorization|cookie|token|secret/i.test(k)).map(([k,x])=>[k,sanear(x)]));if(typeof v==='string')return v.replace(/Bearer\s+[\w.-]+/gi,'Bearer [REDACTADO]').slice(0,2000);return v}
export class RegistroEjecucionJsonl{
 readonly ruta:string;constructor(private id:string,base=process.env.CAPI_DATA_DIR??join(homedir(),'.local','share','capi')){const dir=join(base,'logs');mkdirSync(dir,{recursive:true});this.ruta=join(dir,`${id}.jsonl`)}
 escribir(tipo:string,datos:Record<string,unknown>,ahora=Date.now()){this.rotar();appendFileSync(this.ruta,JSON.stringify({timestamp:ahora,ejecucionId:this.id,tipo,datos:sanear(datos)})+'\n')}
 leer(ultimas?:number){if(!existsSync(this.ruta))return'';const t=readFileSync(this.ruta,'utf8');if(!ultimas)return t;return t.trimEnd().split('\n').slice(-ultimas).join('\n')+'\n'}
 private rotar(){if(!existsSync(this.ruta)||statSync(this.ruta).size<MAX)return;for(let i=2;i>=1;i--){const a=`${this.ruta}.${i}`,b=`${this.ruta}.${i+1}`;if(existsSync(a))renameSync(a,b)}renameSync(this.ruta,`${this.ruta}.1`)}
}
