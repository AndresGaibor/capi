import { expect, test } from "bun:test";
import { crearServidorMcp } from "../../src/entradas/mcp/servidor";
test("crea un servidor MCP sin iniciar transporte",()=>{expect(crearServidorMcp()).toBeDefined();});
