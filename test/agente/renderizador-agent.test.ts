import { expect, test } from "bun:test";
import { RenderizadorAgenteStreaming } from "../../src/entradas/cli/agente/RenderizadorAgenteStreaming";

test("jsonl emite un evento estable por línea", () => {
  const lineas:string[]=[];
  const r=new RenderizadorAgenteStreaming("chat.send","jsonl","req",(s)=>lineas.push(s));
  r.renderizar({tipo:"modelo",nombre:"max"});
  r.renderizar({tipo:"respuesta",contenido:"OK"});
  r.renderizar({tipo:"fin"});
  expect(lineas).toHaveLength(3);
  expect(JSON.parse(lineas[0]!).event).toBe("model.selected");
  expect(JSON.parse(lineas[1]!).data.content).toBe("OK");
  expect(JSON.parse(lineas[2]!).event).toBe("completed");
});

test("json acumula una respuesta final", () => {
  const lineas:string[]=[];
  const r=new RenderizadorAgenteStreaming("chat.send","json","req",(s)=>lineas.push(s));
  r.renderizar({tipo:"respuesta",contenido:"O"});
  r.renderizar({tipo:"respuesta",contenido:"K"});
  r.renderizar({tipo:"fin"});
  expect(lineas).toHaveLength(1);
  expect(JSON.parse(lineas[0]!).data.response).toBe("OK");
});

test("json publica errores de stream como fallo", () => {
  const lineas: string[] = [];
  const r = new RenderizadorAgenteStreaming("chat.send", "json", "req", (s) => lineas.push(s));
  r.renderizar({ tipo: "error", mensaje: "fallo remoto" });
  const sobre = JSON.parse(lineas[0]!);
  expect(sobre.ok).toBeFalse();
  expect(r.codigoSalida).toBeGreaterThan(0);
});

test("finalizar detecta stream incompleto", () => {
  const lineas: string[] = [];
  const r = new RenderizadorAgenteStreaming("chat.send", "json", "req", (s) => lineas.push(s));
  r.renderizar({ tipo: "respuesta", contenido: "parcial" });
  r.finalizar();
  expect(JSON.parse(lineas[0]!).ok).toBeFalse();
});
