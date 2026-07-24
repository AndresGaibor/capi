import { describe, expect, test } from "bun:test";
import { ClienteWebBridge } from "../../src/plataforma/webbridge/ClienteWebBridge";
describe("ClienteWebBridge",()=>{test("reporta indisponibilidad",async()=>{const c=new ClienteWebBridge("http://127.0.0.1:1");expect(await c.estaDisponible()).toBeFalse()})});
