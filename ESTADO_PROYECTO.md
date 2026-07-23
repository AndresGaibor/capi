# Estado del Proyecto: capi — CLI de DeepSeek

## URL del repo
`/Users/andresgaibor/code/javascript/capi`

---

## Resumen Ejecutivo

El streaming de DeepSeek **funciona parcialmente**. Hay dos problemas críticos sin resolver:
1. **Sesión de WebBridge muere** — la sesión `capi-capture` muere después de ~5-10s sin actividad
2. **Streaming llega "de golpe"** — el texto no llega letra por letra, sino todo al final

---

## Arquitectura

```
src/
├── dominio/deepseek/
│   ├── casos-de-uso/
│   │   ├── EnviarMensajeStreaming.ts  ← PRINCIPAL (297 líneas)
│   │   └── EnviarMensaje.ts          ← Fallback (IndexedDB polling)
│   ├── entidades/
│   ├── puertos/
│   │   ├── PuertoInterfazWebBridge.ts
│   │   └── PuertoSalidaCLI.ts
│   └── servicios/
├── adaptadores/
│   ├── webbridge/AdaptadorKimiWebBridge.ts
│   ├── indexeddb/AdaptadorIndexedDB.ts
│   └── api/DeepSeekAPI.ts
├── aplicacion/deepseek/
│   └── ServicioChatDeepSeek.ts
└── comandos/
    ├── chat.ts  ← CLI commands (send, list, messages)
    └── serve.ts
```

---

## Lo que FUNCIONA

- ✅ Textarea trick: `nativeSetter.call(textarea, prompt)` + `input event` + `click()`
- ✅ Navegación a conversación existente o chat nuevo (`id="new"`)
- ✅ Detección de servidor ocupado (`.ds-button--warning`)
- ✅ Retry automático (3 intentos máx, 3s de backoff)
- ✅ Done detection con botones de acción y ausencia de `stopButton`
- ✅ Fallback de selectores para streaming en tiempo real (`.ds-markdown`, `[class*="think"]`)
- ✅ Verificación de sesión con `capi auth status` y `getSessionStatus()`
- ✅ Binario de Bun dinámico con `process.execPath` (sin rutas hardcodeadas de usuario)
- ✅ Normalización de respuesta conservando saltos de línea y formateo
- ✅ Suite de tests automatizada (`bun test` — 8/8 tests pasando)
- ✅ Documentación para agentes en `AGENTS.md` y `GEMINI.md`
- ✅ Flags CLI: `--model`, `--deepthink`, `--search`, `-f/--file`, `-n/--limit`, `-q/--query`

---

## Lo que NO FUNCIONA

### 1. Sesión de WebBridge muere frecuentemente
- La sesión `capi-capture` muere después de ~5-10s sin actividad
- Cada comando curl individual puede fallar con `"session has no tab"`
- La CLI sí mantiene la sesión durante el streaming
- **Workaround**: renavegar antes de cada comando

### 2. Streaming llega "de golpe"
- **Síntoma**: el texto completo llega al final, no letra por letra
- **Causa raíz detectada**: `.ds-think-content` y `.ds-assistant-message-main-content` NO existen mientras DeepSeek está escribiendo activamente. Solo aparecen cuando el mensaje termina.
- Los selectores `.ds-think-content` y `.ds-assistant-message-main-content` devuelven 0 nodos durante la generación activa del modelo

### 3. El click del botón no siempre funciona
- A veces el prompt se escribe en el textarea pero el botón no responde
- El botón puede estar deshabilitado o el evento no dispara correctamente

---

## Estructura del DOM de DeepSeek (DESCUBIERTO)

```
#root > div.cb86951c
├── div._765a5cd (Expert/Think/Assistant — RENDERIZADO DIRECTO)
│   ├── "Hola saludo y oferta de ayuda"
│   ├── "Expert" (marca el inicio del área del asistente)
│   ├── "DeepThink" (si está activo)
│   ├── "AI-generated, for reference only"
│   └── (contenido del mensaje del asistente)
│
└── div._189b4a0 (User messages — VIRTUAL LIST)
    └── .ds-virtual-list
        └── .ds-virtual-list-visible-items (vacío → se llena con user msgs)
```

**Key insight**: Los selectores `.ds-think-content` y `.ds-assistant-message-main-content` son del sistema de diseño de DeepSeek pero **solo existen cuando el mensaje ha terminado de generarse**. Durante la generación activa, el contenido vive en `div._765a5cd` con clases hasheadas.

