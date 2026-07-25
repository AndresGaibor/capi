# Proveedores (`src/proveedores/`) — Guía Detallada por Archivos

El directorio `src/proveedores/` aloja la implementación concreta para interactuar con las interfaces web de **Qwen** y **DeepSeek**.

---

## 1. Proveedor Qwen (`src/proveedores/qwen/`)

- **[`ProveedorQwen.ts`](file:///Users/andresgaibor/code/javascript/capi/src/proveedores/qwen/ProveedorQwen.ts)**:
  - Implementación principal de `ProveedorChat`. Orquesta la navegación a la página de Qwen, inyección de adjuntos, selección de modelos (`preview`, `max`, `plus`) y el polling de streaming.

- **`src/proveedores/qwen/scripts/` (Scripts DOM Inyectados)**:
  - `enviarPrompt.ts`: Manipula el textarea principal (`.chat-input` / textarea nativo) simulando la entrada de usuario mediante `nativeInputValueSetter` e interactúa con el botón de envío.
  - `extraerEstadoStreaming.ts`: Ejecuta en la pestaña del navegador un `MutationObserver` o consulta periódica para capturar los nodos de respuesta en tiempo real sin bloquear el hilo principal.
  - `adjuntarArchivoDom.ts`: Construye fragmentos Base64 en memoria y genera un objeto `File` sintáctico adjuntado directamente al input `type="file"`.

- **`src/proveedores/qwen/selectores/SelectoresQwen.ts`**:
  - Centraliza los selectores CSS y XPath de la UI web de Qwen (cuadro de texto, botón de stop, contenedores de mensajes, selector de modelos A/B).

---

## 2. Proveedor DeepSeek (`src/proveedores/deepseek/`)

- **[`ProveedorDeepSeek.ts`](file:///Users/andresgaibor/code/javascript/capi/src/proveedores/deepseek/ProveedorDeepSeek.ts)**:
  - Implementación principal de `ProveedorChat` para DeepSeek.
  - **Característica crítica**: Maneja la restricción del frontend de DeepSeek donde no es posible cambiar el modo (`expert` vs `default`) en un chat existente. Al alternar modelos, obliga la creación de una pestaña/conversación nueva (`conversacionId: undefined`).

- **`src/proveedores/deepseek/navegador/`**:
  - `DeepSeekEnvio.ts`: Gestiona la escritura del prompt, activación opcional de DeepThink (`.ds-think-button`) y búsqueda Web (`.ds-search-button`).
  - `DeepSeekStreaming.ts`: Implementa la estrategia de lectura continua.
    - *Insight de DOM*: Durante la generación activa del modelo, los contenedores estándar `.ds-think-content` no existen y el contenido vive en nodos directos con clases dinámicas (`div._765a5cd`). Este módulo maneja ese fallback.

- **`src/proveedores/deepseek/servicios/`**:
  - `DeepSeekServicioHistorial.ts`: Fallback de respaldo que consulta la API interna autenticada del historial cuando la renderización virtual del DOM no expone la respuesta completa.

- **`src/proveedores/deepseek/selectores/SelectoresDeepSeek.ts`**:
  - Diccionario de selectores CSS (tanto clases estables `.ds-*` como clases hasheadas dinámicas `._765a5cd`).
