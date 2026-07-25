# Validación Durable de Proveedores Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Validar y automatizar recuperación, background, cancelación, pestañas y telemetría para Qwen, DeepSeek y ChatGPT sin reenviar prompts.

**Architecture:** Los smokes usarán la CLI pública y el repositorio durable SQLite como fuente de verdad. Cada proveedor conservará recuperación por conversación y DOM semántico; Qwen añadirá telemetría del DOM real y comparación A/B. Las pruebas reales producirán reportes JSON saneados.

**Tech Stack:** Bun, TypeScript, WebBridge, SQLite, Tampermonkey, Bun test.

## Global Constraints

- Trabajar directamente sobre `main` por autorización explícita del usuario.
- No incluir los cambios locales pendientes de ChatGPT en commits ajenos.
- No reenviar prompts durante reanudación o recuperación.
- No persistir prompts, cookies, tokens ni HTML privado en logs.

---

### Task 1: Background real y seguimiento durable
- [ ] Ejecutar Qwen en background y verificar UUID, respuesta y modo background.
- [ ] Corregir lifecycle si el proceso hijo no completa o no persiste correctamente.
- [ ] Añadir smoke automatizado y prueba determinista.

### Task 2: Muerte del proceso y reanudación
- [ ] Iniciar respuesta larga, matar PID propietario y reconciliar.
- [ ] Reanudar solo polling y confirmar un único prompt.
- [ ] Automatizar el escenario sin depender de tiempos arbitrarios.

### Task 3: Recuperación de pestaña y cancelación
- [ ] Cerrar la pestaña durante streaming y recuperar por UUID.
- [ ] Cancelar una ejecución activa y validar estados terminales.
- [ ] Añadir smokes y pruebas de no duplicación.

### Task 4: Telemetría Qwen real
- [ ] Actualizar observer con selectores reales, turnoId y comparación A/B.
- [ ] Conectar lectura a la pestaña controlada cuando el bridge exista.
- [ ] Mantener DOM como fallback cuando Tampermonkey no esté instalado.

### Task 5: Suite operativa
- [ ] Crear `smoke:qwen:durable`, `smoke:qwen:recuperacion`, `smoke:qwen:background` y `smoke:qwen:cancelacion`.
- [ ] Repetir contratos equivalentes en DeepSeek y ChatGPT.
- [ ] Ejecutar `bun run verify`, pruebas reales, commit y push.
