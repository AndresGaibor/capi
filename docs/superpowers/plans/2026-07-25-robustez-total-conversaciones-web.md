# Robustez Total de Conversaciones Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir CAPI en un supervisor durable y recuperable para conversaciones web largas, con telemetría Qwen opcional, tareas SQLite unificadas, recuperación de procesos, retención, logs y paridad básica entre proveedores.

**Architecture:** Tampermonkey actúa como señal secundaria opcional y nunca contiene prompts ni respuestas. SQLite es la única fuente de verdad para ejecuciones, eventos, ownership e idempotencia. Cada proveedor emite observaciones normalizadas y comparte políticas de progreso, estancamiento, recuperación y finalización.

**Tech Stack:** Bun, TypeScript, bun:sqlite, WebBridge, Vite, vite-plugin-monkey, Tampermonkey.

## Global Constraints

- El userscript debe seguir siendo opcional.
- No persistir cookies, tokens, Authorization ni HTML completo.
- `estancada` informa, pero nunca cancela automáticamente.
- Reanudar solo hace polling y nunca reenvía el prompt.
- Mantener nombres técnicos y estados en español.
- TDD en cada tarea y commits pequeños.
- No tocar cambios locales ajenos de ChatGPT ni DeepSeek userscript.

---

### Task 1: Qwen Observer bridge v2
**Files:**
- Modify: `../tampermonkey-scripts/scripts/capi-qwen-observador/src/main.ts`
- Modify: `../tampermonkey-scripts/scripts.manifest.ts`
- Test: `../tampermonkey-scripts/tests/capi-qwen-observador.test.ts`

**Produces:** `window.__CAPI_QWEN_BRIDGE__` v2 with conversationId, turnId, state, timestamps, structural signature and debounced mutation counts.

- [ ] Write DOM fixture tests for latest assistant turn, stale old thought, regeneration, debounce and privacy.
- [ ] Run focused tests and verify failure.
- [ ] Implement bridge v2 using last visible assistant turn and 300 ms debounce.
- [ ] Build userscript and verify generated artifact syntax.
- [ ] Commit userscript v1.1.0.

### Task 2: CAPI bridge reader and observation fusion
**Files:**
- Create: `src/proveedores/qwen/navegador/LectorTelemetriaQwen.ts`
- Create: `src/proveedores/qwen/navegador/FusionadorObservacionesQwen.ts`
- Modify: `src/proveedores/qwen/navegador/QwenStreaming.ts`
- Modify: `src/nucleo/proveedores/ObservacionProveedor.ts`
- Test: `test/proveedores/qwen/telemetria-qwen.test.ts`

**Produces:** validated optional bridge v2 and deterministic fusion of DOM, Tampermonkey and snapshot signals.

- [ ] Write tests for absent, stale, incompatible and healthy bridge states.
- [ ] Run focused tests and verify failure.
- [ ] Implement reader with 45 s healthy and 90 s expiry thresholds.
- [ ] Implement fusion where Tampermonkey supplies activity only, never content.
- [ ] Integrate into QwenStreaming and commit.

### Task 3: Real progress and non-terminal stalling
**Files:**
- Create: `src/modulos/chat/aplicacion/DetectorProgresoProveedor.ts`
- Modify: `src/configuracion/ConfiguracionProveedores.ts`
- Modify: `src/proveedores/qwen/navegador/QwenStreaming.ts`
- Modify: `src/modulos/chat/aplicacion/SupervisorEjecucionChat.ts`
- Test: `test/chat/progreso-estancamiento.test.ts`

**Produces:** separate last poll and last real progress timestamps; slow and stalled states recover automatically.

- [ ] Write fake-clock tests for 10 min slow, 30 min stalled and resumed progress.
- [ ] Implement signature-based progress detector.
- [ ] Emit `estancado` without terminating polling.
- [ ] Ensure heartbeat updates only `ultimoSondeoEn`.
- [ ] Commit.

### Task 4: Lifecycle-safe cancellation and resumption
**Files:**
- Modify: `src/plataforma/persistencia/RepositorioEjecucionesChat.ts`
- Modify: `src/entradas/cli/comandos/tareas/cancelar.ts`
- Modify: `src/entradas/cli/comandos/tareas/reanudar.ts`
- Modify: `src/modulos/chat/aplicacion/SupervisorEjecucionChat.ts`
- Test: `test/chat/lifecycle-tareas.test.ts`

**Produces:** atomic cancellation, terminal-state rejection, ownership adoption and no duplicate observers.

