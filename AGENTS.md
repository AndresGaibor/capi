# CAPI — instrucciones para agentes

CAPI permite consultar Qwen y DeepSeek desde agentes de código sin controlar manualmente el navegador.

## Mapa del Proyecto para Agentes

Para navegar rápidamente por el código fuente, consulta la documentación distribuida en cada módulo/capa:

| Capa / Módulo | Descripción / Responsabilidad | Documentación |
| :--- | :--- | :--- |
| **`src/nucleo/`** | Tipos base, interfaces de proveedores, gestión de errores, abstracción de proyectos y contratos fundamentales. | [`src/nucleo/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/AGENTS.md) |
| **`src/modulos/`** | Casos de uso neutrales organizados por dominio (chat, conversaciones, visión, proyectos, diagnóstico, etc.). | [`src/modulos/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/AGENTS.md) |
| **`src/proveedores/`** | Implementaciones de proveedores LLM Web (Qwen y DeepSeek) usando WebBridge, DOM scripts, CDP e IndexedDB. | [`src/proveedores/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/proveedores/AGENTS.md) |
| **`src/plataforma/`** | Adaptadores de infraestructura (WebBridge client, IndexedDB fallback, consola, HTTP client, persistencia SQLite/JSON). | [`src/plataforma/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/plataforma/AGENTS.md) |
| **`src/entradas/`** | Puntos de entrada y adaptadores primarios: CLI (Commander.js) y servidor MCP (Model Context Protocol). | [`src/entradas/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/src/entradas/AGENTS.md) |
| **`test/`** | Suite de pruebas unitarias e integración organizada en espejo con `src/`. | [`test/AGENTS.md`](file:///Users/andresgaibor/code/javascript/capi/test/AGENTS.md) |

---

## Inicio rápido

1. Ejecuta `bun run src/cli.ts discover --output json` para descubrir capacidades.
2. Consulta `bun run src/cli.ts schema chat.send --output json` antes de construir una llamada nueva.
3. Usa `--output jsonl` para chat con streaming y `--output json` para operaciones no streaming.
4. Usa `--dry-run` antes de una operación cuando necesites comprobar proveedor, modelo y conversación sin efectos.
5. No analices texto ANSI cuando exista salida JSON/JSONL.

## Uso recomendado

```bash
bun run src/cli.ts chat --output jsonl "Analiza este cambio"
bun run src/cli.ts chat -p qwen -m preview --output jsonl "Investiga este problema"
bun run src/cli.ts proyecto actual --output json
bun run src/cli.ts conversaciones proyecto --output json
bun run src/cli.ts doctor --output json
```

CAPI detecta la raíz Git, reutiliza contexto libre, limita concurrencia, registra conversaciones y recupera fallos transitorios. En DeepSeek, degradar de `expert` o `vision` a `default` siempre crea un chat nuevo.

## Reglas operativas

- No abras ni manipules directamente Qwen/DeepSeek si CAPI puede realizar la acción.
- No inventes flags: usa `discover` y `schema`.
- Conserva `requestId` para correlacionar eventos y errores.
- Ante un error con `retryable: true`, sigue `suggestions` o deja actuar al fallback automático.
- Usa `--fallback=false` solo cuando el modelo exacto sea un requisito estricto.
- No incluyas secretos, cookies o tokens en prompts ni logs.

## Validación del repositorio

```bash
bun test
bun run verify
bun run smoke:qwen
bun run smoke:deepseek
```

La skill portable está en `.agents/skills/capi/SKILL.md`. La integración MCP se inicia con `bun run mcp`.

## Delegación visual obligatoria

Un agente sin visión debe delegar cualquier PNG, JPEG, WebP o GIF a CAPI y nunca inferir su contenido por el nombre del archivo.

```bash
bun run src/cli.ts vision analizar captura.png --tipo ui --output json
bun run src/cli.ts vision comparar antes.png despues.png --output json
bun run src/cli.ts chat --imagen captura.png -p qwen --output jsonl \
  'Devuelve descripción, texto visible, problemas e incertidumbres en JSON.'
```

Reglas:
- Las imágenes se adjuntan nativamente con MIME real y no se empaquetan como texto.
- Usa Qwen como proveedor visual predeterminado. DeepSeek solo con modelo `vision`.
- Conserva el campo `incertidumbres`; no transformes una observación incierta en un hecho.
- Nunca insertes Base64, cookies, tokens o rutas sensibles en el prompt.
- Consulta `schema vision.analyze`, `schema vision.compare` o las herramientas MCP equivalentes antes de inventar argumentos.

---

## Integración con Kimi WebBridge (`~/.kimi-webbridge/bin/kimi-webbridge`)

Kimi WebBridge permite a cualquier agente controlar la sesión de navegador real del usuario (con sus cookies y logins activos) sin necesidad de credenciales ni automatizaciones Puppeteer/Playwright aisladas.

### 1. Comandos de Gestión CLI (`kimi-webbridge` o `~/.kimi-webbridge/bin/kimi-webbridge`)

| Comando | Descripción | Flags Frecuentes |
| :--- | :--- | :--- |
| `kimi-webbridge start` | Inicia el demonio local WebBridge en segundo plano. | Ninguno (no falla si ya está iniciado). |
| `kimi-webbridge status` | Devuelve el estado en JSON (`running`, `extension_connected`, `port`, `version`, `skills`). | Ninguno. |
| `kimi-webbridge stop` | Detiene el demonio WebBridge. | Ninguno. |
| `kimi-webbridge restart` | Reinicia el demonio WebBridge. | Ninguno. |
| `kimi-webbridge logs` | Muestra los registros del demonio. | `-f` (follow), `-n <lineas>`, `--prev` (log previo). |
| `kimi-webbridge install-skill` | Instala/actualiza la skill en agentes detectados (Claude Code, Codex, OpenClaw, etc.). | `-y` (sin confirmación), `--version <v>`. |
| `kimi-webbridge upgrade` | Sincroniza la versión del binario y skills con la extensión del navegador. | `[version]`. |
| `kimi-webbridge uninstall` | Detiene el demonio y elimina la carpeta `~/.kimi-webbridge/`. | Ninguno. |

### 2. Protocolo HTTP del Demonio (`http://127.0.0.1:10086/command`)

El demonio expone un endpoint HTTP local en el puerto **10086**. Todos los comandos se envían con `POST` al endpoint `/command`:

```bash
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "<ACCION>",
    "args": { ... },
    "session": "nombre-de-sesion"
  }'
```

#### Catálogo Completo de Acciones HTTP Explicadas

| Acción (`action`) | Argumentos (`args`) | Respuesta / Explicación Detallada |
| :--- | :--- | :--- |
| `navigate` | `url`, `newTab` (bool), `group_title` | `{success, url, tabId}`. Abre o navega a una URL. Al pasar `newTab: true`, abre una nueva pestaña dentro del grupo. `group_title` asigna la etiqueta visible del grupo de pestañas en la 1ª llamada. |
| `find_tab` | `url`, `active` (bool) | `{success, url, tabId, borrowed}`. Re-selecciona una pestaña de la sesión activa (`url` exacta). Con `active: true` toma prestada la pestaña que el usuario está viendo actualmente (`borrowed: true`). |
| `list_tabs` | *(ninguno)* | `{success, tabs: [{tabId, url, title, active, groupTitle}]}`. Lista todas las pestañas abiertas dentro de la sesión actual. |
| `close_tab` | *(ninguno)* | `{success, closed: bool}`. Cierra la pestaña seleccionada/actual de la sesión. |
| `close_session` | *(ninguno)* | `{success, closed: int}`. Cierra todas las pestañas de la sesión y elimina el grupo del navegador. |
| `snapshot` | *(ninguno)* | `{url, title, tree}`. Extrae el árbol de accesibilidad (texto) con referencias `@e123`. **Es el método primario para leer la página y ubicar elementos interactivos**. |
| `click` | `selector` (ref `@e` o CSS) | `{success, tag, text}`. Dispara `click()` sobre el elemento objetivo especificado por referencia `@e` (obtenida de `snapshot`) o selector CSS. |
| `fill` | `selector` (ref `@e` o CSS), `value` | `{success, tag, mode}`. Reemplaza el texto en `<input>`, `<textarea>` (`mode: "value"`) y editores rich-text `[contenteditable]` (`mode: "contenteditable"` como ProseMirror, Lexical, Slate). |
| `upload` | `selector`, `files` (string[]) | `{success, fileCount}`. Adjunta archivos locales al elemento `<input type="file">`. |
| `evaluate` | `code` (JS string) | `{type, value}`. Evalúa código JS arbitrario en la página. **Obligatorio encapsular en IIFE `(() => { ... })()`** para evitar colisiones de declaración de variables entre llamadas. |
| `screenshot` | `format` (`png`\|`jpeg`), `quality` (0-100), `selector`, `path` | `{format, path, sizeBytes, mimeType}`. Guarda la captura en disco (en `path` o temp) y retorna la ruta del archivo (no base64). |
| `save_as_pdf` | `paper_format` (`letter`\|`a4`...), `landscape`, `scale`, `print_background`, `path` | `{path, sizeBytes, mimeType, pageTitle}`. Exporta la página actual a un archivo PDF en disco. |
| `network` | `cmd` (`start`\|`stop`\|`list`\|`detail`), `filter`, `requestId` | Inspecciona peticiones/respuestas HTTP/HTTPS capturadas de la pestaña actual. |
| `cdp` | `method`, `params` | Pasarela directa CDP (`chrome.debugger`) para operaciones de bajo nivel (ej. `Input.dispatchKeyEvent`). |

### 3. Ejemplos Prácticos de Protocolo (Probados)

#### Navegación y Lectura Semántica (`snapshot`)
```bash
# 1. Navegar y crear grupo de sesión
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"navigate","args":{"url":"https://example.com","newTab":true,"group_title":"Investigación"},"session":"tarea-1"}'

# 2. Obtener estructura semántica con referencias @e
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"snapshot","args":{},"session":"tarea-1"}'
```

#### Interacción (`click` y `fill`)
```bash
# Hacer clic en un enlace/botón por referencia @e obtenida en snapshot
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"click","args":{"selector":"@e1"},"session":"tarea-1"}'

# Llenar un campo de texto o editor rich-text
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"fill","args":{"selector":"#search-input","value":"Consulta de prueba"},"session":"tarea-1"}'
```

#### Evaluación de Código JavaScript (`evaluate`)
```bash
# Extraer datos usando IIFE para evitar redeclaraciones en el scope global
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"evaluate","args":{"code":"(() => { return { titulo: document.title, url: location.href }; })()"},"session":"tarea-1"}'
```

#### Captura de Pantalla (`screenshot`)
```bash
# Tomar captura completa o de un elemento específico (@e o selector CSS)
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"screenshot","args":{"format":"png"},"session":"tarea-1"}'

# Respuesta del demonio:
# {"ok":true,"data":{"format":"png","path":"/tmp/kimi-webbridge-screenshots/screenshot_....png","sizeBytes":41410,"mimeType":"image/png"}}
```

#### Pasarela Directa CDP (`cdp`)
```bash
# Ejecutar comandos Chrome DevTools Protocol directamente sobre la página activa
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"cdp","args":{"method":"Page.getLayoutMetrics","params":{}},"session":"tarea-1"}'

# Evaluar mediante el dominio CDP Runtime:
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"cdp","args":{"method":"Runtime.evaluate","params":{"expression":"document.title"}},"session":"tarea-1"}'
```

#### Exportación a PDF (`save_as_pdf`)
```bash
# Renderizar la página completa a un archivo PDF en disco
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"save_as_pdf","args":{"paper_format":"a4"},"session":"tarea-1"}'

# Respuesta:
# {"ok":true,"data":{"path":"/tmp/kimi-webbridge-pdfs/PageTitle.pdf","sizeBytes":35481,"mimeType":"application/pdf","pageTitle":"PageTitle"}}
```

#### Inspección de Red (`network`)
```bash
# Iniciar captura de tráfico HTTP/HTTPS en la pestaña
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"network","args":{"cmd":"start"},"session":"tarea-1"}'

# Listar peticiones capturadas y detener captura
curl -s -X POST http://127.0.0.1:10086/command -H 'Content-Type: application/json' -d '{"action":"network","args":{"cmd":"list"},"session":"tarea-1"}'
curl -s -X POST http://127.0.0.1:10086/command -H 'Content-Type: application/json' -d '{"action":"network","args":{"cmd":"stop"},"session":"tarea-1"}'
```

#### Limpieza de Sesión (`close_session`)
```bash
# Cierra todas las pestañas asociadas a la sesión al terminar la tarea
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"close_session","args":{},"session":"tarea-1"}'
```

### 4. Reglas de Uso e Integración para Agentes

1. **Gestión de Sesiones (`session`)**:
   - Asigna un nombre de sesión único por **tarea** (ej: `"investigacion-api"`), **no por sitio web**.
   - Pasa siempre `"session"` como campo de primer nivel en el JSON del request.
   - En la primera navegación, usa `group_title` en la lengua del usuario. Todas las pestañas se agruparán visiblemente en el navegador bajo esa etiqueta.
2. **Priorizar `snapshot` sobre CSS/JS**:
   - Usa `snapshot` para obtener referencias semánticas `@e...` (ej: `@e12`). Son inmunes a cambios de hashes de clases CSS.
3. **Manejo de Formularios y Teclas Especiales**:
   - Usa `fill` para ingresar texto (reemplazo completo). Si necesitas presionar `Enter` o `Escape`, usa `click` en el botón de submit o dispara un `KeyboardEvent` vía `evaluate`:
     ```json
     {"action":"evaluate","args":{"code":"document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"}}
     ```
4. **Auto-arranque del Demonio**:
   - Si una llamada HTTP a `10086` falla por *Connection Refused*, ejecuta en terminal `~/.kimi-webbridge/bin/kimi-webbridge start` sin interrumpir ni preguntar al usuario.


