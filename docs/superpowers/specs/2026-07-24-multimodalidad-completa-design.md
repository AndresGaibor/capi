# Multimodalidad completa de CAPI

## Objetivo

Permitir que CAPI reciba imágenes y documentos binarios como adjuntos nativos, seleccione modelos compatibles, confirme su procesamiento y entregue resultados estructurados para agentes que no pueden analizar imágenes por sí mismos.

## Arquitectura

CAPI clasificará cada ruta en texto, imagen, documento o binario no soportado mediante firma y extensión. El contexto textual seguirá pasando por el empaquetador; imágenes y documentos permanecerán como adjuntos independientes con MIME real. La selección de proveedor/modelo se validará contra capacidades explícitas y los fallbacks conservarán la modalidad requerida.

## Interfaces

- `capi chat --imagen ruta.png --imagen segunda.webp ...`
- `capi vision analizar ruta.png --tipo descripcion|ocr|ui|diagrama|tabla --output json`
- `capi vision comparar antes.png despues.png --output json`
- MCP: `capi_vision_analyze`, `capi_vision_compare`; `capi_chat.images`.
- `discover` y `schema` exponen modalidades, MIME aceptados, límites y fallbacks visuales.

## Flujo

1. Resolver rutas y validar tamaño.
2. Detectar MIME por firma y extensión.
3. Separar texto empaquetable de adjuntos multimodales.
4. Seleccionar un modelo compatible o fallar con sugerencia concreta.
5. Crear `File` con MIME real, cargar y confirmar tarjeta o miniatura.
6. Enviar un prompt autosuficiente.
7. Entregar texto/JSON utilizable por un agente sin visión.

## Seguridad

- Nunca insertar Base64 en prompts o salidas.
- No enviar archivos desconocidos, ejecutables o secretos.
- No empaquetar imágenes dentro del bundle de texto.
- No afirmar capacidades visuales sin contrato explícito.
- Mantener rutas locales fuera de respuestas del modelo salvo petición expresa.

## Proveedores

Qwen será el proveedor visual preferido. Sus aliases web se mantendrán estables (`preview`, `max`, `plus`) y el nombre visible se reportará sin asumir que un alias corresponde a una versión concreta como “Qwen 3.8”. DeepSeek solo se usará para imágenes cuando el modelo/contrato visible declare visión; de lo contrario no será fallback visual.

## Agentes sin visión

La skill y `AGENTS.md` ordenarán: no inventar contenido, delegar en CAPI, pedir salida estructurada, conservar incertidumbres y aplicar fallbacks solo a modelos con modalidad `image`.

## Pruebas

- Firmas PNG/JPEG/WebP/GIF/PDF.
- Separación texto/imagen.
- MIME real en `File` de Qwen y DeepSeek DOM.
- Selección y rechazo por capacidades.
- CLI/MCP y manifiesto.
- Fixtures de miniatura/tarjeta.
- Smoke visual con marcador único renderizado dentro de PNG.
