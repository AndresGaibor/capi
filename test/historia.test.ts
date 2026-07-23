import { test, expect } from "bun:test";
import { convertirRegistroHistoria } from "../src/dominio/deepseek/servicios/ConvertirRegistroHistoria";

test("convertirRegistroHistoria convierte objeto IndexedDB a entidad Conversacion", () => {
  const mockRecord = {
    data: {
      chat_session: {
        id: "session-123",
        title: "Prueba CAPI",
        title_type: "CUSTOM",
        model_type: "deepseek-v3",
        pinned: true,
        updated_at: 1700000000,
      },
      chat_messages: [
        {
          role: "user",
          fragments: [{ type: "REQUEST", content: "Hola bot" }],
          message_id: 1,
        },
        {
          role: "assistant",
          fragments: [
            { type: "THINK", content: "Pensando..." },
            { type: "RESPONSE", content: "Hola usuario!" },
          ],
          message_id: 2,
        },
      ],
    },
  };

  const conv = convertirRegistroHistoria(mockRecord);
  expect(conv).not.toBeNull();
  if (conv) {
    expect(conv.id).toBe("session-123");
    expect(conv.titulo).toBe("Prueba CAPI");
    expect(conv.fijada).toBe(true);
    expect(conv.tipoModelo).toBe("deepseek-v3");
    expect(conv.actualizadaEn).toBe(1700000000000);
    expect(conv.mensajes.length).toBe(2);
    expect(conv.mensajes[0]?.rol).toBe("usuario");
    expect(conv.mensajes[1]?.rol).toBe("asistente");
  }
});

test("convertirRegistroHistoria devuelve null si el formato es inválido", () => {
  expect(convertirRegistroHistoria(null)).toBeNull();
  expect(convertirRegistroHistoria({})).toBeNull();
  expect(convertirRegistroHistoria({ data: {} })).toBeNull();
});
