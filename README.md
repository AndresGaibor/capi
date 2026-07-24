# CAPI

CLI modular para interactuar con Qwen y DeepSeek mediante WebBridge local.

## Arquitectura

```text
src/
  nucleo/       contratos, eventos, capacidades y errores neutrales
  modulos/      casos de uso independientes del proveedor
  proveedores/  integraciones de Qwen y DeepSeek
  plataforma/   WebBridge, consola y persistencia
  entradas/     CLI y composition root
```

Los casos de uso no conocen selectores DOM, WebBridge ni proveedores concretos. El contexto local usa `bun:sqlite`, leases renovables y un límite atómico de tres ejecuciones simultáneas. Cada proveedor encapsula navegación, modelos, envío y streaming. DeepSeek también implementa sesión, conversaciones y mensajes, con respaldo de IndexedDB cuando el DOM no expone la respuesta.

## Requisitos

- Bun.
- WebBridge activo en `http://127.0.0.1:10086`.
- Sesión iniciada en el proveedor que se utilizará.

## Comandos

CAPI detecta la raíz Git (o la ruta actual si no existe Git) y mantiene un historial SQLite aislado por proyecto. `capi chat` reutiliza una conversación reciente y libre del proyecto; `--nueva` fuerza un chat limpio. Ante alta demanda reintenta y degrada de forma controlada (`Qwen preview → max → plus`, `DeepSeek expert/vision → default` en un chat nuevo); si el proveedor completo falla, muestra el comando exacto para probar el otro proveedor.

```bash
bun run src/cli.ts chat "Hola"
bun run src/cli.ts chat --nueva -p qwen -m preview "Hola"
bun run src/cli.ts chat enviar -p qwen -m plus "Hola"
bun run src/cli.ts chat enviar -p deepseek -m default "Hola"
bun run src/cli.ts modelos listar -p qwen
bun run src/cli.ts conversaciones listar -p deepseek
bun run src/cli.ts conversaciones mensajes -p deepseek <id>
bun run src/cli.ts conversaciones proyecto
bun run src/cli.ts conversaciones fijar -p qwen <id>
bun run src/cli.ts conversaciones favorita -p qwen <id>
bun run src/cli.ts conversaciones archivar -p qwen <id>
bun run src/cli.ts proyecto actual
bun run src/cli.ts proyecto vincular mi-proyecto
bun run src/cli.ts proyecto configurar -p qwen -m preview --razonamiento
bun run src/cli.ts proyecto preferencias
bun run src/cli.ts diagnostico completo --json
bun run src/cli.ts sesion importar -p deepseek
bun run src/cli.ts diagnostico pagina -p deepseek
bun run src/cli.ts servidor iniciar
```


## Interfaz agent-first

CAPI expone un contrato estable para agentes de código y conserva el modo humano existente.

```bash
# Descubrir capacidades, proveedores, fallbacks y códigos de salida
bun run src/cli.ts discover --output json

# Consultar el contrato exacto antes de invocar
bun run src/cli.ts schema chat.send --output json

# Comprobar qué ocurriría sin abrir ni enviar nada
bun run src/cli.ts chat --dry-run --output json "Analiza el proyecto"

# Streaming estructurado: una línea JSON por evento
bun run src/cli.ts chat --output jsonl "Analiza el proyecto"

# Diagnóstico estructurado
bun run src/cli.ts doctor --output json
```

Formatos disponibles: `human`, `markdown`, `json` y `jsonl`. La salida estructurada usa `capi.agent.v1`, no contiene ANSI y conserva un `requestId` correlacionable. Los errores incluyen código, carácter reintentable y sugerencias ejecutables.

La recuperación automática usa `Qwen preview → max → plus`. DeepSeek puede degradar `expert/vision → default`, pero siempre abre un chat nuevo al cambiar de modelo. Usa `--no-fallback` cuando el modelo exacto sea obligatorio.

## MCP y skills

El servidor MCP local reutiliza el mismo núcleo:

```bash
bun run mcp
# o
bun run src/cli.ts mcp
```

Expone `capi_discover`, `capi_schema`, `capi_project_current`, `capi_conversations_project`, `capi_doctor` y `capi_chat`. Un descriptor genérico está en `mcp/capi.example.json`.

Para agentes sin MCP, usa `AGENTS.md` y la skill portable `.agents/skills/capi/SKILL.md`. La guía completa está en `docs/agentes/integracion.md`.

## Modelos

Qwen acepta los aliases `plus`, `max` y `preview`. DeepSeek acepta `default`, `expert` y `vision`.

## Validación

```bash
bun run typecheck
bun test
bun run coverage
bun run verify
bun run smoke:qwen
bun run smoke:deepseek
```

`bun run verify` ejecuta TypeScript, toda la suite y una puerta mínima de 80% de cobertura de líneas para las capas modulares. Los smokes requieren WebBridge y comprueban el recorrido real prompt → respuesta → fin.

## Pruebas

La suite cubre contratos, casos de uso, composición, CLI, reglas arquitectónicas, navegación, selección de modelos, envío, streaming, errores, fixtures DOM, respuestas A/B, respuesta vacía y respaldo IndexedDB.

## Reglas arquitectónicas

- `nucleo` no depende de capas externas.
- `modulos` no contiene DOM ni `fetch`.
- Los proveedores no importan DI ni otros proveedores.
- Los proveedores no usan `fetch` directamente.
- Los errores de proveedor se expresan mediante excepciones tipadas.
- SQL solo existe en la plataforma de persistencia.
- La ruta de origen de una conversación compartida no cambia al reutilizarla desde otra ruta vinculada.
- Los errores transitorios de Qwen, incluida alta demanda, se detectan desde su bloque de alerta y no se confunden con respuestas vacías.
