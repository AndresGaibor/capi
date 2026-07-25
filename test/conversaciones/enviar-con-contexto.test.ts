import { expect, test } from "bun:test";
import { EnviarMensajeConContexto } from "../../src/modulos/chat/aplicacion/EnviarMensajeConContexto";

const mockRepoCompleto = {
  adquirirEjecucion: () => true,
  liberarEjecucion: () => {},
  renovarEjecucion: () => true,
  adquirirOcupacion: () => true,
  renovarOcupacion: () => true,
  liberarOcupacion: () => {},
  listarConversacionesProyecto: () => [] as any[],
  registrarConversacion: () => {},
  iniciarEjecucionHistorial: () => {},
  finalizarEjecucionHistorial: () => {},
  guardarSnapshotContexto: () => {},
  registrarAdjuntosConfirmados: () => {},
  obtenerResumenConversacion: () => null,
  guardarResumenConversacion: () => {},
  obtenerHashesContexto: () => ({}),
};

test("si la conversación elegida se ocupa en una carrera no crea otra", async () => {
  const proveedor: any = { id: "qwen", async *enviarMensaje() { yield { tipo: "fin" } }, obtenerConversacionActual: async () => "nueva" };
  const proveedores: any = { obtener: () => proveedor };
  const gestor: any = { seleccionar: () => ({ proyecto: { id: "p", nombre: "P" }, seleccion: { conversacionId: "vieja", motivo: "reciente_ruta" } }) };
  const repo: any = {
    ...mockRepoCompleto,
    listarConversacionesProyecto: () => [{ id: "vieja" }],
    adquirirOcupacion: () => false,
  };
  await expect((async () => {
    for await (const _ of new EnviarMensajeConContexto(proveedores, gestor, repo).ejecutar("qwen", { prompt: "hola" })) {}
  })()).rejects.toThrow("No se creará una conversación nueva");
});

test("ante alta demanda baja de preview a max y continúa", async () => {
  const modelos: string[] = [];
  const proveedor: any = { id: "qwen", async *enviarMensaje(p: any) { modelos.push(p.modelo); if (p.modelo === "preview") throw new Error("alta demanda"); yield { tipo: "respuesta", contenido: "OK" }; yield { tipo: "fin" } }, obtenerConversacionActual: async () => "nueva" };
  const proveedores: any = { obtener: () => proveedor };
  const gestor: any = { seleccionar: () => ({ proyecto: { id: "p", nombre: "P" }, seleccion: { motivo: "nueva" } }) };
  const repo: any = mockRepoCompleto;
  const eventos: any[] = [];
  for await (const e of new EnviarMensajeConContexto(proveedores, gestor, repo).ejecutar("qwen", { prompt: "hola", modelo: "preview" })) eventos.push(e);
  expect(modelos).toEqual(["preview", "max"]);
  expect(eventos.some((e) => e.mensaje?.includes("max"))).toBeTrue();
  expect(eventos.some((e) => e.contenido === "OK")).toBeTrue();
});

test("DeepSeek degrada de expert a default en la misma conversación", async () => {
  const peticiones: any[] = [];
  const proveedor: any = { id: "deepseek", async *enviarMensaje(p: any) { peticiones.push(p); if (p.modelo === "expert") throw new Error("Server is busy."); yield { tipo: "respuesta", contenido: "OK" }; yield { tipo: "fin" } }, obtenerConversacionActual: async () => "nueva-default" };
  const proveedores: any = { obtener: () => proveedor };
  const gestor: any = { seleccionar: () => ({ proyecto: { id: "p", nombre: "P" }, seleccion: { conversacionId: "chat-expert", motivo: "reciente_ruta" } }) };
  const repo: any = { ...mockRepoCompleto, listarConversacionesProyecto: () => [{ id: "chat-expert" }] };
  for await (const _ of new EnviarMensajeConContexto(proveedores, gestor, repo).ejecutar("deepseek", { prompt: "hola", modelo: "expert" })) {}
  expect(peticiones[0]).toMatchObject({ modelo: "expert", conversacionId: "chat-expert" });
  expect(peticiones[1]).toMatchObject({ modelo: "default", conversacionId: "chat-expert", nuevaPestana: true });
});

