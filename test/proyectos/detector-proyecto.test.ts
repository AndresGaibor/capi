import { describe, expect, test } from "bun:test";
import { detectarProyectoDesdeRuta } from "../../src/modulos/proyectos/aplicacion/DetectarProyecto";

describe("detectarProyectoDesdeRuta", () => {
  test("usa la raíz Git cuando existe", () => {
    const proyecto = detectarProyectoDesdeRuta("/repo/apps/api", () => "/repo");
    expect(proyecto.rutaRaiz).toBe("/repo");
    expect(proyecto.tipoDeteccion).toBe("git");
  });

  test("usa la ruta actual cuando no existe Git", () => {
    const proyecto = detectarProyectoDesdeRuta("/tmp/carpeta", () => null);
    expect(proyecto.rutaRaiz).toBe("/tmp/carpeta");
    expect(proyecto.tipoDeteccion).toBe("ruta");
  });
});
