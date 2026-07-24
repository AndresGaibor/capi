import { expect, test } from "bun:test";
import { RenderizadorStreaming } from "../../src/plataforma/consola/RenderizadorStreaming";
test("renderizador procesa eventos sin lanzar",()=>{const r=new RenderizadorStreaming();expect(()=>{r.renderizar({tipo:"pensamiento",contenido:"x"});r.renderizar({tipo:"respuesta",contenido:"y"});r.renderizar({tipo:"fin"})}).not.toThrow()});
