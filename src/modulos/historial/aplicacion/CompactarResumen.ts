export function compactarResumen(texto:string, maxCaracteres=12000):string {
  if(texto.length<=maxCaracteres)return texto;
  const bloques=texto.split(/\n(?=## )/).filter(Boolean);
  const importantes=bloques.filter(b=>/error|decisi[oó]n|pendiente|archivo|resultado/i.test(b));
  const elegidos=[...new Set([...importantes.slice(-8),...bloques.slice(-4)])];
  const salida=`# Resumen compactado por CAPI\n\n${elegidos.join("\n")}`;
  if(salida.length<=maxCaracteres)return salida;const cabecera="# Resumen compactado por CAPI\n\n";return cabecera+salida.slice(-(maxCaracteres-cabecera.length));
}
