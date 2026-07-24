import { expect, test } from "bun:test";
import { comandoChatEnviar } from "../../src/entradas/cli/comandos/chat/enviar";
import { comandoModelosListar } from "../../src/entradas/cli/comandos/modelos/listar";
import { comandoConversacionesListar } from "../../src/entradas/cli/comandos/conversaciones/listar";
import { comandoConversacionesMensajes } from "../../src/entradas/cli/comandos/conversaciones/mensajes";
import { comandoSesionImportar } from "../../src/entradas/cli/comandos/sesion/importar";
import { comandoDiagnosticoPagina } from "../../src/entradas/cli/comandos/diagnostico/pagina";
test('comandos tienen run y argumentos',()=>{for(const c of [comandoChatEnviar,comandoModelosListar,comandoConversacionesListar,comandoConversacionesMensajes,comandoSesionImportar,comandoDiagnosticoPagina]){expect(typeof c.run).toBe('function');expect(c.args ?? {}).toBeTruthy()}});
