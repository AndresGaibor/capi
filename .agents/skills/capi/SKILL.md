---
name: capi
description: Usa CAPI para Qwen 3.8, Qwen 3.7, DeepSeek, contexto de proyecto, archivos e imágenes. Actívala al delegar análisis, código, OCR, UI, diagramas o tareas que requieran modelos web.
---

# Skill universal: CAPI

## Cuándo usarla

Usa CAPI cuando necesites una segunda opinión, investigación, revisión de código, análisis largo o acceso a los modelos web configurados. Es compatible con cualquier agente que pueda ejecutar comandos o conectarse a MCP por stdio.

## Flujo obligatorio para un agente nuevo

1. **Descubre el contrato**: `capi discover --output json`. Devuelve `protocol: "capi.agent.v1"`, todas las interfaces (`cli`, `mcp`, `typescript-core`), los formatos de salida, los proveedores con fallback multimodal y el `multimodal.imagesNeverBundledAsText: true`.
2. **Aprende un comando específico**: `capi schema <comando> --output json`. Ejemplos: `chat.send`, `context.pack`, `vision.analyze`, `vision.compare`. Cada schema incluye `behavior` (`nonInteractive`, `idempotent`, `sideEffects`) y `errors` con `code`, `retryable` y `recovery`.
3. **Diagnóstica el entorno**: `capi doctor --output json`. Devuelve el estado de proyecto, persistencia y los 3 proveedores. Si falla un proveedor, `data.sugerencias` ahora expone comandos accionables (recrear sesión, diagnosticar página, etc.).
4. **Comprueba sin efectos**: `capi chat --dry-run --output json "<prompt>"` lista las `actions` que ejecutaría sin navegar al proveedor.
5. **Envía real**: `capi chat -p qwen -m preview --output jsonl --request-id tarea-1 "<prompt>"`.
6. **Stream JSONL**: lee una línea JSON por evento hasta `event="completed"`.
7. **Errores**: si `ok=false`, examina `error.code`, `error.retryable` y `suggestions[]`.

## Nombres canónicos para descubrimiento

Los nombres que `schema` y `discover` aceptan están en inglés (`chat.send`, `context.pack`). El CLI también acepta alias en español (`chat enviar`, `contexto empaquetar`). Si dudas, usa el nombre canónico del schema. Los siguientes son los más usados:

| Schema | CLI español | Uso |
|---|---|---|
| `chat.send` | `chat enviar` | chat con contexto |
| `chat.continue` | `--continuar` | polling sin reenviar |
| `context.pack` | `contexto empaquetar` | bundle de archivos |
| `context.explain` | `contexto explicar` | auditar contexto |
| `history.list` | `historial listar` | ejecuciones recientes |
| `diagnostics.contracts` | `diagnostico contratos` | modelos reales |
| `state.metrics` | `estado metricas` | métricas por proyecto |
| `state.clean` | `estado limpiar` | limpiar capas locales |
| `state.export` | `estado exportar` | snapshot portable |
| `state.import` | `estado importar` | restaurar snapshot |
| `vision.analyze` | `vision analizar` | analizar imagen |
| `vision.compare` | `vision comparar` | comparar dos imágenes |
| `project.current` | `proyecto actual` | proyecto detectado |
| `conversations.project` | `conversaciones proyecto` | conversaciones del proyecto |
| `doctor` | `doctor` | diagnóstico global |
| `discover` | `discover` | meta-catálogo de comandos |
| `schema` | `schema` | schema de un comando |
| `tasks` | `tareas` | ejecuciones durables en background |

## Trampas de UX que detectará el CLI

- Flags con guiones: la CLI usa kebab-case (`--dry-run`, `--max-context-bytes`) aunque el schema muestre camelCase (`dryRun`, `maxContextBytes`). El CLI convierte al pasar al schema.
- Typos de subcomandos: `capi modelo listar` sugiere `modelos`. `capi vision listar` sugiere `capi vision --help`.
- Typos de flags: `capi chat enviar --foo` sugiere `-f` (Distancia Levenshtein ≤ 4).
- El comando `chat` admite forma corta: `capi chat -p qwen "hola"` equivale a `capi chat enviar -p qwen "hola"`.
- Salida `human` y `json`/`jsonl` son mutuamente excluyentes en contracto: usa `json` o `jsonl` siempre que tu agente consuma stdout.
- Errores CLI imprimen texto en stderr; los eventos van en stdout. No mezcles.

## Selección de proveedor

