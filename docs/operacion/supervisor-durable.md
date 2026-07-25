# Supervisor durable de CAPI

CAPI persiste ejecuciones de chat, eventos, heartbeats, idempotencia y cancelaciones en SQLite. Una ejecución puede retomarse sin reenviar el prompt.

## Comandos

```bash
capi tareas listar
capi tareas estado ID
capi tareas seguir ID --esperar
capi tareas cancelar ID
capi tareas reanudar ID
capi diagnostico ejecucion ID
capi diagnostico red iniciar
capi diagnostico red listar
capi diagnostico red detener
```

## Privacidad

Use `CAPI_NO_GUARDAR_RESPUESTAS=1` para persistir solo estados, hashes y métricas. La captura de red elimina autorización, cookies, tokens, API keys y cuerpos privados.

## Tampermonkey opcional

`~/code/javascript/tampermonkey-scripts/dist/capi-qwen-observador.user.js` publica únicamente estado, heartbeat y conteo de mutaciones en `window.__CAPI_QWEN_BRIDGE__`. No controla envíos y no es requisito para CAPI.

## Operación ampliada

```bash
capi tareas metricas
capi tareas compactar <id> --conservar 10
capi tareas limpiar --anteriores-a 30d --confirmar
capi tareas logs <id> --ultimas 100
capi diagnostico ejecucion <id>
capi diagnostico red listar
```

SQLite es la única fuente de verdad para tareas nuevas. Las ejecuciones huérfanas pasan a `reconectando`, la adopción es atómica y `estancada` nunca cancela automáticamente. Qwen usa el bridge Tampermonkey v2 como señal secundaria opcional; DeepSeek y ChatGPT comparten heartbeat, recuperación y estancamiento no terminal.