---

## Selectores confirmados

```typescript
// Durante generación activa (NO FUNCIONAN — devuelven 0):
document.querySelectorAll('.ds-think-content')        // 0 nodos
document.querySelectorAll('.ds-assistant-message-main-content')  // 0 nodos

// Después de que termina (SÍ funcionan):
document.querySelectorAll('.ds-think-content')        // tiene nodos
document.querySelectorAll('.ds-assistant-message-main-content')  // tiene nodos

// Error detection:
document.querySelector('.ds-button--warning')  // "Server is busy"

// Done detection:
container.querySelectorAll('.ds-button--iconLabelTertiary').length >= 2

// Área activa durante escritura:
Array.from(document.querySelectorAll('div'))
  .find(el => el.innerText === 'Expert')  // punto de entrada a div._765a5cd
```

---

## Archivo principal: EnviarMensajeStreaming.ts

```typescript
// Versión actual (297 líneas)
// Ubicación: src/dominio/deepseek/casos-de-uso/EnviarMensajeStreaming.ts

// INTERFAZ:
export interface EventoStream {
  type: "think" | "response" | "start_response" | "done" | "error";
  content?: string;
}

export interface OpcionesChat {
  modelo?: "default" | "expert" | "vision";
  deepThink?: boolean;
  search?: boolean;
  archivos?: string[];
}

// MÉTODO PRINCIPAL:
async *ejecutar(
  idConversacion: string,
  prompt: string,
  opciones?: OpcionesChat
): AsyncGenerator<EventoStream>
```

### Flujo del método:
1. Verificar WebBridge disponible
2. Navegar a la URL (o a `/` si `idConversacion === "new"`)
3. Esperar textarea
4. Configurar interfaz (modelo, toggles)
5. Escribir prompt en textarea y hacer click
6. Esperar a que aparezcan nodos `.ds-think-content` o `.ds-assistant-message-main-content` (hasta 10s)
7. Polling cada 100ms extrayendo think y response
8. Detectar done o timeout (50 iteraciones sin cambios)
9. Manejar errores "Server busy" con retry (3 intentos)

---

## CLI chat.ts — comando send

```typescript
// Ubicación: src/comandos/chat.ts

send: defineCommand({
  args: {
    id: { type: "positional", required: true },
    prompt: { type: "positional", required: true },
    model: { type: "string" },        // default | expert | vision
    deepthink: { type: "boolean" },
    search: { type: "boolean" },
  },
  async run({ args }) {
    // Convierte args a OpcionesChat y llama:
    servicio.enviarPromptStreaming(args.id, args.prompt, opciones)
  }
})

// Ejemplo:
// bun run src/cli.ts chat send new "Cuanto es 2+2" --model expert --deepthink
// bun run src/cli.ts chat send 7a0ce1db-0556-4955-8091-8a93b4f7751c "hola"
```

---

## Adaptador WebBridge

```typescript
// Ubicación: src/adaptadores/webbridge/AdaptadorKimiWebBridge.ts
// URL: http://127.0.0.1:10086
// Sesión: capi-capture

// Métodos:
estaDisponible(): Promise<boolean>
navegar(url, nuevaPestana, tituloGrupo): Promise<{ success: boolean }>
evaluar<T>(codigo): Promise<ResultadoEvaluacion & { value: T }>
cdp<T>(method, params?): Promise<T>
cerrarSesion(): Promise<void>
inyectarScript(script): Promise<void>
```

---

## Comandos para testear

```bash
# Renavegar si la sesión murió
curl -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" \
  -d '{"action":"navigate","args":{"url":"https://chat.deepseek.com/a/chat/s/7a0ce1db-0556-4955-8091-8a93b4f7751c","newTab":false},"session":"capi-capture"}'

# Ver selectores
curl -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" \
  -d '{"action":"evaluate","args":{"code":"JSON.stringify({think: document.querySelectorAll(\".ds-think-content\").length, resp: document.querySelectorAll(\".ds-assistant-message-main-content\").length})"},"session":"capi-capture"}'

# Ver área activa (_765a5cd)
curl -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" \
  -d '{"action":"evaluate","args":{"code":"(() => { const area = Array.from(document.querySelectorAll(\"div\")).find(el => el.innerText === \"Expert\"); if (!area) return \"not found\"; const parent = area.parentElement?.parentElement?.parentElement?.parentElement; return parent ? parent.className.split(\" \")[0] : null; })()"},"session":"capi-capture"}'

# Typecheck
cd /Users/andresgaibor/code/javascript/capi && bunx tsc --noEmit

# Streaming test (sesión debe estar viva)
cd /Users/andresgaibor/code/javascript/capi
curl -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" \
  -d '{"action":"navigate","args":{"url":"https://chat.deepseek.com/a/chat/s/7a0ce1db-0556-4955-8091-8a93b4f7751c","newTab":false},"session":"capi-capture"}'
sleep 6
timeout 90 bun run src/cli.ts chat send 7a0ce1db-0556-4955-8091-8a93b4f7751c "Cuanto es 2+2" 2>&1
```

