# CAPI — Notas de Desarrollo y Debugging

## 1. Implementaciones Realizadas

### 1.1 Listado de Conversaciones para Qwen

Se implementó el scrapping del sidebar de Qwen para listar conversaciones.

**Archivos creados:**
- `src/proveedores/qwen/scripts/listarConversaciones.ts` — Script DOM que extrae títulos y `data-id` de los elementos del sidebar
- `src/proveedores/qwen/navegador/QwenConversaciones.ts` — Clase que ejecuta el script y normaliza resultados

**Estructura del DOM del sidebar:**
```html
<aside>
  <div class="folder">
    <h3>Hoy</h3>
    <ul class="chat-list">
      <li class="chat-item">
        <div data-id="UUID-1">Título conversación</div>
      </li>
    </ul>
  </div>
</aside>
```

**Script de extracción:**
```typescript
// Busca h3 (título de sección) + UL siguiente + LI.chat-item + div[data-id]
// Agrupa por sección (Hoy, Ayer, etc.)
```

**Habilitación en ProveedorQwen:**
```typescript
// Antes
readonly capacidades: CapacidadesProveedor = { ...conversaciones: false, ... }

// Después
readonly capacidades: CapacidadesProveedor = { ...conversaciones: true, ... }
```

### 1.2 Normalización de URLs de Qwen

Se añadió `normalizarConversacionId()` en `src/entradas/cli/comandos/chat/enviar.ts`.

**Función:**
```typescript
function normalizarConversacionId(valor: string): string {
  try {
    const url = new URL(valor);
    if (url.hostname === "chat.qwen.ai" || url.hostname === "qwen.ai") {
      const match = url.pathname.match(/\/c\/([^/?#]+)/);
      if (match) return match[1]!;
    }
    if (url.hostname === "chat.deepseek.com" || url.hostname === "deepseek.com") {
      const match = url.pathname.match(/\/chat\/([^/?#]+)/);
      if (match) return match[1]!;
    }
  } catch {}
  return valor;
}
```

**Uso:** Acepta tanto IDs crudos (`UUID`) como URLs completas (`https://chat.qwen.ai/c/UUID`).

### 1.3 Validación de Flags Desconocidos

Se creó `src/entradas/cli/soporte/validar-args.ts`.

**Flags conocidos:**
```typescript
const BANDeras_GLOBALES = new Set(["--help", "-h", "--version", "-v"]);
const BANDeras_COMUNES = new Set([
  "--proveedor", "-p", "--modelo", "-m", "--conversacion", "-c",
  "--archivo", "-f", "--imagen", "-i", "--diff",
  "--empaquetar", "--contexto-auto", "--incremental", "--resumen",
  "--nueva", "--fallback", "--output", "-o",
  "--dry-run", "--explain", "--timeout", "--razonamiento", "--busqueda",
  "--json", "--archivadas", "--confirmar",
  "--alias", "--limite", "--fuentes", "--automatico", "--tipo",
  "--instruccion", "--antes", "--despues", "--capas",
  "--limite-contexto", "--request-id",
]);
```

**Integración en `ejecutarCli()`:**
```typescript
export function ejecutarCli(): void {
  const rawArgs = process.argv.slice(2);
  const { ok, unknowns } = validarArgumentosDesconocidos(rawArgs);
  if (!ok) {
    const comando = rawArgs[0] || "";
    mostrarErrorYHelp(comando, unknowns);
    process.exit(1);
  }
  void runMain(comandoPrincipal, { rawArgs: normalizarArgumentosCli(rawArgs) });
}
```

### 1.4 Timeout Extendido para Pensamiento Largo

Se modificaron timeouts en `src/configuracion/ConstantesCapi.ts`:

| Constante | Antes | Después | Razón |
|-----------|-------|---------|-------|
| `STREAMING_CHUNK_TIMEOUT` | 10 min | 30 min | Qwen puede pensar >10 min |
| `INTERVALO_STREAMING` | 100ms | 2000ms | Reducir carga en polling |
| `RESPUESTA_VACIA_QWEN` | 30s | 60s | Más tolerancia a pausas |

### 1.5 Evento `pausado` en Streaming

Se añadió el tipo de evento `pausado` para manejar timeouts sin perder la conversación.

**Tipo en `src/nucleo/chat/EventoStreaming.ts`:**
```typescript
export type EventoStreaming =
  // ... existente ...
  | { tipo: "pausado"; motivo: string; conversacionId?: string }
  | { tipo: "error"; mensaje: string; recuperable?: boolean };
```

**En `QwenStreaming.observar()`:**
- Cuando ocurre timeout en `STREAMING_CHUNK_TIMEOUT`, en lugar de lanzar excepción:
  - Obtiene el ID de conversación actual de la URL
  - Emite `{ tipo: "pausado", motivo: "...", conversacionId: "UUID" }`
  - Retorna sin error

