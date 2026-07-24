---
name: capi
summary: Usa Qwen y DeepSeek con contexto de proyecto, recuperación automática y contratos estructurados.
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
- CAPI degrada Qwen `preview → max → plus` ante alta demanda.
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
