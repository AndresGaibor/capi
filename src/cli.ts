#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import { chatCommand } from "./comandos/chat";
import { authCommand } from "./comandos/auth";
import { serveCommand } from "./comandos/serve";
import { captureCommand } from "./comandos/capture";

const cli = defineCommand({
  meta: {
    name: "capi",
    version: "1.0.0",
    description: "CLI para interactuar con diversas plataformas de chat",
  },
  subCommands: {
    chat: chatCommand,
    auth: authCommand,
    serve: serveCommand,
    capture: captureCommand,
  },
});

runMain(cli);