**Mensaje de pausado:**
```
"Timeout — Qlik aún está procesando. Puedes retomar con 'capi chat --continuar'"
```

---

## 2. Errores y Lecciones Aprendidas

### 2.1 Flag Inventado: `--conversation-id`

**Error:** Se usó `--conversation-id` repetidamente creyendo que existía.

**Realidad:** El flag correcto es `--conversacion` (alias `-c`).

**Lección:** Siempre verificar con `capi schema chat.send --output json` antes de inventar flags.

### 2.2 ID de Conversación Incorrecto

**Error:** Se usó `d6964d2a-c59c-4c74-a2a6-2a665557c131` cuando el correcto era `0a9af4a3-5733-402e-84fa-090806ad0871`.

**Lección:** Confirmar IDs con el usuario antes de usarlos.

### 2.3 Scrapping de Conversaciones Devuelve Vacío

**Problema:** `conversaciones listar -p qwen` no devolvió resultados.

**Análisis:**
- El HTML curado muestra `li.chat-item` sin `data-id` en el elemento `li`
- Los `data-id` están en `div`s internos: `li.chat-item > div[data-id="UUID"]`
- El script busca `li.chat-item` → `div[data-id]` pero puede haber fallado por timing del DOM

**Estado:** El scrapping puede necesitar ajustes o ser asynchronous (el sidebar puede no estar cargado).

### 2.4 Error "parent_id is not exist"

**Mensaje de Qwen:**
```
Invalid input chat parent_id 5a8a622a-667d-4416-871c-4b899c98571f is not exist
```

**Causa:** La conversación padre (thread) referenciada internamente por Qwen no existe. Puede ser porque:
1. La conversación fue eliminada en Qwen
2. El chat interno de Qwen tiene referencias corruptas

**No es bug de CAPI** — Qwen mismo rechaza la petición.

### 2.5 Bloqueo de Conversación Sin Remedio

**Síntoma:** `Error: La conversación X está siendo usada por otro proceso.`

**Problema:** No existe forma de limpiar bloqueos.

**Capa intentada:** `capi estado limpiar --capas ocupaciones` → Error: "Capa no soportada"

**Capas válidas:** `cache`, `snapshots`, `historial`, `resumenes`

**Estado:** Pendiente implementar limpieza de ocupaciones.

### 2.6 Diferencia Entre ID Interno y ID de URL en Qwen

**Hallazgo:** El sidebar tiene `data-id` en elementos pero no está claro si corresponde al UUID de la URL.

**Sospecha:** Qwen usa un ID interno para el sidebar y un UUID diferente para la URL pública.

**Estado:** Investigar si hay correlación.

---

## 3. Arquitectura de Conversaciones en CAPI

### 3.1 Flujo Completo

```
CLI: capi chat -c UUID "prompt"
  │
  ├─→ normalizarConversacionId("UUID") → "UUID"
  │
  ├─→ GestorContextoProyecto.seleccionar("qwen", "UUID")
  │     ├─→ repositorio.listarConversacionesProyecto(proyecto.id) → candidatas[]
  │     └─→ seleccionarConversacion({ conversacionExplicita: "UUID", ... })
  │           → { conversacionId: "UUID", motivo: "explicita" }
  │
  ├─→ EnviarMensajeConContexto.ejecutar("qwen", { conversacionId: "UUID", prompt })
  │     │
  │     ├─→ adquirirOcupacion(UUID) — bloquea para otros procesos
  │     │
  │     ├─→ proveedor.enviarMensaje({ conversacionId: "UUID", ... })
  │     │     ├─→ verificarDisponibilidad()
  │     │     ├─→ pagina.abrirConversacion("UUID")
  │     │     │     └─→ navegar("https://chat.qwen.ai/c/UUID")
  │     │     ├─→ pagina.enviarPrompt(prompt)
  │     │     └─→ pagina.observarStreaming() → yield eventos
  │     │
  │     └─→ registrarConversacion({ id: UUID, ... }) — guarda en SQLite
  │
  └─→ liberarOcupacion(UUID) — desbloquea
```

### 3.2 Flags del Comando Chat

| Flag | Alias | Descripción |
|------|-------|-------------|
| `--proveedor` | `-p` | `qwen` o `deepseek` (default: deepseek) |
| `--conversacion` | `-c` | ID o URL de conversación |
| `--modelo` | `-m` | `preview`, `max`, `plus` para Qwen |
| `--archivo` | `-f` | Archivos a enviar como contexto |
| `--nueva` | — | Forzar conversación nueva |
| `--dry-run` | — | Solo mostrar plan sin ejecutar |
| `--output` | `-o` | `human`, `markdown`, `json`, `jsonl` |

