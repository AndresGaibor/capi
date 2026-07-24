import { expect, test } from "bun:test";
import { construirIntentosRecuperacion, esErrorTransitorioProveedor } from "../../src/modulos/chat/aplicacion/PoliticaRecuperacionProveedor";

test("Qwen preview baja progresivamente a max y plus",()=>{
  expect(construirIntentosRecuperacion("qwen","preview")).toEqual([
    { proveedor:"qwen", modelo:"preview" },
    { proveedor:"qwen", modelo:"max" },
    { proveedor:"qwen", modelo:"plus" },
  ]);
});

test("DeepSeek expert baja a default",()=>{
  expect(construirIntentosRecuperacion("deepseek","expert")).toEqual([
    { proveedor:"deepseek", modelo:"expert" },
    { proveedor:"deepseek", modelo:"default" },
  ]);
});

test("reconoce alta demanda y servidor ocupado como transitorios",()=>{
  expect(esErrorTransitorioProveedor(new Error("El servicio está experimentando una alta demanda"))).toBeTrue();
  expect(esErrorTransitorioProveedor(new Error("Server is busy."))).toBeTrue();
  expect(esErrorTransitorioProveedor(new Error("Modelo no disponible"))).toBeFalse();
});
