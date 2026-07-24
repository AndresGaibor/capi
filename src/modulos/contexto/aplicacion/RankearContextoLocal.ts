import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

const PALABRAS_VACIAS = new Set(["para","como","este","esta","estos","estas","con","sin","por","que","del","las","los","una","uno","the","and","for","from","this","that"]);
function terminos(texto: string): Set<string> { return new Set(texto.toLowerCase().normalize("NFD").replace(/[^a-z0-9áéíóúñ_./-]+/gi," ").split(/\s+/).filter(x=>x.length>2&&!PALABRAS_VACIAS.has(x))); }
export interface FuenteRankeada { ruta:string; puntuacion:number; razones:string[] }
export function rankearContextoLocal(prompt:string, fuentes:string[], cwd=process.cwd()): FuenteRankeada[] {
  const consulta=terminos(prompt); return fuentes.map(ruta=>{ const razones:string[]=[]; let puntuacion=0; const nombre=basename(ruta).toLowerCase();
    for(const t of consulta){ if(nombre.includes(t)){puntuacion+=8;razones.push(`nombre:${t}`);} if(ruta.toLowerCase().includes(t)){puntuacion+=3;razones.push(`ruta:${t}`);} }
    try{const st=statSync(ruta.startsWith("/")?ruta:`${cwd}/${ruta}`); if(st.size<64*1024)puntuacion+=1; const texto=readFileSync(ruta.startsWith("/")?ruta:`${cwd}/${ruta}`,"utf8").slice(0,200000).toLowerCase(); for(const t of consulta) if(texto.includes(t)){puntuacion+=2;razones.push(`contenido:${t}`);} }catch{}
    if(/test|spec/.test(nombre)){puntuacion+=1;razones.push("prueba");} if([".md",".json"].includes(extname(nombre)))puntuacion+=0.5; return{ruta,puntuacion,razones};
  }).sort((a,b)=>b.puntuacion-a.puntuacion||a.ruta.localeCompare(b.ruta));
}
