import { existsSync, statSync } from "node:fs";
import { detectarTipoArchivo, type ArchivoDetectado } from "../../../nucleo/archivos/DetectarTipoArchivo";
export interface AdjuntosSeparados { textuales:string[]; imagenes:string[]; documentos:string[]; rechazados:ArchivoDetectado[]; detectados:ArchivoDetectado[] }
export function separarAdjuntosContexto(rutas:string[], limites={maxImagenes:10,maxBytesImagen:20*1024*1024,maxBytesDocumento:50*1024*1024}):AdjuntosSeparados{
 const r:AdjuntosSeparados={textuales:[],imagenes:[],documentos:[],rechazados:[],detectados:[]};
 for(const ruta of [...new Set(rutas)]){if(/[*?{}[\]]/.test(ruta)||(existsSync(ruta)&&statSync(ruta).isDirectory())){r.textuales.push(ruta);continue}const a=detectarTipoArchivo(ruta);r.detectados.push(a);if(!a.soportado){r.rechazados.push(a);continue}
  if(a.categoria==="texto")r.textuales.push(a.ruta); else if(a.categoria==="imagen"){if(r.imagenes.length>=limites.maxImagenes||a.bytes>limites.maxBytesImagen)r.rechazados.push({...a,soportado:false,motivo:r.imagenes.length>=limites.maxImagenes?"límite de imágenes":"imagen demasiado grande"});else r.imagenes.push(a.ruta)}
  else if(a.categoria==="documento"){if(a.bytes>limites.maxBytesDocumento)r.rechazados.push({...a,soportado:false,motivo:"documento demasiado grande"});else r.documentos.push(a.ruta)} else r.rechazados.push(a);
 } return r;
}