test("empaqueta múltiples fuentes y entrega un solo txt al proveedor", async () => {
  const peticiones: any[] = [];
  const proveedor: any = { id: "qwen", async *enviarMensaje(p: any) { peticiones.push(p); yield { tipo: "fin" } }, obtenerConversacionActual: async () => "nueva" };
  const proveedores: any = { obtener: () => proveedor };
  const gestor: any = { seleccionar: () => ({ proyecto: { id: "p", nombre: "P", rutaRaiz: "/proyecto" }, seleccion: { motivo: "nueva" } }) };
  const repo: any = mockRepoCompleto;
  const empaquetador: any = { empaquetar: async () => ({ ruta: "/cache/contexto.txt", hash: "h", bytes: 100, tokensEstimados: 25, archivosIncluidos: 2, omitidos: [], truncados: [], desdeCache: false }) };
  const eventos: any[] = [];
  for await (const e of new EnviarMensajeConContexto(proveedores, gestor, repo, empaquetador).ejecutar("qwen", { prompt: "hola", archivos: ["src", "README.md"] })) eventos.push(e);
  expect(peticiones[0].archivos).toEqual(["/cache/contexto.txt"]);
  expect(eventos.some((e) => e.tipo === "contexto" && e.archivosIncluidos === 2)).toBeTrue();
});

test("cancela cooperativamente y libera leases al superar timeout", async () => {
  let liberada = false, ejecucionLiberada = false;
  const proveedor: any = { id: "deepseek", async *enviarMensaje() { await new Promise(r => setTimeout(r, 100)); yield { tipo: "fin" } } };
  const gestor: any = { seleccionar: () => ({ proyecto: { id: "p", nombre: "P", rutaRaiz: "/tmp" }, seleccion: { conversacionId: "c", motivo: "reciente_ruta" } }) };
  const repo: any = {
    ...mockRepoCompleto,
    liberarOcupacion: () => { liberada = true; },
    liberarEjecucion: () => { ejecucionLiberada = true; },
  };
  const ejecutar = async () => { for await (const _ of new EnviarMensajeConContexto({ obtener: () => proveedor } as any, gestor, repo).ejecutar("deepseek", { prompt: "x", timeoutMs: 10 })) {} };
  await expect(ejecutar()).rejects.toThrow("excedió 10 ms");
  expect(liberada).toBeTrue();
  expect(ejecucionLiberada).toBeTrue();
});

test("recupera una sola vez conversación inválida y propaga el segundo fallo", async () => {
  const peticiones: any[] = [];
  const invalida = Object.assign(new Error("conversación eliminada"), { codigo: "CONVERSACION_INVALIDA" });
  const proveedor: any = { id: "qwen", async *enviarMensaje(p: any) { peticiones.push(p); throw invalida; } };
  const gestor: any = { seleccionar: () => ({ proyecto: { id: "p", nombre: "P" }, seleccion: { conversacionId: "vieja", motivo: "persistente" } }) };
  const salud: any[] = [];
  const repo: any = { ...mockRepoCompleto, listarConversacionesProyecto: () => [{ id: "vieja" }], marcarSaludConversacion: (...args: any[]) => salud.push(args) };
  const ejecutar = async () => { for await (const _ of new EnviarMensajeConContexto({ obtener: () => proveedor } as any, gestor, repo).ejecutar("qwen", { prompt: "hola", permitirFallback: false })) {} };
  await expect(ejecutar()).rejects.toThrow("conversación eliminada");
  expect(peticiones).toHaveLength(2);
  expect(peticiones[0]).toMatchObject({ conversacionId: "vieja" });
  expect(peticiones[1]).toMatchObject({ conversacionId: undefined, nuevaPestana: true });
  expect(salud).toEqual([["vieja", "qwen", "eliminada_remotamente", "CONVERSACION_INVALIDA"]]);
});
