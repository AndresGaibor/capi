import { readFileSync } from "node:fs";

const ruta = "coverage/lcov.info";
const minimo = 80;
const prefijos = ["src/nucleo/", "src/modulos/", "src/plataforma/", "src/proveedores/", "src/entradas/"];
const registros = readFileSync(ruta, "utf8").split("end_of_record");
let encontradas = 0;
let cubiertas = 0;
for (const registro of registros) {
  const lineas = registro.split("\n");
  const fuente = lineas.find((linea) => linea.startsWith("SF:"))?.slice(3);
  if (!fuente) continue;
  const relativa = fuente.includes("/capi/") ? fuente.split("/capi/").at(-1)! : fuente;
  if (!prefijos.some((prefijo) => relativa.startsWith(prefijo))) continue;
  encontradas += Number(lineas.find((linea) => linea.startsWith("LF:"))?.slice(3) ?? 0);
  cubiertas += Number(lineas.find((linea) => linea.startsWith("LH:"))?.slice(3) ?? 0);
}
if (encontradas === 0) throw new Error(`LCOV sin líneas modulares en ${ruta}`);
const porcentaje = (cubiertas / encontradas) * 100;
console.log(`Cobertura modular de líneas: ${porcentaje.toFixed(2)}% (${cubiertas}/${encontradas})`);
if (porcentaje < minimo) {
  console.error(`Cobertura modular insuficiente: mínimo ${minimo}%`);
  process.exit(1);
}
