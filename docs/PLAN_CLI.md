# Plan De Evolución De La CLI

## Objetivo

Hacer que CAPI sea más predecible para agentes y usuarios, priorizando la reutilización de conversaciones, recuperación de errores y proveedores Web verificables.

## Fases

### 1. Errores Estructurados

- Evitar stack traces para errores de entrada.
- Emitir siempre `code`, `message`, `retryable` y `suggestions` en `json` y `jsonl`.
- Mantener diagnósticos humanos únicamente en `stderr`.

### 2. Conversaciones Pendientes

Agregar:

```bash
capi conversaciones pendientes
capi chat --continuar
```

Debe mostrar proveedor, conversación, estado, antigüedad y el comando para continuar.

### 3. Persistencia Y Concurrencia

- Cerrar SQLite en `finally` en todos los comandos.
- Mantener `WAL` y `busy_timeout`.
- No crear otra conversación cuando existe un bloqueo.
- Registrar estados `en_progreso`, `pausada`, `completada` y `fallida`.

### 4. Reutilización Automática

- Priorizar la conversación del proyecto actual.
- Usar la conversación activa del navegador cuando el usuario no especifica ID.
- Mantener el `conversacionId` durante fallback de modelo.
- Reservar `--nueva` para una decisión explícita.

### 5. Qwen

- Esperar carga del sidebar antes de hacer scraping.
- Reintentar cuando el listado esté vacío.
- Distinguir claramente ID de URL, ID DOM y título.
- Reportar diagnóstico cuando la página no permita listar conversaciones.

### 6. ChatGPT Web

Integrar ChatGPT como proveedor WebBridge, reutilizando la sesión real del navegador.

Capacidades previstas:

- Conversaciones existentes.
- Envío de texto.
- Streaming o polling de respuesta.
- Adjuntos, si los selectores reales lo permiten.
- Proyectos y chats anclados como metadatos de conversación.

## Datos Verificados Del HTML Curado De ChatGPT

El HTML proporcionado confirma estas secciones:

- `#proyectos`: Aliware, ElCaliz, Lilian, Pancho y Tesis.
- `#anclados`: TesisApolo, Karmita, Validacion de Conocimientos y Análisis de tesis académica.
- `#historial`: chats agrupados por `Hoy` y `Ayer`.
- `#chat-content`: turnos de usuario y asistente.

## Integración ChatGPT Verificada

La pestaña activa permitió verificar:

- Host `chatgpt.com`.
- Conversación activa en `/g/.../c/6a5f7206-1f50-83e9-927f-1bec5776ba19`.
- Editor `div.ProseMirror[contenteditable="true"]`.
- Botón `[data-testid="send-button"]` con `aria-label="Enviar mensaje"`.
- Mensajes asistentes `[data-message-author-role="assistant"]`.
- Historial mediante enlaces `a[href*="/c/"]`.
- Indicador de generación mediante botón de detención, cuando está presente.
- El GPT activo expone únicamente el modelo `Auto`; no se inventan alias de modelos que la UI no muestra.

Se implementó el adaptador en `src/proveedores/chatgpt/` y se registró en composición, `doctor`, MCP, `discover` y presupuestos de contexto.

Las pruebas reales confirmaron reutilización del chat activo, respuesta de texto, polling posterior con `--continuar`, generación de imágenes y el evento `image.generated`. El límite de espera del proveedor es de dos horas; después emite `pausado` para retomar sin reenviar el prompt.

Para ejecuciones largas se agregó:

```bash
capi chat -p chatgpt --background "prompt largo"
capi tareas listar
capi tareas estado TASK_ID
```

La tarea se ejecuta desacoplada de la terminal y conserva estado `pendiente`, `ejecutando`, `pausada`, `completada` o `fallida`.

## Datos Pendientes Para Endurecer ChatGPT

El HTML curado no contiene:

- El comando `upload` devuelve `Not allowed` en ChatGPT; el adaptador usa `DOM.setFileInputFiles` y fallback `DataTransfer`.
- La carga de `docs/PLAN_CLI.md` fue validada y ChatGPT mostró el archivo en el turno enviado.
- Añadir fixtures DOM más amplios para proyectos, modelos y generación de imágenes.
- Añadir un smoke test WebBridge que no exponga URLs firmadas en logs.

No se deben inventar esos selectores: deben verificarse con snapshot/evaluate sobre la pestaña real mediante WebBridge.

## Criterios De Aceptación De ChatGPT

```bash
capi doctor --output json
capi conversaciones listar -p chatgpt --output json
capi chat -p chatgpt "mensaje de prueba"
```

El proveedor se considerará listo cuando:

- Reutilice el chat activo sin crear otro automáticamente.
- Liste títulos e IDs verificables.
- Envíe el mensaje completo, nunca el texto del botón.
- Espere respuestas largas mediante polling.
- Mantenga el mensaje recuperable después de timeout.
- Tenga tests unitarios de scripts DOM y streaming.

## Orden Recomendado

1. Confirmar URL y DOM real de ChatGPT mediante WebBridge.
2. Implementar navegación y conversación actual.
3. Implementar envío y polling.
4. Implementar listado de proyectos/chats.
5. Integrar el proveedor en composición, `discover`, `schema` y CLI.
6. Ejecutar tests y smoke test real.
