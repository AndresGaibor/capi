# Estado de pruebas durables — 25 de julio de 2026

## Objetivo

Validar que CAPI pueda enviar mensajes mediante Qwen y ChatGPT, conservar el identificador de conversación, reanudar ejecuciones tras fallos y evitar duplicar prompts.

## Regla operativa desde ahora

Las pruebas reales contra ChatGPT deben reducirse al mínimo porque consumen mensajes de la suscripción. Antes de volver a enviar mensajes reales se debe:

1. Reproducir el defecto con pruebas unitarias o dobles de WebBridge.
2. Ejecutar `tsc --noEmit` y las pruebas específicas.
3. Hacer como máximo un smoke real por escenario pendiente.
4. Reutilizar una conversación existente cuando sea posible.
5. No usar prompts largos ni repetir verificaciones ya demostradas.

## Avances confirmados en Qwen

Qwen ya fue validado en la página real `chat.qwen.ai`, no sobre ChatGPT.

Escenarios reales completados:

- Ejecución en background.
- Terminación forzada del proceso y reanudación.
- Cierre de pestaña y recuperación por UUID.
- Cancelación de una tarea activa.
- Un solo prompt enviado en cada escenario.

### Resultado del smoke de cierre de pestaña

La ejecución terminó como `completada`, recuperó la conversación por UUID y registró un único prompt:

- `conversationId`: `a59784a3-9ca3-4fe4-9e9f-d32b0280da75`
- `duplicados`: `1`
- `intentos`: `1`
- `estrategia`: `semantic`

### Resultado del smoke de cancelación

La ejecución terminó como `cancelada` y mantuvo un único prompt:

- `conversationId`: `d43fd378-cb5a-4f62-9752-40d9d841e806`
- `duplicados`: `1`
- `intentos`: `1`

### Cambios realizados para Qwen

- Propagación del UUID desde `ProveedorQwen` hasta `QwenStreaming`.
- Recuperación de pestaña usando `https://chat.qwen.ai/c/<uuid>`.
- Pruebas de regresión para verificar que el UUID no se pierde.
- Validación real de recuperación después de cerrar la pestaña.

## Avances confirmados en ChatGPT

Se reprodujo el flujo real en `chatgpt.com` y se inspeccionó el DOM temporalmente durante la generación.

Hallazgos confirmados:

- ChatGPT cambia primero a una URL temporal `WEB:...` y después a la URL canónica `/c/<uuid>`.
- El botón Stop permaneció visible mientras generaba y desapareció al finalizar.
- El turno inspeccionado terminó realmente con la respuesta `C`; CAPI no lo cortó prematuramente.
- El problema durable era que `ProveedorChatGPT` no emitía el identificador de conversación.

### Cambios realizados para ChatGPT

- `ProveedorChatGPT` obtiene y emite la conversación canónica después del envío.
- La conversación conocida se entrega al observador de streaming.
- `ChatGPTPaginaChat.observar()` usa esa URL al recuperar una pestaña cerrada.
- Se añadió `test/proveedores/chatgpt-durable.test.ts`.
- Las dos pruebas durables nuevas pasan.
- `tsc --noEmit` pasa después de estos cambios.

### Estado del smoke background

La ejecución de ChatGPT ya llegó a `completada` y conservó la conversación. El runner falló únicamente al auditar duplicados porque trataba la URL canónica como si fuera un UUID simple.

Se añadió una normalización específica al runner para aceptar:

- UUID simple.
- Ruta `/c/<uuid>`.
- URL completa `https://chatgpt.com/c/<uuid>`.

La prueba unitaria de esta normalización pasa y `tsc --noEmit` continúa pasando.

## Trabajo pendiente

### 1. Cerrar ChatGPT con el mínimo de mensajes reales

- Ejecutar una sola vez el smoke `chatgpt background` después de la corrección del runner.
- Si pasa, ejecutar una vez cada escenario restante: recuperación por kill, cierre de pestaña y cancelación.
- Detener las pruebas reales ante el primer fallo y volver a pruebas locales.

### 2. Verificación completa local

- Ejecutar las pruebas específicas de Qwen, ChatGPT y del runner durable.
- Ejecutar la suite completa del repositorio.
- Ejecutar `tsc --noEmit`.
- Revisar que no aparezcan regresiones en DeepSeek.

### 3. Revisar el árbol de trabajo antes de confirmar cambios

Actualmente existen modificaciones locales en archivos de ChatGPT, Qwen, smokes y pruebas. Algunas modificaciones de ChatGPT ya existían antes de esta sesión y deben preservarse.

Antes de crear un commit se debe:

- Revisar `git diff` archivo por archivo.
- Separar cambios propios de cambios preexistentes del usuario.
- No descartar ni sobrescribir trabajo local.
- Confirmar únicamente los cambios atribuibles a esta corrección.

### 4. Cierre técnico

- Actualizar este documento con los resultados finales.
- Crear un commit pequeño y descriptivo.
- Subirlo solo después de que la suite completa pase.