### 3.3 Slots de Conversación en Qlik (del sidebar)

```
Hoy:
  - New chat
  - Qlik Automate Creator Structure
  - Prueba de Mensaje
  - Qlik Automate Web Components
  - Prueba desde Kimi WebBridge
  - Mensaje de prueba
  - QWEN_OK (muchos)
  - Revisión de Rutas y Imágenes ← conversación objetivo
  - Marcador Exacto del Texto (varios)

Ayer:
  - OK (varios)
  - Hola Greeting
  - Hola Conversation
```

---

## 4. Issues Pendientes

| # | Descripción | Prioridad | Estado |
|---|-------------|-----------|--------|
| 1 | `conversaciones listar -p qwen` devuelve vacío | Alta | Parcial: script mejorado pero requiere página abierta |
| 2 | Limpiar bloqueos de conversación | Alta | ✅ Resuelto: `capi estado limpiar --capas ocupaciones --confirmar` |
| 3 | El `data-id` del sidebar puede no ser el UUID de URL | Media | En investigación |
| 4 | `capi chat --continuar` para retomar | Media | ✅ Resuelto: `capi chat --continuar -c UUID` |
| 5 | La limpieza de ocupaciones no está implementada | Alta | ✅ Resuelto |

---

## 5. Comandos Útiles para Debug

```bash
# Ver schema completo de un comando
capi schema chat.send --output json

# Dry-run para ver qué se enviaría
capi chat -c UUID --dry-run "prompt"

# Enviar mensaje a conversación existente
capi chat -c UUID "tu prompt" -p qwen

# Continuar polling de una conversación (sin enviar mensaje)
capi chat --continuar -c UUID -p qwen

# Limpiar bloqueos de conversaciones
capi estado limpiar --capas ocupaciones --confirmar

# Listar conversaciones
capi conversaciones listar -p qwen --output json
capi conversaciones listar -p deepseek --output json

# Ver proyecto actual detectado
capi proyecto actual --output json

# Estado del proyecto
capi estado metricas --output json

# Ver ayuda de un comando
capi chat --help
```

## 6. Corrección Del Streaming De DeepSeek

Se corrigió un problema por el que la salida estructurada terminaba con fragmentos incompletos como `The user asks to`.

### Causas

- El extractor SSE recorría recursivamente cualquier campo llamado `content` o `text`, mezclando metadatos con la respuesta.
- DeepSeek podía marcar `done` antes de que el último fragmento estuviera disponible en el DOM o en su API.
- El acumulador solo aceptaba respuestas que fueran una extensión literal del fragmento anterior.

### Correcciones

- Priorizar `choices[].delta.content` y `choices[].message.content`.
- Ignorar campos genéricos que no representan el mensaje principal.
- Reconocer respuestas acumulativas y fragmentos incrementales sin duplicarlos.
- Confirmar el final durante varias consultas antes de emitir `completed`.
- Consultar API e IndexedDB durante esa ventana de confirmación.
- Ampliar el límite de observación de DeepSeek a aproximadamente 30 minutos.

### Validación real

```bash
capi chat -p deepseek -m default --nueva --output json \
  "Responde exactamente con 7 y nada más"
```

Resultado validado: `response: "7"`.

## 7. Reutilización Automática De Conversaciones

La selección automática ahora prioriza la conversación persistida del proyecto y no crea una nueva por antigüedad.

- Una conversación antigua pero no archivada se reutiliza con motivo `persistente`.
- Una conversación ocupada se conserva como objetivo y la ejecución informa el bloqueo; ya no se cambia silenciosamente a otro chat.
- Los reintentos por cambio de modelo conservan el mismo `conversacionId`.
- `nuevaPestana` solo abre otra pestaña del mismo chat; no implica crear otra conversación.
- Una conversación nueva solo se crea cuando se usa explícitamente `--nueva` o no existe ninguna candidata.

Validación:

```bash
capi chat -p deepseek --dry-run --output json "prueba de reutilizacion"
```

El resultado debe incluir `selection.conversacionId` y no `motivo: "nueva"` cuando ya existe una conversación registrada.

## 8. Mejoras De CLI Y Concurrencia

- Los flags se validan contra la definición real del comando Citty, no contra una lista global.
- Los argumentos desconocidos muestran sugerencias por similitud y los flags disponibles.
- El prompt es obligatorio salvo cuando se usa `--continuar`.
- Se rechazan combinaciones contradictorias como `--nueva --conversacion` y `--continuar --archivo`.
- `--continuar` puede detectar la conversación activa del proveedor si no se proporciona un ID.
- Las ejecuciones pausadas quedan registradas con estado `pausada` en el historial.
- SQLite usa `busy_timeout` junto con WAL para tolerar CLI, MCP y servidor ejecutándose simultáneamente.
