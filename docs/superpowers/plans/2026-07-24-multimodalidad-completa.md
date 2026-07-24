# Multimodalidad completa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir imágenes y documentos nativos a CAPI con detección MIME, selección de capacidades, CLI/MCP visual y guías completas para agentes sin visión.

**Architecture:** Clasificar adjuntos en el núcleo, mantener texto en bundles y enviar binarios como archivos independientes con MIME real. Los proveedores solo implementan carga/confirmación DOM-CDP; la selección de modalidad permanece en módulos neutrales.

**Tech Stack:** Bun, TypeScript, Citty, MCP SDK, WebBridge/CDP, PNG generado localmente.

## Global Constraints

- Trabajar directamente en `main`, autorizado por el usuario.
- Compatibilidad con los comandos actuales.
- No incluir Base64 en prompts, logs o salidas.
- Imágenes nunca se empaquetan como texto.
- Pruebas deterministas y cobertura modular >= 80%.
- Smokes reales con timeout fuera de la suite determinista.

---

### Task 1: Clasificación MIME y adjuntos multimodales
**Files:** Create `src/nucleo/archivos/DetectarTipoArchivo.ts`; create `src/modulos/contexto/aplicacion/SepararAdjuntosContexto.ts`; test `test/multimodal/deteccion-y-separacion.test.ts`.
**Interfaces:** `detectarTipoArchivo(ruta): ArchivoDetectado`; `separarAdjuntosContexto(rutas): {textuales,imagenes,documentos,rechazados}`.
- [ ] Escribir fixtures y pruebas de firmas PNG/JPEG/WebP/GIF/PDF y texto.
- [ ] Implementar detección por firma con fallback de extensión.
- [ ] Implementar separación y límites seguros.
- [ ] Ejecutar las pruebas y typecheck.

### Task 2: Capacidades y selección visual
**Files:** Create `src/nucleo/proveedores/CapacidadesMultimodales.ts`; create `src/modulos/modelos/aplicacion/SeleccionarModeloMultimodal.ts`; modify manifest; test `test/multimodal/capacidades.test.ts`.
**Interfaces:** contratos por proveedor/modelo con `modalidades`, `mimeAceptados`, `maxImagenes`; selector visual sin degradar a modelos text-only.
- [ ] Escribir pruebas de selección y rechazo.
- [ ] Implementar contratos conservadores y aliases visuales.
- [ ] Exponer contratos en discover/schema.
- [ ] Ejecutar pruebas y typecheck.

### Task 3: Carga binaria real en proveedores
**Files:** Modify QwenEnvio, DeepSeekEnvio y pruebas de adjuntos.
**Interfaces:** crear `File` con MIME detectado; confirmar tarjeta/miniatura por nombre; CDP conserva ruta real.
- [ ] Escribir pruebas que prohíban `text/plain` para PNG/JPEG/WebP.
- [ ] Implementar MIME real y estados visuales.
- [ ] Asegurar limpieza de cualquier tipo de adjunto.
- [ ] Ejecutar pruebas específicas.

### Task 4: Orquestación chat multimodal
**Files:** Modify PeticionChat, EnviarMensajeConContexto, CLI chat y pruebas.
**Interfaces:** `imagenes?: string[]`; separación automática también para `-f`; bundles solo textuales; modelo compatible automático.
- [ ] Escribir pruebas de separación y selección visual.
- [ ] Integrar imágenes independientes y documentos.
- [ ] Añadir `--imagen` repetible y dry-run explicable.
- [ ] Ejecutar pruebas y typecheck.

### Task 5: Comandos visuales y MCP
**Files:** Create `src/entradas/cli/comandos/vision/analizar.ts`, `comparar.ts`; modify CLI/MCP/manifest; tests agent-first.
**Interfaces:** `vision.analyze`, `vision.compare`, `capi_vision_analyze`, `capi_vision_compare`, `capi_chat.images`.
- [ ] Escribir pruebas CLI/MCP/schema.
- [ ] Implementar plantillas descripcion, OCR, UI, diagrama y tabla.
- [ ] Devolver JSON estructurado y autosuficiente.
- [ ] Ejecutar smoke MCP.

### Task 6: Skills y documentación para agentes sin visión
**Files:** Modify `.agents/skills/capi/SKILL.md`, `AGENTS.md`, README y guía de agentes.
- [ ] Añadir protocolo obligatorio y ejemplos copiables.
- [ ] Documentar Qwen 3.8 como nombre dinámico, no alias asumido.
- [ ] Documentar fallbacks visuales y errores.
- [ ] Validar discover/schema contra documentación.

### Task 7: Smoke visual y cierre
**Files:** Create `scripts/smoke-imagen.ts`; modify package scripts.
- [ ] Generar PNG local con marcador único sin depender de OCR local.
- [ ] Enviar a Qwen con timeout y comprobar marcador en respuesta.
- [ ] Ejecutar `bun run verify`, MCP, contratos y smoke visual.
- [ ] Ejecutar `git diff --check`, revisar seguridad y commit final.
