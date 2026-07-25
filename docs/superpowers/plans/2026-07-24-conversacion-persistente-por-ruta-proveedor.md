# Conversación persistente por ruta y proveedor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reutilizar indefinidamente una conversación principal por proyecto local y proveedor, salvo que `--nueva` cree y promueva una nueva.

**Architecture:** SQLite será la fuente de verdad para seleccionar conversaciones. La CLI solo tratará `--conversacion` como selección explícita; el estado casual del navegador no participará. Tras una creación forzada, el ID final se registrará y marcará como principal para `proyecto_local_id + proveedor`.

**Tech Stack:** Bun, TypeScript, bun:test, bun:sqlite, Kimi WebBridge.

## Global Constraints

- Respetar todos los `AGENTS.md` del repositorio.
- Aplicar TDD: prueba roja, implementación mínima y prueba verde.
- No inventar flags; usar `discover` y `schema` antes de smokes reales.
- Usar JSON/JSONL y `--dry-run` para verificaciones automatizables.
- No exponer cookies, tokens ni secretos.
- Qwen y DeepSeek deben mantener conversaciones principales independientes.
- `--conversacion` no cambia la conversación principal.
- `--nueva` sí reemplaza la conversación principal.

---

## Mapa de archivos

- Modify: `src/entradas/cli/comandos/chat/enviar.ts` — resolver selección sin depender del navegador.
- Modify: `src/modulos/chat/aplicacion/EnviarMensajeConContexto.ts` — promover el ID final cuando la petición fuerza una conversación nueva.
- Modify: `src/modulos/chat/aplicacion/RegistroChatHistorial.ts` — registrar y promover atómicamente la conversación creada.
- Modify: `src/plataforma/persistencia/RepositorioConversaciones.ts` — operación explícita para marcar una conversación como principal.
- Modify: `src/plataforma/persistencia/RepositorioContextoSqlite.ts` — exponer la operación del repositorio.
- Test: `test/conversaciones/seleccion.test.ts`.
- Test: `test/conversaciones/repositorio-contexto.test.ts`.
- Test: `test/entradas/cli.test.ts` o prueba enfocada nueva en `test/entradas/`.
- Test: `test/chat/registro-historial.test.ts`.

### Task 1: Persistencia de conversación principal

**Interfaces:**
- Produce: `marcarPrincipal(id: string, proveedor: string, proyectoLocalId: string): void`.
- Garantiza: solo una fila principal por proyecto y proveedor.

- [ ] Añadir en `test/conversaciones/repositorio-contexto.test.ts` una prueba que registre dos conversaciones del mismo proyecto/proveedor, marque la segunda y verifique `principal=false/true` respectivamente.
- [ ] Ejecutar `bun test test/conversaciones/repositorio-contexto.test.ts`; debe fallar porque la operación no existe.
- [ ] Implementar `RepositorioConversaciones.marcarPrincipal` dentro de una transacción: limpiar `principal` por proyecto/proveedor y activar la fila objetivo.
- [ ] Exponer `marcarConversacionPrincipal` desde `RepositorioContextoSqlite`.
- [ ] Ejecutar la prueba enfocada y luego `bun test test/conversaciones/seleccion.test.ts test/conversaciones/repositorio-contexto.test.ts`.
- [ ] Commit: `feat: persistir conversación principal por proveedor`.

### Task 2: Promoción después de `--nueva`

**Interfaces:**
- Consume: `marcarConversacionPrincipal`.
- Produce: `registrarConversacionYAdjuntos(..., hacerPrincipal?: boolean)`.

- [ ] Añadir en `test/chat/registro-historial.test.ts` una prueba donde `hacerPrincipal=true` registre el ID final y lo promueva.
- [ ] Ejecutar la prueba y confirmar el fallo por firma/comportamiento ausente.
- [ ] Extender `RegistroChatHistorial.registrarConversacionYAdjuntos` con `hacerPrincipal` y llamar a la operación tras registrar la conversación.
- [ ] En `EnviarMensajeConContexto`, pasar `hacerPrincipal: peticion.forzarNueva === true` únicamente cuando exista `conversacionFinal`.
- [ ] Ejecutar pruebas enfocadas y confirmar que una selección explícita normal no promueve nada.
- [ ] Commit: `feat: promover chat creado con nueva`.

### Task 3: Eliminar el navegador como fuente de selección

**Interfaces:**
- La CLI resuelve: `--conversacion` explícita o conversación persistida.
- `--continuar` reutiliza la persistida cuando no recibe ID.

- [ ] Añadir una prueba de CLI con proveedor falso cuyo `obtenerConversacionActual()` devuelva otro ID; verificar que sin `--conversacion` se elige el ID persistido.
- [ ] Añadir una prueba donde `--continuar` sin ID usa la conversación persistida.
- [ ] Ejecutar las pruebas y confirmar que fallan porque `ejecutarChat` consulta primero el navegador.
- [ ] Eliminar de `ejecutarChat` la lectura automática de `obtenerConversacionActual()`.
- [ ] Resolver `conversacionId` desde `app.gestorContexto.seleccionar(proveedor, explícita)` y usar esa selección para envío y `--continuar`.
- [ ] Mantener `--nueva` sin ID y `--conversacion` como prioridad explícita.
- [ ] Ejecutar pruebas de CLI y conversaciones.
- [ ] Commit: `fix: seleccionar conversación desde persistencia local`.

### Task 4: Regresión completa y smokes WebBridge

**Interfaces:**
- Consume: CLI final y persistencia SQLite.
- Produce: evidencia de reutilización real en Qwen y DeepSeek.

- [ ] Ejecutar `bun run typecheck` y `bun test`.
- [ ] Ejecutar `bun run src/cli.ts discover --output json` y `bun run src/cli.ts schema chat.send --output json`.
- [ ] Ejecutar `--dry-run` dos veces por proveedor desde `~/code/javascript/capi`; verificar el mismo ID y motivo persistente.
- [ ] Comprobar `~/.kimi-webbridge/bin/kimi-webbridge status`; arrancarlo si `10086` rechaza conexión.
- [ ] Para Qwen, enviar un mensaje identificador con `--nueva --output jsonl`, capturar el evento/ID final y enviar otro mensaje sin `--nueva`; verificar la misma URL `/c/<id>` y contexto conversacional.
- [ ] Para DeepSeek, repetir con un chat nuevo y verificar la misma URL `/a/chat/s/<id>` en el segundo envío.
- [ ] Usar una sesión WebBridge única para esta tarea; priorizar `snapshot`, y envolver cualquier `evaluate` manual en IIFE.
- [ ] Ejecutar `bun run verify`.
- [ ] Documentar cualquier limitación externa real sin ocultarla.
- [ ] Commit: `test: validar reutilización real de conversaciones`.

## Criterios de aceptación

1. Dos mensajes consecutivos desde la misma ruta y proveedor usan el mismo ID.
2. Cambiar de proveedor usa un ID independiente.
3. `--nueva` crea otro ID y lo convierte en el siguiente reutilizable.
4. `--conversacion` usa el ID indicado sin reemplazar el principal.
5. Un chat distinto abierto manualmente en el navegador no afecta la selección.
6. `--continuar` funciona con la conversación persistida.
7. Typecheck, pruebas unitarias y verificación completa pasan.
