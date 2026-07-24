# Integración de CAPI con agentes

CAPI ofrece dos interfaces sobre el mismo núcleo: CLI estructurada y MCP local por `stdio`.

## CLI

La CLI es la interfaz universal y más fácil de depurar. `discover` expone el manifiesto completo; `schema` devuelve el contrato de cada comando. Para streaming se usa JSON Lines, una línea JSON independiente por evento.

```bash
capi discover --output json
capi schema chat.send --output json
capi chat --dry-run --output json "Revisa el proyecto"
capi chat --output jsonl "Revisa el proyecto"
```

Los sobres no streaming usan el protocolo `capi.agent.v1` con `ok`, `command`, `requestId`, `data`, `error` y `suggestions`. La salida estructurada nunca contiene ANSI.

## MCP

Ejecuta el servidor local:

```bash
bun run /ruta/absoluta/capi/src/mcp.ts
```

Descriptor genérico para clientes MCP:

```json
{
  "mcpServers": {
    "capi": {
      "command": "bun",
      "args": ["run", "/ruta/absoluta/capi/src/mcp.ts"]
    }
  }
}
```

Herramientas expuestas:

- `capi_discover`
- `capi_schema`
- `capi_project_current`
- `capi_conversations_project`
- `capi_doctor`
- `capi_chat`

El MCP no duplica reglas: delega al mismo gestor de proyectos, conversaciones, proveedores, recuperación y persistencia que la CLI.

## Compatibilidad

La configuración exacta del cliente cambia entre Codex, Claude Code, OpenCode, Gemini CLI, Cursor, Zed y otras herramientas. En todos los casos usa transporte `stdio`, comando `bun` y el archivo `src/mcp.ts`. Cuando el cliente no soporte MCP, instala o referencia `.agents/skills/capi/SKILL.md` y usa la CLI.

## Seguridad

CAPI no ejecuta comandos proporcionados por el modelo. Los adjuntos deben pasarse como rutas explícitas. No envíes credenciales, cookies, tokens ni secretos en prompts. Revisa los efectos declarados por `schema` antes de automatizar operaciones.
