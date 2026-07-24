# Reestructuración CAPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reestructurar CAPI como monolito modular con núcleo neutral, proveedores intercambiables, WebBridge como transporte inicial, CLI nueva y eliminación del legado.

**Architecture:** El núcleo define tipos, errores, capacidades y puertos neutrales. Los módulos contienen casos de uso independientes; los proveedores encapsulan detalles de Qwen y DeepSeek; plataforma implementa WebBridge, consola y persistencia; entradas contiene la CLI y el composition root.

**Tech Stack:** Bun, TypeScript, Citty, WebBridge local, Bun test.

## Global Constraints
- Se permite romper compatibilidad con la CLI actual.
- WebBridge es el transporte inicial, pero los casos de uso no deben depender de él.
- El código legado se elimina cuando su reemplazo tiene pruebas y smoke equivalente.
- Ningún caso de uso contiene CSS, scripts DOM o llamadas fetch directas.
- Los errores se lanzan como excepciones tipadas, no como eventos `error`.
- Los nombres de módulos, tipos y archivos nuevos se mantienen en español.

---

### Task 1: Núcleo neutral y registro de proveedores
- [x] Crear tipos de petición, eventos, capacidades, errores y puertos.
- [x] Crear `RegistroProveedores` con pruebas unitarias.
- [x] Verificar typecheck y tests.

### Task 2: Plataforma WebBridge y salida CLI
- [x] Extraer cliente WebBridge neutral y transporte navegador.
- [x] Crear renderizador de streaming y mapeo de errores CLI.
- [x] Añadir pruebas de errores y disponibilidad.

### Task 3: Proveedor Qwen
- [x] Separar navegación, selector de modelo, emisor de prompt, extractor de streaming y política A/B.
- [x] Implementar `ProveedorQwen` sobre los puertos neutrales.
- [x] Añadir fixtures y pruebas de aliases, A/B, respuesta vacía y selección de modelo.
- [x] Ejecutar smoke real de Qwen.

### Task 4: Proveedor DeepSeek
- [x] Migrar sesión, navegación, envío, streaming, conversaciones y mensajes.
- [x] Implementar `ProveedorDeepSeek` sobre los puertos neutrales.
- [x] Adaptar pruebas existentes y ejecutar smoke real.

### Task 5: Módulos y composition root
- [x] Crear casos de uso neutrales para chat, modelos, conversaciones, sesión y diagnóstico.
- [x] Crear registro/composición de proveedores y dependencias.
- [x] Añadir pruebas de capacidades y selección de proveedor.

### Task 6: CLI nueva
- [x] Crear comandos `chat enviar`, `modelos listar`, `conversaciones listar`, `conversaciones mensajes`, `sesion importar`, `diagnostico pagina`, `servidor iniciar`.
- [x] Eliminar condicionales por proveedor de la capa CLI.
- [x] Verificar ayuda, códigos de salida y streaming.

### Task 7: Eliminación del legado y reglas arquitectónicas
- [x] Eliminar comandos, DI, servicios y scripts experimentales reemplazados.
- [x] Añadir prueba/regla de imports entre capas.
- [x] Actualizar README y scripts package.json.
- [x] Ejecutar typecheck, tests, lint arquitectónico y smokes finales.
