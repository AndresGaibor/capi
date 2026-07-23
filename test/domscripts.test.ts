import { test, expect } from "bun:test";
import { DomSelectors } from "../src/adaptadores/webbridge/DomSelectors";
import { DomScripts } from "../src/adaptadores/webbridge/scripts/DomScripts";

test("DomSelectors define selectores clave del header y chat", () => {
  expect(DomSelectors.header.modelBadge).toContain("c03d486a");
  expect(DomSelectors.input.textarea).toBe('textarea[name="search"]');
  expect(DomSelectors.response.thinkOfficial).toBe(".ds-think-content");
});

test("DomScripts genera scripts ejecutables sintácticamente válidos", () => {
  const scriptHeader = DomScripts.scriptObtenerModeloHeader();
  expect(scriptHeader).toContain("spanHeader");

  const scriptConfig = DomScripts.scriptConfigurarInterfaz({ modelo: "expert", deepThink: true }, true);
  expect(scriptConfig).toContain("expert");

  const scriptPrompt = DomScripts.scriptEnviarPrompt("Hola mundo");
  expect(scriptPrompt).toContain("Hola mundo");

  const scriptStreaming = DomScripts.scriptEstadoStreaming();
  expect(scriptStreaming).toContain("thinkNodes");
});
