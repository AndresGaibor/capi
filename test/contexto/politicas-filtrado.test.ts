import { describe, expect, test } from "bun:test";
import {
  DIRECTORIOS_IGNORADOS,
  EXTENSIONES_BINARIAS,
  NOMBRES_SECRETOS,
  normalizarRuta,
  esIgnorada,
  pareceBinario,
  sanearTexto,
} from "../../src/modulos/contexto/aplicacion/PoliticasFiltradoContexto";

describe("PoliticasFiltradoContexto", () => {
  describe("normalizarRuta", () => {
    test("resuelve rutas relativas respecto a cwd", () => {
      const result = normalizarRuta("/proyecto", "src/index.ts");
      expect(result).toBe("/proyecto/src/index.ts");
    });

    test("no modifica rutas absolutas", () => {
      const result = normalizarRuta("/proyecto", "/absoluta/file.ts");
      expect(result).toBe("/absoluta/file.ts");
    });
  });

  describe("esIgnorada", () => {
    test("detecta archivos en directorios ignorados", () => {
      const result = esIgnorada("/proyecto/node_modules/pkg/index.js", "/proyecto");
      expect(result).toBe("directorio ignorado");
    });

    test("detecta archivos sensibles", () => {
      expect(esIgnorada("/proyecto/.env", "/proyecto")).toBe("archivo sensible");
      expect(esIgnorada("/proyecto/config/secrets.yml", "/proyecto")).toBe("archivo sensible");
      expect(esIgnorada("/proyecto/keys/id_rsa", "/proyecto")).toBe("archivo sensible");
    });

    test("detecta extensiones binarias", () => {
      expect(esIgnorada("/proyecto/imagen.png", "/proyecto")).toBe("archivo binario");
      expect(esIgnorada("/proyecto/archivo.pdf", "/proyecto")).toBe("archivo binario");
      expect(esIgnorada("/proyecto/video.mp4", "/proyecto")).toBe("archivo binario");
    });

    test("retorna null para archivos validos", () => {
      expect(esIgnorada("/proyecto/src/index.ts", "/proyecto")).toBeNull();
      expect(esIgnorada("/proyecto/readme.md", "/proyecto")).toBeNull();
    });
  });

  describe("pareceBinario", () => {
    test("detecta bytes nulos en contenido", () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02]);
      expect(pareceBinario(buffer)).toBe(true);
    });

    test("retorna false para texto utf8", () => {
      const buffer = Buffer.from("hola mundo", "utf8");
      expect(pareceBinario(buffer)).toBe(false);
    });

    test("solo muestrea los primeros 8192 bytes", () => {
      const grande = Buffer.alloc(10000);
      grande[0] = 0x00;
      expect(pareceBinario(grande)).toBe(true);
    });
  });

  describe("sanearTexto", () => {
    test("normaliza saltos de linea Windows a Unix", () => {
      expect(sanearTexto("linea1\r\nlinea2")).toBe("linea1\nlinea2");
    });

    test("redacta secretos en texto", () => {
      expect(sanearTexto("api_key=abc123")).toBe("api_key=[REDACTADO]");
      expect(sanearTexto("token: my-secret-token")).toBe("token: [REDACTADO]");
      expect(sanearTexto("password=supersecret")).toBe("password=[REDACTADO]");
    });

    test("no redacta si no hay secretos", () => {
      expect(sanearTexto("hola mundo")).toBe("hola mundo");
    });

    test("elimina espacios en blanco al final de linea", () => {
      expect(sanearTexto("linea con espacios   \notra linea")).toBe("linea con espacios\notra linea");
    });
  });

  describe("constantes", () => {
    test("DIRECTORIOS_IGNORADOS contiene los valores esperados", () => {
      expect(DIRECTORIOS_IGNORADOS.has("node_modules")).toBe(true);
      expect(DIRECTORIOS_IGNORADOS.has(".git")).toBe(true);
      expect(DIRECTORIOS_IGNORADOS.has("dist")).toBe(true);
    });

    test("EXTENSIONES_BINARIAS detecta extensiones comunes", () => {
      expect(EXTENSIONES_BINARIAS.test("imagen.png")).toBe(true);
      expect(EXTENSIONES_BINARIAS.test("foto.jpg")).toBe(true);
      expect(EXTENSIONES_BINARIAS.test("archivo.pdf")).toBe(true);
      expect(EXTENSIONES_BINARIAS.test("codigo.ts")).toBe(false);
    });

    test("NOMBRES_SECRETOS detecta archivos sensibles", () => {
      expect(NOMBRES_SECRETOS.test(".env")).toBe(true);
      expect(NOMBRES_SECRETOS.test(".env.production")).toBe(true);
      expect(NOMBRES_SECRETOS.test("credentials.json")).toBe(true);
      expect(NOMBRES_SECRETOS.test("secrets.yml")).toBe(true);
      expect(NOMBRES_SECRETOS.test("id_rsa")).toBe(true);
      expect(NOMBRES_SECRETOS.test("normal.ts")).toBe(false);
    });
  });
});