---

## Problemas abiertos (priorizados)

### P0 — Streaming no funciona en tiempo real
El texto llega todo al final, no letra por letra. Causa: `.ds-think-content` y `.ds-assistant-message-main-content` no existen durante la generación activa.

**Diagnóstico necesario**: Encontrar los selectores que DeepSeek usa MIENTRAS está escribiendo. El contenido activo está en `div._765a5cd` pero con clases hasheadas. Hay que buscar elementos temporales que contengan texto en crecimiento.

**Test a ejecutar** (mientras DeepSeek está escribiendo):
```bash
curl -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" \
  -d '{"action":"evaluate","args":{"code":"(() => { const areas = Array.from(document.querySelectorAll(\"div\")).filter(el => el.innerText && el.innerText.includes(\"Expert\") && el.innerText.includes(\"Thought for\")); if (!areas.length) return \"Area no encontrada\"; const activeArea = areas[areas.length - 1]; return Array.from(activeArea.querySelectorAll(\"*\")).map(el => ({ tag: el.tagName, cls: el.className })).filter(x => x.cls && x.cls.includes(\"ds-\")).slice(0, 20); })()"},"session":"capi-capture"}'
```

### P1 — Sesión muere frecuentemente
La sesión `capi-capture` muere después de ~5-10s sin actividad. Cada comando curl individual puede fallar.

**Posible solución**: Mantener un heartbeat activo (evaluar algo simple cada 3s) durante el polling para evitar que la sesión muera.

### P2 — Click del botón no siempre funciona
A veces el prompt se escribe en el textarea pero el botón no responde.

---

## Notas importantes

1. **El selector `_765a5cd`** — Es una clase hasheada que puede cambiar entre builds de DeepSeek
2. **Los nodos desaparecen** — Después de que DeepSeek termina, `.ds-think-content` y `.ds-assistant-message-main-content` desaparecen del DOM
3. **La sesión no se cierra** — Se eliminó `this.webbridge.cerrarSesion()` al final para mantener la pestaña abierta
4. **No hay tests** — No hay archivos `.test.ts` ni scripts de test en package.json
5. **Runtime**: Bun (no Node.js)

---

## Historial de comandos curl probados

```bash
# Enviar prompt y click
curl -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" \
  -d '{"action":"evaluate","args":{"code":"(() => { const ta = document.querySelector(\"textarea[name=search]\"); if (!ta) return \"no textarea\"; const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, \"value\").set; setter.call(ta, \"Hola\"); ta.dispatchEvent(new Event(\"input\", { bubbles: true })); ta.dispatchEvent(new Event(\"change\", { bubbles: true })); const btn = document.querySelector(\"div[role=button].ds-button--primary:not(.ds-button--disabled)\") || document.querySelector(\"div[role=button].ds-button--primary\"); if (btn) btn.click(); return \"clicked\"; })()"},"session":"capi-capture"}'

# Ver mensajes en virtual list
curl -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" \
  -d '{"action":"evaluate","args":{"code":"(() => { const vls = document.querySelectorAll(\".ds-virtual-list\"); const inner = vls[1]; if (!inner) return \"no inner vl\"; const items = inner.querySelector(\".ds-virtual-list-visible-items\"); return { count: items?.children.length, msgs: Array.from(items?.children || []).map(c => c.innerText?.slice(0, 80)) }; })()"},"session":"capi-capture"}'

# Ver estructura del área activa
curl -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" \
  -d '{"action":"evaluate","args":{"code":"(() => { const area = Array.from(document.querySelectorAll(\"div\")).find(el => el.className.includes && el.className.includes(\"_765a5cd\")); if (!area) return \"no _765a5cd\"; return area.innerText.slice(0, 500); })()"},"session":"capi-capture"}'
```
