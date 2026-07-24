import { expect, test } from "bun:test";
import { comandoPrincipal, ejecutarCli } from "../../src/entradas/cli/cli";
test("CLI expone todos los comandos",()=>{expect(Object.keys(comandoPrincipal.subCommands ?? {})).toEqual(["chat","modelos","conversaciones","sesion","diagnostico","servidor"]);expect(typeof ejecutarCli).toBe("function")});
