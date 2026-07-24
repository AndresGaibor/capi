# Contexto inteligente completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Convertir CAPI en un sistema de contexto incremental, explicable y auditable, con selección automática de archivos, presupuestos por proveedor/modelo, resúmenes persistentes, historial de ejecuciones, estrategias de adjuntos y contratos de navegador.

**Architecture:** Mantener la lógica neutral en `src/modulos`, persistir estado local en SQLite y conservar DOM/CDP dentro de proveedores. El caso de uso de chat preparará un `PlanContexto`, lo empaquetará, registrará metadatos y actualizará snapshots solo después de una respuesta exitosa.

**Tech Stack:** Bun, TypeScript, bun:sqlite, Citty, MCP SDK, WebBridge/CDP.

## Global Constraints

- Trabajar directamente en `main`, autorizado por el usuario.
- Nombres de dominio, tablas, columnas, estados y mensajes en español.
- Ningún selector DOM ni `fetch` dentro de `src/modulos`.
- Ningún SQL fuera de `src/plataforma/persistencia`.
- Toda funcionalidad nueva debe tener pruebas deterministas y mantener cobertura modular >= 80%.
- Los smokes reales deben tener timeout y no formar parte de la suite determinista.

---

### Task 1: Presupuestos y selección automática

**Files:**
- Create: `src/modulos/contexto/aplicacion/ResolverPresupuestoContexto.ts`
- Create: `src/modulos/contexto/aplicacion/SeleccionarContextoAutomatico.ts`
- Test: `test/contexto/presupuesto-y-auto.test.ts`

**Interfaces:**
- Produces: `resolverPresupuestoContexto(proveedor, modelo, solicitado?)` y `seleccionarContextoAutomatico(cwd)`.

- [x] Escribir pruebas para presupuestos conservadores y archivos Git/imports/tests relacionados.
- [x] Ejecutar `bun test test/contexto/presupuesto-y-auto.test.ts` y confirmar fallo.
- [x] Implementar resolución de presupuesto y selección automática determinista.
- [x] Ejecutar la prueba y confirmar éxito.

### Task 2: Contexto incremental, manifiesto y explicación

**Files:**
- Modify: `src/modulos/contexto/aplicacion/EmpaquetadorContexto.ts`
- Create: `src/modulos/contexto/aplicacion/ExplicarContexto.ts`
- Modify: `src/plataforma/persistencia/RepositorioContextoSqlite.ts`
- Test: `test/contexto/incremental-y-explicacion.test.ts`

**Interfaces:**
- Produces: hashes por archivo, decisiones de inclusión y snapshots por proyecto/proveedor/conversación.

- [x] Escribir pruebas para detectar archivos sin cambios, explicar inclusiones y guardar snapshots.
- [x] Ejecutar pruebas y confirmar fallo.
- [x] Añadir tablas y métodos idempotentes para snapshots.
- [x] Extender el paquete con manifiesto estructurado y explicación.
- [x] Ejecutar pruebas y confirmar éxito.

### Task 3: Historial, resúmenes y metadatos de ejecución

**Files:**
- Modify: `src/plataforma/persistencia/RepositorioContextoSqlite.ts`
- Create: `src/modulos/historial/aplicacion/ConsultarHistorialProyecto.ts`
- Test: `test/historial/ejecuciones-y-resumenes.test.ts`

**Interfaces:**
- Produces: inicio/finalización de ejecución, resumen acumulativo y consulta por proyecto.

- [x] Escribir pruebas para éxito, error, rama, commit, contexto y resumen.
- [x] Ejecutar pruebas y confirmar fallo.
- [x] Añadir migraciones y repositorio.
- [x] Implementar caso de consulta y confirmar pruebas.

### Task 4: Orquestación incremental en chat

**Files:**
- Modify: `src/nucleo/chat/PeticionChat.ts`
- Modify: `src/modulos/chat/aplicacion/EnviarMensajeConContexto.ts`
- Modify: `src/entradas/cli/comandos/chat/enviar.ts`
- Modify: `src/entradas/mcp/servidor.ts`
- Test: `test/conversaciones/contexto-inteligente-chat.test.ts`

**Interfaces:**
- Consumes: presupuesto, selección automática, snapshots e historial.
- Produces: flags `--contexto-auto`, `--incremental` y metadatos estructurados.

- [x] Escribir pruebas de integración del caso de uso.
- [x] Ejecutarlas y confirmar fallo.
- [x] Integrar preparación, snapshots posteriores al éxito y registro en `finally`.
- [x] Exponer CLI/MCP y confirmar pruebas.

### Task 5: Estrategias intercambiables de adjuntos

**Files:**
- Create: `src/nucleo/archivos/EstrategiaAdjuntos.ts`
- Modify: `src/proveedores/qwen/navegador/QwenEnvio.ts`
- Modify: `src/proveedores/deepseek/navegador/DeepSeekEnvio.ts`
- Test: `test/proveedores/estrategias-adjuntos.test.ts`

**Interfaces:**
- Produces: `EstrategiaAdjuntos.adjuntar(rutas)` y resultado con estrategia usada.

- [x] Escribir pruebas de estrategias DOM y CDP.
- [x] Ejecutar y confirmar fallo.
- [x] Extraer estrategias sin mover lógica de proveedor a módulos.
- [x] Ejecutar y confirmar éxito.

### Task 6: Gestor conservador de pestañas

**Files:**
- Create: `src/plataforma/webbridge/GestorPestanas.ts`
- Test: `test/plataforma/gestor-pestanas.test.ts`

**Interfaces:**
- Produces: inventario mediante CDP, selección de pestaña compatible y rechazo seguro al superar límites.

- [x] Escribir pruebas con transporte falso para inventario, reutilización y límite.
- [x] Ejecutar y confirmar fallo.
- [x] Implementar política conservadora; nunca cerrar una pestaña activa a ciegas.
- [x] Ejecutar y confirmar éxito.

### Task 7: Comandos de explicación, historial y contratos

**Files:**
- Create: `src/entradas/cli/comandos/contexto/explicar.ts`
- Create: `src/entradas/cli/comandos/historial/listar.ts`
- Create: `src/modulos/diagnostico/aplicacion/VerificarContratosProveedor.ts`
- Modify: `src/entradas/cli/cli.ts`
- Modify: `src/entradas/cli/agente/ManifestAgente.ts`
- Modify: `src/entradas/mcp/servidor.ts`
- Test: `test/agente/contexto-historial-contratos.test.ts`

**Interfaces:**
- Produces: `capi contexto explicar`, `capi historial listar`, `capi diagnostico contratos` y herramientas MCP equivalentes.

- [x] Escribir pruebas CLI/manifest/MCP.
- [x] Ejecutar y confirmar fallo.
- [x] Implementar comandos y contratos sin exponer secretos.
- [x] Ejecutar y confirmar éxito.

### Task 8: Documentación, verificación y commit

**Files:**
- Modify: `README.md`
- Modify: `docs/agentes/integracion.md`
- Modify: `.agents/skills/capi/SKILL.md`

- [x] Documentar contexto auto, incremental, historial, explicación y límites.
- [x] Ejecutar `bun run verify` y confirmar 0 fallos.
- [x] Ejecutar smokes con timeout: MCP y DeepSeek pasan; Qwen valida carga y fallback, pero el servicio externo terminó sin contenido en max/plus.
- [x] Ejecutar `git diff --check` y revisar `git status --short`.
- [x] Crear commit final con autor configurado del repositorio.
