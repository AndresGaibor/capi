# Entradas (`src/entradas/`) — Guía Detallada por Archivo

El directorio `src/entradas/` contiene las interfaces primarias del sistema (CLI y servidor MCP).

---

## 1. Interfaz CLI (`src/entradas/cli/`)

- **[`cli.ts`](file:///Users/andresgaibor/code/javascript/capi/src/entradas/cli/cli.ts)**:
  - Punto de entrada ejecutable de Commander.js. Registra todos los comandos y parsea las banderas de la terminal.

- **`src/entradas/cli/composicion/` (Composition Root)**:
  - `ComposicionCLI.ts`: Instancia el contenedor de inyección de dependencias, creando la única conexión a la base de datos SQLite y registrando los proveedores de Qwen y DeepSeek en `RegistroProveedores`.

- **`src/entradas/cli/agente/` (Soporte AI-First)**:
  - `ManifiestoCapacidades.ts`: Implementa el comando `capi discover`, retornando el mapa estricto de comandos y flags en formato JSON versionado `capi.agent.v1`.
  - `EsquemasComandos.ts`: Implementa el comando `capi schema <comando>`, entregando la definición JSON Schema de los argumentos aceptados.

- **`src/entradas/cli/comandos/` (Definición de Comandos)**:
  - `chat/enviar.ts`: Comando `capi chat` para streaming de mensajes.
  - `vision/analizar.ts` & `vision/comparar.ts`: Comandos para análisis multimodal e inspección de imágenes.
  - `contexto/empaquetar.ts`: Muestra y empaqueta el contexto del proyecto.
  - `diagnostico/doctor.ts`: Ejecuta comprobaciones de salud del sistema.

---

## 2. Servidor MCP (`src/entradas/mcp/`)

- **[`mcp.ts`](file:///Users/andresgaibor/code/javascript/capi/src/mcp.ts)**:
  - Punto de entrada principal que arranca el servidor MCP local por `stdio`.

- **`src/entradas/mcp/servidor.ts`**:
  - Implementación del protocolo Model Context Protocol. Mapea las llamadas RPC del cliente (Claude Desktop, Antigravity, etc.) a los casos de uso internos sin duplicar reglas de negocio.
