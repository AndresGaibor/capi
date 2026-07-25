import { expect, test } from "bun:test";
import { comandoPrincipal, ejecutarCli } from "../../src/entradas/cli/cli";
test("CLI expone todos los comandos",()=>{expect(Object.keys(comandoPrincipal.subCommands ?? {})).toEqual(["discover","schema","doctor","mcp","chat","vision","contexto","historial","estado","modelos","proyecto","conversaciones","sesion","diagnostico","servidor","tareas"]);expect(typeof ejecutarCli).toBe("function")});
