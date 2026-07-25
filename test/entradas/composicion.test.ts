import { expect, test } from "bun:test";
import { crearAplicacion } from "../../src/entradas/cli/composicion/crearAplicacion";
test('composition root registra proveedores y casos',()=>{const a=crearAplicacion();expect(a.proveedores.listar().map(p=>p.id).sort()).toEqual(['chatgpt','deepseek','qwen']);expect(a.enviarMensaje).toBeTruthy();expect(a.listarModelos).toBeTruthy()});
