import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';

test('runner durable expone los cuatro escenarios y nunca reenvía en kill',()=>{
 const fuente=readFileSync('scripts/lib/smokeDurableProveedor.ts','utf8');
 expect(fuente).toContain("'background'|'kill'|'pestana'|'cancelacion'");
 expect(fuente).toContain("['tareas','reanudar',id");
 expect(fuente).toContain("'SIGKILL'");
 expect(fuente).toContain("['tareas','reanudar',id");
 expect((fuente.match(/'chat','enviar'/g)??[]).length).toBe(1);
 expect(fuente).toContain('marcadorRespondido');
 expect(fuente).toContain('respuestaCaracteres');
 expect(fuente).not.toContain("['chat','enviar','--conversacion',conv");
});

test('package publica smokes durables para los tres proveedores',()=>{
 const p=JSON.parse(readFileSync('package.json','utf8'));
 for(const proveedor of ['qwen','deepseek','chatgpt'])for(const escenario of ['background','recuperacion','pestana','cancelacion'])
  expect(p.scripts[`smoke:${proveedor}:${escenario}`]).toBeTruthy();
});


test("auditoría Qwen cuenta el contenedor superior del usuario",()=>{
 const fuente=readFileSync("scripts/lib/smokeDurableProveedor.ts","utf8");
 expect(fuente).toContain("selectorUsuario:'.qwen-chat-message-user'");
 expect(fuente).not.toContain(".qwen-chat-message-user,.chat-user-message");
});


test("smokes Qwen usan modo Fast",()=>{
 const fuente=readFileSync("scripts/lib/smokeDurableProveedor.ts","utf8");
 expect(fuente).toContain("args.push('--razonamiento=false')");
});