- Usa Qwen `preview` para razonamiento/investigación avanzada.
- Para texto CAPI puede degradar Qwen `preview → max → plus`. Para imágenes solo usa modelos con modalidad `image`: `preview → plus`; nunca `max`.
- Usa DeepSeek `expert` para análisis profundo y `default` para velocidad/estabilidad.
- DeepSeek `expert/vision → default` siempre abre un chat nuevo; nunca intentes cambiar el modelo dentro del chat anterior.
- Si un proveedor completo falla, usa la sugerencia de proveedor alternativo incluida en la salida.

## Contrato JSONL

Cada línea contiene `protocol`, `requestId`, `command`, `event` y `data`. Eventos principales:

- `progress`
- `reasoning.delta`
- `response.delta`
- `model.selected`
- `conversation.selected`
- `completed`

No mezcles stdout estructurado con análisis de stderr. No dependas de colores, emojis o texto de consola humano.

## Códigos de error frecuentes

| Código | Retryable | Acción del agente |
|---|---|---|
| `PROVEEDOR_NO_ENCONTRADO` | false | usa `suggestions[].command` |
| `ALTA_DEMANDA` | true | confía en el reintento automático |
| `TIMEOUT_PROVEEDOR` | true | reintenta con otro proveedor |
| `SESION_NAVEGADOR` | true | ejecuta `capi doctor` y sigue `data.sugerencias` |
| `MODELO_NO_DISPONIBLE` | true | usa un modelo con modalidad correcta |
| `CONTEXTO_INVALIDO` | false | corrige rutas/globs |
| `ENVIO_INCIERTO` | false | usa `--continuar` para observar sin reenviar |
| `CONVERSACION_INVALIDA` | true | se reintentará en chat nuevo automáticamente |

## Ejemplo

```bash
capi chat -p qwen -m preview --output jsonl --request-id revision-42 \
  "Revisa el diff actual y devuelve riesgos, correcciones y pruebas faltantes."
```


## Contexto inteligente

- `--contexto-auto`: incluye cambios Git, dependencias relativas, pruebas y archivos base.
- `--incremental`: omite contenido sin cambios ya enviado a la conversación.
- `--resumen`: añade el resumen persistente de interacciones anteriores.
- `capi contexto explicar`: audita presupuesto, inclusión, omisión, redacción y truncamiento.
- `capi historial listar`: recupera modelo, conversación, rama, commit, contexto y estado de cada ejecución.

## Operación local avanzada

- Usa `capi estado metricas --output json` para elegir proveedor/modelo según éxito y duración.
- Usa `capi estado exportar --archivo ...` antes de migrar una máquina o limpiar estado.
- Nunca ejecustes `estado limpiar` o `estado importar` sin confirmación explícita.
- Usa `--timeout` en tareas desatendidas.
- `CAPI_LOCAL_ENCRYPTION_KEY` protege resúmenes locales; nunca incluyas esa clave en prompts o logs.

## Visión e imágenes — protocolo obligatorio

Cuando recibas una imagen y no puedas verla o analizarla directamente:

1. No inventes su contenido ni extraigas conclusiones del nombre del archivo.
2. Ejecuta `capi discover --output json` y verifica una modalidad `image` compatible.
3. Prefiere `capi vision analizar <ruta> --tipo descripcion --output json`.
4. Para OCR usa `--tipo ocr`; para interfaces `--tipo ui`; para diagramas `--tipo diagrama`; para tablas `--tipo tabla`.
5. Para comparar usa `capi vision comparar <antes> <despues> --output json`.
6. Procesa `response` o `parsed` y conserva siempre `incertidumbres`.
7. No conviertas imágenes a Base64 dentro del prompt, stdout o logs.
8. No uses un fallback que carezca de modalidad `image`. Qwen `preview` corresponde a `Qwen3.8-Max-Preview`; Qwen `plus` es multimodal; Qwen `max` es solo texto. DeepSeek requiere el alias `vision`.

También puedes usar chat directamente:

```bash
capi chat -p qwen --imagen captura.png --imagen segunda.webp --output jsonl \
  'Compara las imágenes y devuelve JSON con diferencias e incertidumbres.'
```

`-f captura.png` también se clasifica automáticamente como imagen y nunca se incluye en el bundle `.txt`. Alias: `preview` = `Qwen3.8-Max-Preview`; `plus` = `Qwen3.7-Plus` multimodal; `max` = `Qwen3.7-Max` solo texto. Usa `--no-fallback` cuando debas validar un modelo exacto.
