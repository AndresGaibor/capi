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

> 🤖 **Guías de navegación para agentes**: Consulta el mapa detallado en [`AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/AGENTS.md) o navega por capas:
> - [`src/nucleo/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/AGENTS.md) | [`src/modulos/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/AGENTS.md) | [`src/proveedores/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/proveedores/AGENTS.md)
> - [`src/plataforma/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/plataforma/AGENTS.md) | [`src/entradas/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/entradas/AGENTS.md) | [`test/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/test/AGENTS.md)


Los casos de uso no conocen selectores DOM, WebBridge ni proveedores concretos. El contexto local usa `bun:sqlite`, leases renovables y un límite atómico de tres ejecuciones simultáneas. Cada proveedor encapsula navegación, modelos, envío y streaming. DeepSeek también implementa sesión, conversaciones y mensajes. Para recuperar respuestas usa el DOM y, como respaldos, IndexedDB y la API autenticada de historial dentro de la propia pestaña; el token nunca sale del navegador ni se registra.

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
bun run src/cli.ts chat -f src,test --diff --limite-contexto 4194304 "Revisa los cambios"
bun run src/cli.ts chat --contexto-auto --incremental --resumen "Continúa el trabajo"
bun run src/cli.ts chat -f archivo.txt --no-empaquetar "Lee este archivo"
bun run src/cli.ts contexto empaquetar --fuentes src,test --diff --output json
bun run src/cli.ts contexto explicar --automatico -p qwen -m max --output json
bun run src/cli.ts historial listar --limite 20 --output json
bun run src/cli.ts estado metricas --output json
bun run src/cli.ts estado exportar --archivo /tmp/capi-proyecto.json
bun run src/cli.ts estado importar --archivo /tmp/capi-proyecto.json --confirmar
bun run src/cli.ts estado limpiar --capas cache,snapshots --confirmar --output json
bun run src/cli.ts diagnostico contratos --output json
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

El contexto acepta archivos, directorios, globs, JSON, listas por comas y manifiestos `@archivo`. `--contexto-auto` selecciona cambios Git, imports relativos, pruebas relacionadas y archivos base; `--incremental` omite archivos sin cambios ya enviados a la conversación; `--resumen` añade el resumen persistente. Por defecto CAPI excluye secretos y binarios, combina las fuentes en un único `.txt`, puede añadir `git diff`, aplica presupuestos de bytes y tokens por proveedor/modelo y reutiliza el paquete por hash. El ranking local prioriza coincidencias del prompt en nombre, ruta y contenido. Los adjuntos confirmados se registran por hash y conversación para sostener el modo incremental. `--no-empaquetar` conserva los archivos originales cuando el proveedor debe recibirlos por separado.

Los resúmenes largos se compactan conservando decisiones, errores, resultados y archivos. Con `CAPI_LOCAL_ENCRYPTION_KEY` los resúmenes se cifran localmente con AES-256-GCM; los exports nunca incluyen sesiones ni tokens. `--timeout <ms>` cancela cooperativamente una ejecución y libera sus leases.

La recuperación automática usa `Qwen preview → max → plus`. DeepSeek puede degradar `expert/vision → default`, pero siempre abre un chat nuevo al cambiar de modelo. Usa `--no-fallback` cuando el modelo exacto sea obligatorio.

## MCP y skills

El servidor MCP local reutiliza el mismo núcleo:

```bash
bun run mcp
# o
bun run src/cli.ts mcp
```

Expone `capi_discover`, `capi_schema`, `capi_project_current`, `capi_conversations_project`, `capi_doctor`, `capi_context_pack`, `capi_context_explain`, `capi_history_project`, `capi_diagnostics_contracts`, `capi_state_metrics`, `capi_state_clean`, `capi_state_export`, `capi_state_import` y `capi_chat`. Un descriptor genérico está en `mcp/capi.example.json`.

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
bun run contracts:check
bun run smoke:archivo:deepseek
bun run smoke:archivo:qwen
```

`bun run verify` ejecuta TypeScript, toda la suite y una puerta mínima de 80% de cobertura de líneas para las capas modulares. Los smokes requieren WebBridge y comprueban el recorrido real prompt → respuesta → fin. Los smokes de archivos usan un límite de 90 segundos por defecto para evitar bloqueos indefinidos; puede ajustarse con `CAPI_SMOKE_TIMEOUT_MS`. Qwen puede devolver alta demanda o finalizar sin contenido aunque la carga del adjunto haya sido correcta; en ese caso CAPI ofrece el fallback exacto a DeepSeek.

## Pruebas

La suite cubre contratos, casos de uso, composición, CLI, reglas arquitectónicas, navegación, selección de modelos, envío, streaming, errores, fixtures DOM, respuestas A/B, respuesta vacía, respaldo IndexedDB, historial autenticado, contexto incremental y estrategias de adjuntos.

## Reglas arquitectónicas

- `nucleo` no depende de capas externas.
- `modulos` no contiene DOM ni `fetch`.
- Los proveedores no importan DI ni otros proveedores.
- Los proveedores no usan `fetch` directamente.
- Los errores de proveedor se expresan mediante excepciones tipadas.
- SQL solo existe en la plataforma de persistencia.
- La ruta de origen de una conversación compartida no cambia al reutilizarla desde otra ruta vinculada.
- Los errores transitorios de Qwen, incluida alta demanda, se detectan desde su bloque de alerta y no se confunden con respuestas vacías.

## Imágenes y visión

CAPI detecta PNG, JPEG, WebP y GIF por firma, incluso cuando la extensión es incorrecta. Las imágenes nunca se incluyen en el bundle textual: se adjuntan de forma nativa con MIME real.

```bash
bun run src/cli.ts chat --imagen captura.png -p qwen --output jsonl \
  "Describe la imagen y devuelve texto visible e incertidumbres"
bun run src/cli.ts vision analizar captura.png --tipo ui --output json
bun run src/cli.ts vision comparar antes.png despues.png --output json
```

`--imagen` puede repetirse y también acepta coma, JSON o `@manifiesto`. Pasar una imagen mediante `-f` funciona igualmente porque CAPI separa automáticamente texto, imágenes y PDF. Qwen `preview` y `plus` tienen contrato visual; `max` es solo texto; el nombre visible real, por ejemplo `Qwen3.8-Max-Preview`, puede cambiar y se descubre desde la página. DeepSeek solo usa `vision` para imágenes y nunca degrada una solicitud visual a `default` o `expert`.

Herramientas MCP adicionales: `capi_vision_analyze` y `capi_vision_compare`. Están diseñadas para agentes que no pueden analizar imágenes: solicitan JSON autosuficiente y conservan un arreglo de `incertidumbres`.
