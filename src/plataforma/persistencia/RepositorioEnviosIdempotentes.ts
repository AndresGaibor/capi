import type {Database} from "bun:sqlite";
export type EstadoEnvioIdempotente="preparado"|"intentando_enviar"|"confirmado_dom"|"confirmado_red"|"desconocido";
export interface EnvioIdempotente{huella:string;proveedor:string;conversacionId?:string;promptHash:string;archivosHash?:string;estado:EstadoEnvioIdempotente;creadoEn:number;actualizadoEn:number;}
const mapear=(r:any):EnvioIdempotente=>({huella:r.huella,proveedor:r.proveedor,conversacionId:r.conversacion_id??undefined,promptHash:r.prompt_hash,archivosHash:r.archivos_hash??undefined,estado:r.estado,creadoEn:r.creado_en,actualizadoEn:r.actualizado_en});
export class RepositorioEnviosIdempotentes{constructor(private db:Database){}
 registrar(e:Omit<EnvioIdempotente,"creadoEn"|"actualizadoEn">,ahora=Date.now()){this.db.query("INSERT OR IGNORE INTO envios_idempotentes(huella,proveedor,conversacion_id,prompt_hash,archivos_hash,estado,creado_en,actualizado_en) VALUES(?,?,?,?,?,?,?,?)").run(e.huella,e.proveedor,e.conversacionId??null,e.promptHash,e.archivosHash??null,e.estado,ahora,ahora);}
 actualizar(huella:string,estado:EstadoEnvioIdempotente,ahora=Date.now()){this.db.query("UPDATE envios_idempotentes SET estado=?,actualizado_en=? WHERE huella=?").run(estado,ahora,huella);}
 obtener(huella:string):EnvioIdempotente|null{const r=this.db.query("SELECT * FROM envios_idempotentes WHERE huella=?").get(huella);return r?mapear(r):null;}
 debeEvitarReenvio(huella:string):boolean{const e=this.obtener(huella);return !!e&&["intentando_enviar","confirmado_dom","confirmado_red","desconocido"].includes(e.estado);}
}
