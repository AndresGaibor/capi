# Finalización de contexto y smokes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terminar la entrega de contexto por proyecto, endurecer los smokes reales y dejar el repositorio verificado y documentado.

**Architecture:** Conservar la separación núcleo/módulos/proveedores/plataforma/entradas. Los smokes tendrán un límite temporal externo para que un cambio de DOM no bloquee indefinidamente CI o una terminal.

**Tech Stack:** Bun, TypeScript, bun:test, bun:sqlite, WebBridge.

## Global Constraints

- Trabajar directamente sobre `main`, sin worktree.
- Mantener nombres y mensajes técnicos en español.
- No reducir la cobertura modular por debajo de 80%.
- No mover política de proyectos, concurrencia o CLI a proveedores.

---

### Task 1: Smoke Qwen acotado

**Files:**
- Modify: `scripts/smoke-qwen.ts`
- Test: `test/smoke/proceso-con-timeout.test.ts`

**Interfaces:**
- Produces: `ejecutarProcesoConTimeout(comando, timeoutMs)` con salida, error, código y marca de timeout.

- [ ] Escribir una prueba que ejecute un proceso rápido y otro que exceda el límite.
- [ ] Confirmar que la prueba falla antes de implementar el helper.
- [ ] Implementar el helper y usarlo en los tres intentos de Qwen.
- [ ] Confirmar que el proceso hijo se termina y el smoke continúa o falla de forma explícita.

### Task 2: Verificación real y documentación

**Files:**
- Modify: `README.md`
- Modify: `docs/agentes/integracion.md`

**Interfaces:**
- Consumes: comandos y contratos actuales de CAPI.
- Produces: documentación de contexto automático, archivos, fallback y límites de smokes.

- [ ] Ejecutar `bun run verify` y conservar evidencia de 100 pruebas y cobertura.
- [ ] Ejecutar `bun run smoke:deepseek` y exigir respuesta `OK`.
- [ ] Ejecutar `bun run smoke:qwen` y exigir `QWEN_OK` o un fallo temporal acotado y explícito.
- [ ] Documentar `--archivo`, `--contexto-diff`, `--max-context-bytes`, `--no-empaquetar` y el comportamiento del smoke.

### Task 3: Cierre de entrega

**Files:**
- Review: all modified files

- [ ] Ejecutar `git diff --check`.
- [ ] Ejecutar nuevamente `bun run verify` después de documentación y helper.
- [ ] Revisar que no se registren tokens, cookies ni contenido sensible.
- [ ] Crear un commit único con autoría configurada del usuario y un mensaje descriptivo.
