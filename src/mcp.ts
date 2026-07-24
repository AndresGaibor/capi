#!/usr/bin/env bun
import { iniciarServidorMcp } from "./entradas/mcp/servidor";
iniciarServidorMcp().catch((error) => { console.error(error); process.exit(1); });
