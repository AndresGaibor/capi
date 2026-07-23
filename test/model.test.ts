import { test, expect } from "bun:test";

test("restricción de modelo en conversaciones existentes vs chats nuevos", () => {
  function sePermiteCambiarModelo(idConversacion: string, modeloDeseado?: string): boolean {
    if (!modeloDeseado) return false;
    const esChatNuevo = idConversacion === "new";
    return esChatNuevo;
  }

  expect(sePermiteCambiarModelo("new", "expert")).toBe(true);
  expect(sePermiteCambiarModelo("7a0ce1db-0556-4955-8091-8a93b4f7751c", "expert")).toBe(false);
  expect(sePermiteCambiarModelo("new", undefined)).toBe(false);
});

test("extracción de selector de modelo desde header HTML de DeepSeek", () => {
  const htmlHeaderMock = `
    <div class="_2be88ba">
      <div class="f8d1e4c0 the-header">
        <div class="_9fcbeda">
          <div class="afa34042">TypeScript explicación</div>
          <div class="c03d486a">
            <span class="_46a12ab">Instant</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Simulación de parser Regex/DOM para la regla de extracción de header
  const match = htmlHeaderMock.match(/class="_46a12ab">([^<]+)<\/span>/);
  expect(match).not.toBeNull();
  expect(match?.[1]).toBe("Instant");
});
