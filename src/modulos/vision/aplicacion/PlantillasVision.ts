export type TipoAnalisisVision="descripcion"|"ocr"|"ui"|"diagrama"|"tabla";
const ESQUEMAS:Record<TipoAnalisisVision,string>={
 descripcion:'{"descripcion":"","elementos":[],"texto_visible":[],"incertidumbres":[]}',
 ocr:'{"texto_completo":"","bloques":[{"texto":"","ubicacion":""}],"idioma":"","incertidumbres":[]}',
 ui:'{"descripcion":"","jerarquia":[],"problemas":[{"severidad":"","detalle":""}],"recomendaciones":[],"texto_visible":[],"incertidumbres":[]}',
 diagrama:'{"tipo":"","componentes":[],"relaciones":[],"flujo":[],"texto_visible":[],"incertidumbres":[]}',
 tabla:'{"columnas":[],"filas":[],"notas":[],"incertidumbres":[]}',
};
export function promptAnalisisVision(tipo:TipoAnalisisVision,instruccion?:string){return `Analiza la imagen adjunta. No inventes contenido que no sea visible. ${instruccion??""}
Devuelve exclusivamente JSON válido con esta estructura: ${ESQUEMAS[tipo]}`}
export function promptComparacionVision(instruccion?:string){return `Compara las dos imágenes adjuntas en el orden recibido. No inventes contenido. ${instruccion??""}
Devuelve exclusivamente JSON válido: {"resumen":"","diferencias":[{"area":"","antes":"","despues":"","impacto":""}],"mejoras":[],"regresiones":[],"incertidumbres":[]}`}
