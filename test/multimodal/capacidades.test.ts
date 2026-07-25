import { expect, test } from "bun:test";
import { intentosMultimodales, seleccionarModeloMultimodal } from "../../src/modulos/modelos/aplicacion/SeleccionarModeloMultimodal";

test("selecciona modelo visual compatible", () => {
  expect(seleccionarModeloMultimodal("qwen", undefined, "image", ["image/png"])).toBe("preview");
  expect(seleccionarModeloMultimodal("deepseek", "default", "image", ["image/jpeg"])).toBe("vision");
});

test("fallback visual excluye modelos solo texto", () => {
  expect(intentosMultimodales("qwen", "image")).toEqual(["preview", "plus"]);
  expect(intentosMultimodales("deepseek", "image")).toEqual(["vision"]);
});

test("modo estricto rechaza Qwen3.7-Max para imágenes", () => {
  expect(() => seleccionarModeloMultimodal("qwen", "max", "image", ["image/png"], true))
    .toThrow("no es compatible con image");
});
