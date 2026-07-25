import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

export type CategoriaArchivo = "texto" | "imagen" | "documento" | "binario";
export interface ArchivoDetectado { ruta:string; mime:string; categoria:CategoriaArchivo; bytes:number; soportado:boolean; motivo?:string }
const POR_EXTENSION:Record<string,{mime:string;categoria:CategoriaArchivo}>={
  ".png":{mime:"image/png",categoria:"imagen"},".jpg":{mime:"image/jpeg",categoria:"imagen"},".jpeg":{mime:"image/jpeg",categoria:"imagen"},
  ".webp":{mime:"image/webp",categoria:"imagen"},".gif":{mime:"image/gif",categoria:"imagen"},".pdf":{mime:"application/pdf",categoria:"documento"},
  ".txt":{mime:"text/plain",categoria:"texto"},".md":{mime:"text/markdown",categoria:"texto"},".json":{mime:"application/json",categoria:"texto"},
  ".ts":{mime:"text/typescript",categoria:"texto"},".tsx":{mime:"text/typescript",categoria:"texto"},".js":{mime:"text/javascript",categoria:"texto"},
  ".jsx":{mime:"text/javascript",categoria:"texto"},".css":{mime:"text/css",categoria:"texto"},".html":{mime:"text/html",categoria:"texto"},
  ".csv":{mime:"text/csv",categoria:"texto"},".xml":{mime:"application/xml",categoria:"texto"},".yaml":{mime:"application/yaml",categoria:"texto"},".yml":{mime:"application/yaml",categoria:"texto"},
};
function firma(b:Buffer){
 if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return{mime:"image/png",categoria:"imagen" as const};
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return{mime:"image/jpeg",categoria:"imagen" as const};
 if(b.length>=12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP")return{mime:"image/webp",categoria:"imagen" as const};
 if(b.length>=6&&/^GIF8[79]a$/.test(b.toString("ascii",0,6)))return{mime:"image/gif",categoria:"imagen" as const};
 if(b.length>=5&&b.toString("ascii",0,5)==="%PDF-")return{mime:"application/pdf",categoria:"documento" as const};
 return null;
}
export function detectarTipoArchivo(ruta:string):ArchivoDetectado{
 const absoluta=resolve(ruta); if(!existsSync(absoluta))return{ruta:absoluta,mime:"application/octet-stream",categoria:"binario",bytes:0,soportado:false,motivo:"archivo inexistente"};
 const st=statSync(absoluta); if(!st.isFile())return{ruta:absoluta,mime:"application/octet-stream",categoria:"binario",bytes:st.size,soportado:false,motivo:"no es un archivo"};
 const b=readFileSync(absoluta).subarray(0,32); const f=firma(b); const ext=POR_EXTENSION[extname(absoluta).toLowerCase()]; const tipo=f??ext;
 if(!tipo)return{ruta:absoluta,mime:"application/octet-stream",categoria:"binario",bytes:st.size,soportado:false,motivo:"tipo no soportado"};
 return{ruta:absoluta,mime:tipo.mime,categoria:tipo.categoria,bytes:st.size,soportado:true};
}