- [ ] Write tests for terminal cancellation, response/cancel race and two adopters.
- [ ] Add atomic `adoptar` update with owner compare-and-swap.
- [ ] Restrict resumable states and reject live owners.
- [ ] Clear cancellation flag on successful completion.
- [ ] Commit.

### Task 5: SQLite-only background tasks and orphan recovery
**Files:**
- Create: `src/plataforma/procesos/IdentidadProceso.ts`
- Create: `src/modulos/chat/aplicacion/ReconciliadorEjecuciones.ts`
- Modify: `src/entradas/cli/comandos/chat/enviar.ts`
- Delete after migration: `src/entradas/cli/soporte/tareas.ts`
- Modify: task CLI commands
- Test: `test/chat/background-sqlite.test.ts`

**Produces:** background tasks created in SQLite before spawn; pid, host, boot identity and orphan reconciliation.

- [ ] Write tests for spawn envelope, dead PID, stale heartbeat and adoption.
- [ ] Extend schema with pid, host, bootId, mode and command JSON.
- [ ] Migrate legacy JSON tasks once and stop writing them.
- [ ] Reconcile stale owners to `reconectando`.
- [ ] Commit.

### Task 6: Atomic event sequencing, retention and compaction
**Files:**
- Modify: `src/plataforma/persistencia/MigradorContextoSqlite.ts`
- Modify: `src/plataforma/persistencia/RepositorioEjecucionesChat.ts`
- Create: `src/entradas/cli/comandos/tareas/limpiar.ts`
- Create: `src/entradas/cli/comandos/tareas/compactar.ts`
- Create: `src/entradas/cli/comandos/tareas/metricas.ts`
- Test: `test/chat/retencion-eventos.test.ts`

**Produces:** atomic sequence counters, indexes, retention policies and CLI maintenance.

- [ ] Write concurrency and 100k-event retention tests.
- [ ] Add `ultima_secuencia` and SQLite indexes.
- [ ] Replace `MAX()+1` with transaction-safe sequence increment.
- [ ] Implement compaction and retention commands.
- [ ] Commit.

### Task 7: Durable sanitized logs
**Files:**
- Create: `src/plataforma/logs/RegistroEjecucionJsonl.ts`
- Modify: `src/modulos/chat/aplicacion/SupervisorEjecucionChat.ts`
- Create: `src/entradas/cli/comandos/tareas/logs.ts`
- Test: `test/chat/logs-durables.test.ts`

**Produces:** rotating JSONL logs under user data directory without secrets or private content.

- [ ] Write sanitization, rotation and follow-mode tests.
- [ ] Implement 10 MB x 3 rotation.
- [ ] Integrate supervisor events.
- [ ] Add CLI logs command and commit.

### Task 8: Shared provider resilience and parity
**Files:**
- Create: `src/proveedores/compartido/SupervisorStreamingProveedor.ts`
- Modify: `src/proveedores/deepseek/navegador/DeepSeekStreaming.ts`
- Modify: `src/proveedores/chatgpt/navegador/ChatGPTPaginaChat.ts`
- Test: `test/proveedores/paridad-recuperacion.test.ts`

**Produces:** common heartbeat, recovery and stalled-state behavior for Qwen, DeepSeek and ChatGPT.

- [ ] Write provider contract tests for disconnect, recovery, stalling and completion.
- [ ] Extract common policy without moving provider-specific DOM logic.
- [ ] Integrate DeepSeek and ChatGPT.
- [ ] Commit.

### Task 9: Diagnostics and chaos suite
**Files:**
- Modify: `src/entradas/cli/comandos/diagnostico/ejecucion.ts`
- Modify: `src/entradas/cli/comandos/diagnostico/red.ts`
- Create: `test/caos/supervisor-durable.test.ts`
- Create: `scripts/smoke-recuperacion.ts`

**Produces:** explicit diagnostics for bridge health, owner, lease, progress and network; deterministic chaos tests.

- [ ] Add invalid network action validation tests.
- [ ] Add chaos scenarios for closed tab, frozen bridge, killed owner, dual adoption and late response.
- [ ] Add recovery smoke report.
- [ ] Commit.

### Task 10: Final documentation and verification
**Files:**
- Modify: `docs/operacion/supervisor-durable.md`
- Create: `docs/operacion/actualizar-qwen-observer.md`

- [ ] Document upgrade from userscript 1.0.1 to 1.1.0.
- [ ] Run userscript typecheck, all tests and build.
- [ ] Run CAPI `bun run verify`, contracts and focused real WebBridge checks.
- [ ] Review diffs for secrets and unrelated changes.
- [ ] Merge both worktrees by fast-forward without push.
