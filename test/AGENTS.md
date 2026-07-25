# Suite de Pruebas (`test/`) — Guía Detallada por Archivo

El directorio `test/` aloja las pruebas unitarias, de integración y de arquitectura del proyecto CAPI, organizadas en espejo con `src/`.

---

## Estructura por Capas y Pruebas Destacadas

### 1. `test/agente/`
- **`cli-agent.integration.test.ts`**: Verifica que `capi discover` devuelva un sobre JSON estricto versionado `capi.agent.v1` y que `--dry-run` no abra el navegador.
- **`mcp.test.ts`**: Comprueba la instanciación e inicialización del servidor MCP.
- **`formato-salida.test.ts`**: Valida que la salida estructurada JSON/JSONL esté libre de códigos de colores ANSI.

### 2. `test/proveedores/`
- **`dom-scripts.test.ts`**: Prueba unitaria de las funciones JavaScript inyectadas en el DOM para Qwen y DeepSeek (manejo de MutationObserver, extracción de respuestas y correlación de prompts).
- **`estrategias-adjuntos.test.ts`**: Comprueba la inyección por fragmentos DOM en Qwen y el fallback de `DataTransfer`/CDP en DeepSeek.
- **`streaming.test.ts`**: Emula streams SSE y respuestas progresivas.

### 3. `test/conversaciones/` & `test/chat/`
- **`repositorio-contexto.test.ts`**: Verifica el aislamiento de base de datos SQLite entre dos proyectos distintos y valida que los leases de ocupación impidan que dos procesos usen el mismo chat a la vez.
- **`enviar-con-contexto.test.ts`**: Prueba el flujo completo de empaquetado, fallback de modelo por alta demanda y manejo de timeouts.

### 4. `test/multimodal/`
- **`capacidades.test.ts`**: Verifica la selección correcta de modelos visuales (ej. rechazando modelos de texto plano para imágenes).
- **`deteccion-y-separacion.test.ts`**: Valida la detección por firmas mágicas de archivos PNG, JPEG y WebP.

---

## Ejecución de Pruebas

```bash
bun test                         # Ejecución rápida de la suite completa
bun run verify                   # Verificación integral de tipos y suite
bun run smoke:qwen               # Prueba smoke end-to-end con Qwen real
bun run smoke:deepseek           # Prueba smoke end-to-end con DeepSeek real
```
