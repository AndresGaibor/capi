# Integración de CAPI con agentes

CAPI ofrece dos interfaces sobre el mismo núcleo: CLI estructurada y MCP local por `stdio`.

## CLI

La CLI es la interfaz universal y más fácil de depurar. `discover` expone el manifiesto completo; `schema` devuelve el contrato de cada comando. Para streaming se usa JSON Lines, una línea JSON independiente por evento.

```bash
capi discover --output json
capi schema chat.send --output json
capi chat --dry-run --output json "Revisa el proyecto"
capi chat --output jsonl "Revisa el proyecto"
capi chat -f src,test --diff --limite-contexto 4194304 --output jsonl "Revisa los cambios"
capi chat -f archivo.txt --no-empaquetar --output jsonl "Lee el archivo"
capi chat --contexto-auto --incremental --resumen --output jsonl "Continúa el trabajo"
capi contexto explicar --automatico -p qwen -m max --output json
capi historial listar --output json
capi estado metricas --output json
capi estado exportar --archivo /tmp/capi-proyecto.json
capi chat --timeout 120000 --output jsonl "Revisa el proyecto"
```

Los sobres no streaming usan el protocolo `capi.agent.v1` con `ok`, `command`, `requestId`, `data`, `error` y `suggestions`. La salida estructurada nunca contiene ANSI.

Las fuentes de contexto pueden ser archivos, directorios, globs, listas por comas, JSON o un manifiesto `@ruta`. El modo automático usa Git, imports relativos, pruebas relacionadas y archivos base. El modo incremental compara hashes por conversación y solo reenvía cambios. CAPI las rankea localmente respecto al prompt, las empaqueta por defecto en un único `.txt`, excluye secretos y binarios, informa truncamientos y reutiliza la caché por contenido. Los presupuestos incluyen bytes, tokens máximos y relación de caracteres por token. Usa `--no-empaquetar` cuando el agente necesite conservar adjuntos separados.

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
- `capi_context_pack`
- `capi_context_explain`
- `capi_history_project`
- `capi_diagnostics_contracts`
- `capi_state_metrics`
- `capi_state_clean`
- `capi_state_export`
- `capi_state_import`
- `capi_chat`

DeepSeek consulta su historial autenticado únicamente dentro de la pestaña cuando el DOM virtual todavía no monta la respuesta; CAPI no persiste ni muestra el token.

El MCP no duplica reglas: delega al mismo gestor de proyectos, conversaciones, proveedores, recuperación y persistencia que la CLI.

## Compatibilidad

La configuración exacta del cliente cambia entre Codex, Claude Code, OpenCode, Gemini CLI, Cursor, Zed y otras herramientas. En todos los casos usa transporte `stdio`, comando `bun` y el archivo `src/mcp.ts`. Cuando el cliente no soporte MCP, instala o referencia `.agents/skills/capi/SKILL.md` y usa la CLI.

## Estado local y portabilidad

`capi estado exportar` genera `capi.project.v1` sin cookies, tokens ni sesiones. La importación exige confirmación y fusiona de forma idempotente. `CAPI_LOCAL_ENCRYPTION_KEY` habilita AES-256-GCM para resúmenes persistentes. La limpieza selectiva también exige confirmación.

## Seguridad

CAPI no ejecuta comandos proporcionados por el modelo. Los adjuntos deben pasarse como rutas explícitas. No envíes credenciales, cookies, tokens ni secretos en prompts. Revisa los efectos declarados por `schema` antes de automatizar operaciones.

## Agentes sin capacidad de visión

CAPI funciona como delegado visual. Las imágenes se detectan por firma, se separan del contexto textual y se envían con su MIME real.

```bash
capi vision analizar captura.png --tipo descripcion --output json
capi vision analizar factura.jpg --tipo ocr --output json
capi vision analizar pantalla.webp --tipo ui --output json
capi vision analizar arquitectura.png --tipo diagrama --output json
capi vision analizar tabla.png --tipo tabla --output json
capi vision comparar antes.png despues.png --output json
```

MCP expone `capi_vision_analyze` y `capi_vision_compare`; `capi_chat` acepta `images`. Las respuestas piden JSON válido con `incertidumbres`, por lo que el agente invocador puede razonar sin tener visión. Nunca conviertas la imagen a Base64 dentro del prompt. Qwen visual usa `preview` (Qwen3.8-Max-Preview) o `plus` (Qwen3.7-Plus); `max` (Qwen3.7-Max) es solo texto. DeepSeek solo participa con `vision`. Un nombre visible como Qwen 3.8 se reporta desde la página, mientras los aliases estables de CAPI siguen siendo `preview`, `max` y `plus`.
