# Selectores robustos y fallbacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endurecer Qwen y DeepSeek frente a cambios DOM mediante resolución semántica por capas, fallbacks estructurales acotados y detección de streaming multiseñal.

**Architecture:** Crear una biblioteca autocontenida de utilidades DOM inyectable en scripts WebBridge y mantener cadenas de selección específicas por proveedor. Qwen combinará extracción semántica y lectura final ampliada; DeepSeek fusionará SSE y DOM sin falsos positivos globales.

**Tech Stack:** TypeScript, Bun, JSDOM, Kimi WebBridge, pruebas Bun.

## Global Constraints

- Mantener scripts ejecutables como IIFE.
- Priorizar atributos accesibles y visibilidad real.
- No usar selectores globales ambiguos sin contexto.
- Conservar JSON/JSONL, `requestId` y contratos existentes.
- No registrar HTML completo, cookies, tokens ni secretos.
- Aplicar RED → GREEN → REFACTOR en cada tarea.

---

### Task 1: Biblioteca DOM compartida y cadenas de selectores

**Files:**
- Create: `src/proveedores/compartido/scripts/utilidadesDom.ts`
- Modify: `src/proveedores/qwen/selectores/SelectoresQwen.ts`
- Modify: `src/proveedores/deepseek/selectores/SelectoresDeepSeek.ts`
- Create: `test/proveedores/utilidades-dom.test.ts`

**Interfaces:**
- Produces: `scriptUtilidadesDom(): string`, listas ordenadas por intención y selectores heredados compatibles.

- [ ] Escribir pruebas que exijan primer candidato visible, rechazo de ocultos y selección acotada.
- [ ] Ejecutar `bun test test/proveedores/utilidades-dom.test.ts` y verificar fallo por módulo inexistente.
- [ ] Implementar helpers autocontenidos `esVisible`, `primeroVisible`, `visibles`, `textoLimpio` y `masCercano`.
- [ ] Convertir selectores de entrada, envío, stop, contenido y toolbar a listas ordenadas.
- [ ] Ejecutar pruebas y typecheck.
- [ ] Commit: `feat: añadir resolución DOM por capas`.

### Task 2: Entrada y envío robustos

**Files:**
- Modify: `src/proveedores/qwen/navegador/QwenNavegacion.ts`
- Modify: `src/proveedores/qwen/navegador/QwenEnvio.ts`
- Modify: `src/proveedores/deepseek/navegador/DeepSeekNavegacion.ts`
- Modify: `src/proveedores/deepseek/navegador/DeepSeekEnvio.ts`
- Modify: `test/proveedores/navegacion-y-servicios.test.ts`

**Interfaces:**
- Consumes: listas y helpers de Task 1.
- Produces: búsqueda de textarea/contenteditable y botón de envío cercano con diagnóstico acotado.

- [ ] Añadir pruebas para `contenteditable`, botón por `aria-label` y fallback por cercanía.
- [ ] Ejecutar pruebas y confirmar fallos por selectores actuales.
- [ ] Implementar resolución semántica seguida de fallback estructural visible.
- [ ] Añadir errores con intención, proveedor, estrategias y cantidad de candidatos.
- [ ] Ejecutar pruebas y typecheck.
- [ ] Commit: `fix: robustecer entrada y envío web`.

### Task 3: Streaming Qwen y lectura final ampliada

**Files:**
- Modify: `src/proveedores/qwen/scripts/extraerEstadoStreaming.ts`
- Modify: `src/proveedores/qwen/navegador/QwenStreaming.ts`
- Create: `test/fixtures/qwen/respuesta-clases-renombradas.html`
- Create: `test/fixtures/qwen/respuesta-estructural.html`
- Create: `test/fixtures/qwen/stop-oculto.html`
- Modify: `test/proveedores/dom-scripts.test.ts`
- Modify: `test/proveedores/streaming.test.ts`

**Interfaces:**
- Produces: `{ think, response, done, isGenerating, isAssistant, isError, extractionStrategy }` con correlación por prompt.

- [ ] Añadir fixtures y pruebas para clases renombradas, respuesta estructural, stop oculto y pensamiento completado.
- [ ] Ejecutar pruebas y verificar fallos de extracción/finalización.
- [ ] Reescribir selección del turno actual con listas semánticas y fallback acotado.
- [ ] Excluir toolbars, botones, pensamiento y avisos de la lectura final ampliada.
- [ ] Ajustar estabilidad en `QwenStreaming` para varias lecturas consecutivas.
- [ ] Ejecutar pruebas específicas y suite Qwen.
- [ ] Commit: `fix: añadir fallbacks de streaming Qwen`.

### Task 4: Fusión y streaming DeepSeek

**Files:**
- Modify: `src/proveedores/deepseek/scripts/estadoStreaming.ts`
- Modify: `src/proveedores/deepseek/navegador/DeepSeekStreaming.ts`
- Create: `test/fixtures/deepseek/falsos-positivos.html`
- Create: `test/fixtures/deepseek/respuesta-estructural.html`
- Modify: `test/proveedores/dom-scripts.test.ts`
- Modify: `test/proveedores/streaming.test.ts`

**Interfaces:**
- Produces: fusión determinista de SSE acumulativo/incremental y fallback DOM acotado al último turno.

- [ ] Añadir pruebas para fragmentos acumulativos, incrementales, falsos positivos y DOM estructural.
- [ ] Ejecutar pruebas y confirmar truncamiento/falsos positivos actuales.
- [ ] Extraer una función pura de fusión que preserve prefijos y elimine duplicados.
- [ ] Restringir respuesta/stop al contenedor del último turno y validar semántica/visibilidad.
- [ ] Ejecutar pruebas específicas y suite DeepSeek.
- [ ] Commit: `fix: robustecer streaming DeepSeek`.

### Task 5: Verificación integral y WebBridge real

**Files:**
- Modify only if required by failures found above.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: evidencia reproducible de selectores, continuidad y finalización.

- [ ] Ejecutar `bun run typecheck`.
- [ ] Ejecutar `bun test`.
- [ ] Ejecutar `bun run src/cli.ts discover --output json` y `schema chat.send --output json`.
- [ ] Confirmar WebBridge con `~/.kimi-webbridge/bin/kimi-webbridge status`; arrancar si no está disponible.
- [ ] Ejecutar `--dry-run` Qwen y DeepSeek desde la raíz del proyecto.
- [ ] Ejecutar mensaje real corto en Qwen y DeepSeek con JSONL sin `--nueva`.
- [ ] Usar `snapshot` y `evaluate` IIFE para diagnosticar cualquier divergencia.
- [ ] Ejecutar nuevamente typecheck y suite completa.
- [ ] Commit: `test: validar fallbacks web reales` si se añaden fixtures o ajustes finales.
