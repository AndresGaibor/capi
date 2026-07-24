import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
const prefijo="capi.enc.v1:";
export class CifradorLocal { constructor(private readonly secreto=process.env.CAPI_LOCAL_ENCRYPTION_KEY){} private clave(){return createHash("sha256").update(this.secreto!).digest();}
 cifrar(texto:string):string{if(!this.secreto)return texto;const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",this.clave(),iv);const cuerpo=Buffer.concat([c.update(texto,"utf8"),c.final()]);return prefijo+iv.toString("base64")+":"+c.getAuthTag().toString("base64")+":"+cuerpo.toString("base64");}
 descifrar(texto:string):string{if(!texto.startsWith(prefijo))return texto;if(!this.secreto)throw new Error("CAPI_LOCAL_ENCRYPTION_KEY es necesaria para leer datos cifrados");const [iv,tag,cuerpo]=texto.slice(prefijo.length).split(":");const d=createDecipheriv("aes-256-gcm",this.clave(),Buffer.from(iv!,"base64"));d.setAuthTag(Buffer.from(tag!,"base64"));return Buffer.concat([d.update(Buffer.from(cuerpo!,"base64")),d.final()]).toString("utf8");}
 estaCifrado(texto:string){return texto.startsWith(prefijo);}
}
