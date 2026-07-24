# Operación local avanzada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Completar CAPI con optimización persistente de contexto, mantenimiento operativo, portabilidad, cancelación y protección opcional del estado local.

**Architecture:** Mantener selección, compactación, cifrado y portabilidad en módulos neutrales; concentrar SQLite y filesystem en plataforma; exponer todo por CLI estructurada y MCP sin duplicar reglas. Las mejoras deben degradar de forma segura y conservar compatibilidad con datos existentes.

**Tech Stack:** Bun, TypeScript, bun:sqlite, Web Crypto, Citty, MCP SDK.

## Global Constraints

- Trabajar directamente en `main`.
- Nombres de dominio y contratos en español.
- Ningún secreto se imprime ni se exporta.
- Cifrado opcional mediante `CAPI_LOCAL_ENCRYPTION_KEY`.
- Suite determinista y cobertura modular mínima de 80%.

---

### Task 1: Ranking local y presupuesto por tokens
- [x] Añadir ranking léxico determinista de archivos respecto al prompt.
- [x] Resolver límites desde metadatos reales del proveedor cuando existan y usar fallback conservador.
- [x] Añadir pruebas de ranking y presupuesto.

### Task 2: Compactación y cifrado local
- [x] Compactar resúmenes por bloques conservando decisiones, errores y archivos.
- [x] Añadir cifrado AES-GCM opcional con versión de formato.
- [x] Migrar lectura/escritura sin romper resúmenes en texto plano.

### Task 3: Caché, métricas y limpieza
- [x] Registrar hashes de adjuntos confirmados por conversación/proveedor.
- [x] Exponer métricas agregadas por proyecto, proveedor y modelo.
- [x] Añadir limpieza selectiva de caché, snapshots, historial y resúmenes.

### Task 4: Cancelación y contratos periódicos
- [x] Añadir timeout/cancelación cooperativa al chat.
- [x] Liberar leases y finalizar historial como cancelado.
- [x] Añadir comando de pruebas contractuales con salida machine-readable.

### Task 5: Exportación e importación
- [x] Exportar un proyecto a JSON versionado sin tokens ni sesiones.
- [x] Importar con merge idempotente y validación estricta.
- [x] Exponer CLI y MCP.

### Task 6: Documentación y cierre
- [x] Actualizar README, guía de agentes, manifiesto y skill.
- [x] Ejecutar verify, MCP, comandos locales, diff-check y commit.
