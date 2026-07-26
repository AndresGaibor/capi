import { defineCommand } from "citty";
import { crearAplicacion } from "../../composicion/crearAplicacion";
import { crearSobreError, crearSobreExito, codigoSalidaParaError, serializarSalida, type FormatoSalida } from "../../agente/FormatoSalida";

function construirSugerenciasDoctor(data: { proyecto: { ok: boolean }; persistencia: { ok: boolean }; proveedores: Array<{ ok: boolean; error?: string }> }): { command: string; reason: string }[] {
  const sugerencias: { command: string; reason: string }[] = [];
  if (!data.persistencia.ok) {
    sugerencias.push({
      command: "capi estado limpiar --capas cache,snapshots --confirmar",
      reason: "Si SQLite esta danado, limpiar caches locales.",
    });
  }
  const conErrorWebBridge = data.proveedores.filter((p) => !p.ok && /WebBridge error/i.test(String(p.error ?? "")));
  if (conErrorWebBridge.length > 0) {
    const proveedor = conErrorWebBridge[0]!;
    sugerencias.push({
      command: `capi chat -p ${proveedor.error ? "qwen" : "deepseek"} --output jsonl "ping"`,
      reason: "Navega y reabre la pestana del proveedor para refrescar la sesion WebBridge.",
    });
    sugerencias.push({
      command: "capi diagnostico pagina -p chatgpt --output json",
      reason: "Diagnostica la pagina activa del proveedor que falla.",
    });
  }
  if (!data.proyecto.ok) {
    sugerencias.push({
      command: "capi proyecto actual --output json",
      reason: "Confirma que el directorio actual esta dentro de un proyecto detectado.",
    });
  }
  return sugerencias;
}

export const comandoDoctor = defineCommand({
  meta:{name:"doctor",description:"Diagnóstico estructurado de CAPI"},args:{output:{type:"string",alias:"o",default:"json"}},
  async run({args}){
    const f=String(args.output) as FormatoSalida;
    try{
      const data=await crearAplicacion().diagnosticarCompleto.ejecutar();
      const sugerencias = construirSugerenciasDoctor(data);
      const dataConSugerencias = { ...data, sugerencias };
      const hayProblemas = !data.proyecto.ok || !data.persistencia.ok || data.proveedores.some(p=>!p.ok);
      process.stdout.write(serializarSalida(crearSobreExito("doctor",dataConSugerencias,sugerencias.length?{suggestions:sugerencias}:undefined),f)+"\n");
      if(hayProblemas)process.exitCode=1;
    }catch(e){
      const s=crearSobreError("doctor",e);
      process.stdout.write(serializarSalida(s,f)+"\n");
      process.exitCode=codigoSalidaParaError(s.error?.code);
    }
  }
});
