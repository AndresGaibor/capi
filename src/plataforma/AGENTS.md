# Plataforma (`src/plataforma/`) — Guía Detallada por Archivo

El directorio `src/plataforma/` contiene los adaptadores de infraestructura física y comunicación de bajo nivel.

---

## 1. Comunicación WebBridge (`src/plataforma/webbridge/`)

- **[`ClienteWebBridge.ts`](file:///Users/andresgaibor/code/javascript/capi/src/plataforma/webbridge/ClienteWebBridge.ts)**:
  - Cliente HTTP/WebSocket que se conecta con el demonio/extensión WebBridge (`http://localhost:59123` o puerto configurado).
  - Métodos: `ejecutarScript(tabId, script)`, `obtenerEstado()`, `crearPestana(url)`.

- **[`GestorPestanas.ts`](file:///Users/andresgaibor/code/javascript/capi/src/plataforma/webbridge/GestorPestanas.ts)**:
  - Administra la asignación y reutilización de pestañas en el navegador. Reutiliza la sesión activa etiquetada como `capi-capture` o fuerza la navegación si la sesión expiró.

---

## 2. Persistencia SQLite Local (`src/plataforma/persistencia/`)

- **[`RepositorioContextoSqlite.ts`](file:///Users/andresgaibor/code/javascript/capi/src/plataforma/persistencia/RepositorioContextoSqlite.ts)**:
  - Implementación SQLite mediante `bun:sqlite`. Agrupa la gestión de las tablas locales alojadas en el directorio de usuario (ej. `~/.capi/capi.sqlite`).

- **Módulos Especializados de Persistencia**:
  - `RepositorioOcupaciones.ts`: Adquiere y libera los leases de ocupación por conversación (`adquirirOcupacion`) con TTL y marcas de tiempo para prevenir colisiones de agentes.
  - `RepositorioEjecuciones.ts`: Limita la concurrencia global de comandos a un máximo de 3 procesos activos simultáneos.
  - `RepositorioCache.ts`: Almacena resúmenes y hashes de fragmentos de contexto empaquetados para acelerar envíos futuros.
  - `RepositorioHistorial.ts`: Guarda la auditoría local de mensajes enviados y recibidos.

---

## 3. Renderizado y Consola (`src/plataforma/consola/`)

- **`RenderizadorSalida.ts`**:
  - Formatea la salida estándar (STDOUT). Soporta eventos JSONL en tiempo real (`--output jsonl`) y sobres JSON únicos al finalizar (`--output json`), eliminando secuencias de escape ANSI.
