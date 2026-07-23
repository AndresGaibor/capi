# capi — CLI de Chat para DeepSeek

CLI en TypeScript + Bun para listar sesiones de DeepSeek Chat, con captura automática de cookies HttpOnly via Kimi WebBridge.

## Requisitos

- **Bun** (`brew install bun` o `curl -fsSL https://bun.sh/install | bash`)
- **Brave Browser** con la extensión **[Kimi WebBridge](https://github.com/AaliyaYyu/kimi-webbridge)** instalada y activa

## Instalación

```bash
cd ~/code/javascript/capi
bun install
```

Para ejecutar desde cualquier lugar:

```bash
echo 'export PATH="$HOME/code/javascript/capi:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Uso Rápido

```bash
# 1. Iniciar el bridge (en una terminal separada)
bun run src/cli.ts serve

# 2. Capturar sesión automáticamente (Kimi WebBridge abre DeepSeek por vos)
bun run src/cli.ts capture

# 3. Listar sesiones
bun run src/cli.ts chat list
```

---

## Comandos

### `capi serve`

Inicia el bridge HTTP local en `http://localhost:3847`. Recibe sesiones del capture script y las persiste en disco.

```bash
bun run src/cli.ts serve
```

- Mata automáticamente cualquier proceso en el puerto 3847 antes de iniciar
- `POST /api/deepseek/session` — recibe el bundle de sesión
- `GET /health` — verificación

### `capi capture`

Captura la sesión de DeepSeek usando Kimi WebBridge. Hace todo automáticamente:

1. Verifica conexión con la extensión Kimi WebBridge en Brave
2. Abre `chat.deepseek.com` en pestaña nueva via CDP
3. Espera cookies de DeepSeek
4. Extrae `.thumbcache_*`, `aws-waf-token`, `ds_session_id` (HttpOnly) via CDP
5. Obtiene `userToken` de `localStorage`
6. Envía todo al bridge

```bash
bun run src/cli.ts capture
```

### `capi chat list`

Lista todas las sesiones de DeepSeek Chat.

```bash
bun run src/cli.ts chat list
bun run src/cli.ts chat list -n 5 -q "código"
```

- `-n, --limit <num>`: limita el número de conversaciones a listar.
- `-q, --query <texto>`: filtra conversaciones por título.
- Si no hay sesión, inicia bridge en background y espera.

### `capi chat messages <id>`

Muestra los mensajes de una conversación por ID.

```bash
bun run src/cli.ts chat messages <id>
```

- Abre la conversación en DeepSeek y primero intenta leer el historial desde `IndexedDB`
- Usa la base `deepseek-chat` y el store `history-message` cuando está disponible
- Si no encuentra el historial, cae al flujo visual de la UI como respaldo

### `capi chat send <id> <prompt>`

Envía un mensaje a una conversación y muestra la respuesta.

```bash
bun run src/cli.ts chat send <id> "<prompt>" --model expert --file "./doc.pdf"
```

- Parámetros opcionales: `--model <default|expert|vision>`, `--deepthink`, `--search`, `-f, --file <ruta>`
- Abre la conversación en DeepSeek via Kimi WebBridge
- Usa el textarea de la página (con setter nativo de React) para inyectar el prompt
- Hace click en el botón de enviar
- Pollea el DOM esperando la respuesta (DeepThink + respuesta)
- Imprime ambos en streaming a medida que aparecen

### `capi chat model <id>`

Consulta el modelo/modo activo de una conversación inspeccionando el header de DeepSeek.

```bash
bun run src/cli.ts chat model <id>
```

- Muestra el modelo activo en la conversación (ej: `Expert`, `Instant`, `DeepThink`).
- Nota: Las conversaciones ya iniciadas no permiten cambiar de modelo.

### `capi auth status`

Verifica el estado de las credenciales de sesión guardadas.

```bash
bun run src/cli.ts auth status
```

### `capi auth deepseek setDsSession`

Fallback manual para `ds_session_id` (cookie HttpOnly).

```bash
bun run src/cli.ts auth deepseek setDsSession
```

---

## Cómo Funciona la Captura de Sesión

### El Problema

DeepSeek requiere tres cookies/credenciales para su API:

| Dato | Tipo | ¿Se puede leer con JS? |
|------|------|------------------------|
| `Authorization` (Bearer token) | Header HTTP | Sí — interceptando requests |
| `.thumbcache_*` | Cookie normal | Sí — `document.cookie` |
| `aws-waf-token` | Cookie normal | Sí — `document.cookie` |
| `ds_session_id` | Cookie **HttpOnly** | **No** — el navegador no expone HttpOnly a JS |

La cookie `ds_session_id` es HttpOnly y no puede ser leída por JavaScript de la página. Se necesita acceso al motor del navegador via CDP (Chrome DevTools Protocol).

---

## Método: Kimi WebBridge (Principal)

Kimi WebBridge es una extensión de Brave + daemon local que expone CDP (Chrome DevTools Protocol). Permite controlar el navegador programmatically — incluyendo leer cookies HttpOnly.

**Arquitectura:**

```
┌──────────────────────────────────────────────────────────────┐
│  Brave Browser (con extensión Kimi WebBridge)                │
│                                                              │
│  ┌─────────────┐    CDP    ┌──────────────────────────────┐ │
│  │ DeepSeek    │◄────────►│ Kimi WebBridge daemon       │ │
│  │ Chat page   │           │ http://127.0.0.1:10086       │ │
│  │             │           │                              │ │
│  │ • cookies   │           │ • navigate() → abre tab      │ │
│  │   (todas,   │           │ • cdp("Network.getAllCookies")│
│  │   incl HttpOnly)│        │ • evaluate() → localStorage │ │
│  │ • localStorage│         └──────────┬───────────────────┘ │
│  └─────────────┘                      │                     │
│                                        │                     │
│                                POST /api/deepseek/session   │
│                                        │                     │
└────────────────────────────────────────┼─────────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │  capi bridge         │
                              │  localhost:3847      │
                              │                      │
                              │  saveSession() ──────┼──→ ~/.cache/capi/
                              └─────────────────────┘
```

**Flujo paso a paso (`capi capture`):**

```
1. list_tabs()
   → Verifica que Kimi WebBridge responda

2. navigate("https://chat.deepseek.com", newTab=true)
   → Abre pestaña en Brave con la página de DeepSeek

3. Espera 2s a que carguen las cookies

4. cdp("Network.getAllCookies", {})
   → CDP: Network.getAllCookies devuelve TODAS las cookies del navegador
   → Incluye ds_session_id (HttpOnly) que JS no puede leer
   → Filtra por dominio: "deepseek" o "chatdeepseek"

5. evaluate(`
     localStorage.getItem('userToken')
   `)
   → Lee el token de localStorage directamente

6. POST /api/deepseek/session { authorization, cookies: { thumbcache, awsWafToken, dsSessionId } }
   → Envía bundle al bridge

7. saveSession() → ~/.cache/capi/deepseek-session.json
```

**Kimi WebBridge** (`~/.kimi-webbridge/`):
- Daemon que corre en background
- Escucha en `http://127.0.0.1:10086`
- La extensión de Brave se conecta al daemon y expone la API REST
- Comandos: `navigate`, `cdp`, `evaluate`, `close_session`, `list_tabs`

---

## Método: Tampermonkey (Desactivado — Fallback)

El script `deepseek-session-relay` en Tampermonkey intercepta tráfico de `chat.deepseek.com` para capturar credenciales. **Está desactivado** — usar `capi capture` con Kimi WebBridge.

**Cómo funcionaba:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Brave + Tampermonkey (script activo en chat.deepseek.com)    │
│                                                                  │
│  interceptarFetch():                                             │
│    fetch() → intercepta headers.Authorization ──────────────────┼──→ authorization
│                                                                  │
│  interceptarXMLHttpRequest():                                     │
│    XHR.setRequestHeader("Authorization", ...) ──────────────────┼──→ authorization
│                                                                  │
│  leerCookies():                                                  │
│    document.cookie → ".thumbcache_*" ──────────────────────────┼──→ thumbcache
│    document.cookie → "aws-waf-token=..." ──────────────────────┼──→ awsWafToken
│                                                                  │
│  GM_xmlhttpRequest() ──POST /api/deepseek/session──────────────→│
└──────────────────────────────────────────────────────────────────┘
```

**Limitaciones del método Tampermonkey:**

- ❌ **No puede leer `ds_session_id`** — es HttpOnly, JavaScript no tiene acceso
- ❌ **No navega automáticamente** — el usuario debe abrir DeepSeek manualmente
- ✅ Funciona bien para `Authorization`, `.thumbcache_*`, `aws-waf-token`

**ds_session_id con Tampermonkey:** Se configuraba manualmente via `capi auth deepseek setDsSession`, ya que el script no podía capturarlo.

---

## Comparación de Métodos

| Característica | Kimi WebBridge | Tampermonkey (desactivado) |
|---|---|---|
| `ds_session_id` HttpOnly | ✅ CDP lo lee | ❌ No accesible |
| `aws-waf-token` | ✅ | ✅ |
| `.thumbcache_*` | ✅ | ✅ |
| `Authorization` | ✅ (localStorage) | ✅ (intercepta headers) |
| Navegación automática | ✅ `navigate()` | ❌ usuario abre DeepSeek |
| Dependencias | Extensión Kimi + daemon | Tampermonkey |
| Funciona sin extensión Kimi | No | Sí |

**Flujo recomendado:** `capi capture` (Kimi WebBridge) → `capi chat list`

---

## Sesión Guardada

```
~/.cache/capi/deepseek-session.json
```

```json
{
  "authorization": "Bearer eyJ...",
  "thumbcache": ".thumbcache_6b2e5483f9d858d7c661c5e276b6a6ae=...",
  "awsWafToken": "aws-waf-token=2~...",
  "dsSessionId": "ds_session_id=eef8222e03574a...",
  "capturedAt": "2026-07-23T..."
}
```

---

## Arquitectura General

```
                      ┌─────────────────────────────────────────┐
                      │           Brave Browser                 │
                      │                                          │
                      │  ┌──────────────────────────────────┐   │
                      │  │  Kimi WebBridge Extension        │   │
                      │  │  (conectada al daemon :10086)    │   │
                      │  └──────────────┬───────────────────┘   │
                      │                 │ CDP                   │
                      │  ┌──────────────▼───────────────────┐   │
                      │  │  chat.deepseek.com               │   │
                      │  │  • cookies (todas, HttpOnly incl)│   │
                      │  │  • localStorage.userToken        │   │
                      │  └──────────────────────────────────┘   │
                      └─────────────────────────────────────────┘
                                              │
                            POST /command     │
                            http://127.0.0.1:10086
                                              │
                              ┌───────────────▼────────┐
                              │  Kimi WebBridge Daemon │
                              │  ~/.kimi-webbridge/     │
                              └───────────────┬────────┘
                                              │
                              POST /api/deepseek/session
                              http://localhost:3847
                                              │
                              ┌───────────────▼────────┐
                              │  capi bridge           │
                              │  Bun.serve :3847       │
                              │                        │
                              │  saveSession() ────────┼──→ ~/.cache/capi/
                              └───────────────┬────────┘
                                              │
                              ┌───────────────▼────────┐
                              │  capi chat list       │
                              │  API DeepSeek         │
                              └───────────────────────┘
```

---

## Solución de Problemas

### `capi capture` dice "No disponible"
Asegurate de que la extensión Kimi WebBridge esté instalada en Brave y el daemon corriendo:
```bash
~/.kimi-webbridge/bin/kimi-webbridge
```

### `capi chat list` da timeout esperando sesión
```bash
curl http://localhost:3847/health
```
Verificá que `capi capture` o el Tampermonkey script envió la sesión.

### `ds_session_id` falta
- La cookie expira ~7 días. Volvé a hacer `capi capture`
- O configurá manualmente: `capi auth deepseek setDsSession`
- Para obtener el valor manualmente: Chrome DevTools → Application → Cookies → `chat.deepseek.com`

### Bridge no inicia (puerto ocupado)
```bash
lsof -ti :3847 | xargs kill -9
```
