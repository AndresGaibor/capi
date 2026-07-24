import { defineCommand } from "citty";
import { iniciarServidorMcp } from "../../../mcp/servidor";
export const comandoMcp = defineCommand({ meta:{name:"mcp",description:"Iniciar servidor MCP local por stdio"}, run:()=>iniciarServidorMcp() });
