---
name: capi
description: Usa CAPI para Qwen 3.8, Qwen 3.7, DeepSeek, contexto de proyecto, archivos e imágenes. Actívala al delegar análisis, código, OCR, UI, diagramas o tareas que requieran modelos web.
---

# Skill universal: CAPI

## Cuándo usarla

Usa CAPI cuando necesites una segunda opinión, investigación, revisión de código, análisis largo o acceso a los modelos web configurados. Es compatible con cualquier agente que pueda ejecutar comandos o conectarse a MCP por stdio.

## Flujo obligatorio

1. Si desconoces la versión o capacidades, ejecuta `capi discover --output json`.
2. Consulta `capi schema chat.send --output json` antes de usar argumentos poco habituales.
3. Para comprobar decisiones sin efectos, ejecuta `capi chat --dry-run --output json "<prompt>"`.
4. Para tareas de código usa `capi chat --contexto-auto --incremental --resumen --output jsonl "<prompt>"`.
5. Antes de un envío grande usa `capi contexto explicar --automatico --output json`.
6. Lee una línea JSON por evento hasta `event="completed"`.
7. Si recibes un sobre con `ok=false`, examina `error.retryable`, `error.code` y `suggestions`.

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
- Nunca ejecutes `estado limpiar` o `estado importar` sin confirmación explícita.
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
