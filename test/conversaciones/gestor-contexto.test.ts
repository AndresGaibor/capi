import { expect, test } from "bun:test";
import { GestorContextoProyecto } from "../../src/modulos/conversaciones/aplicacion/GestorContextoProyecto";

test("el gestor registra el proyecto y devuelve selección explicable", () => {
  const llamadas: string[] = [];
  const repo = {
    registrarProyecto(){ llamadas.push("proyecto"); },
    listarConversacionesProyecto(){ return [{ id:"c1", proveedor:"qwen", proyectoLocalId:"p1", usadaEn: Date.now(), ocupada:false, archivada:false }]; },
  } as any;
  const gestor = new GestorContextoProyecto(repo, () => ({ id:"p1", rutaRaiz:"/p", nombre:"p", tipoDeteccion:"git" }));
  const resultado = gestor.seleccionar("qwen");
  expect(llamadas).toEqual(["proyecto"]);
  expect(resultado.seleccion.conversacionId).toBe("c1");
});
