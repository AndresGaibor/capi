# Endurecimiento integral de proveedores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que Qwen y DeepSeek se recuperen, continúen y diagnostiquen de forma segura y verificable.

**Architecture:** Añadir servicios puros para salud, checkpoint, idempotencia y fusión; integrar en el caso de uso y proveedores; exponer diagnóstico y smokes sin filtrar datos privados.

**Tech Stack:** Bun, TypeScript, SQLite, JSDOM, WebBridge.

## Global Constraints

- Un solo reintento automático.
- `--continuar` nunca reenvía el prompt.
- No bajar cobertura del 80%.
- No registrar secretos ni contenido privado.

---

### Task 1: Salud de conversaciones y recuperación

- [ ] Crear pruebas de estados y exclusión de principales inválidos.
- [ ] Añadir persistencia de estado, motivo y fecha.
- [ ] Implementar recuperación única ante `CONVERSACION_INVALIDA`.
- [ ] Verificar que el segundo fallo se propaga sin tercer envío.
- [ ] Commit.

### Task 2: Idempotencia de envío

- [ ] Crear pruebas para click exitoso seguido de fallback Enter.
- [ ] Añadir señales de envío iniciado y huella de ejecución.
- [ ] Ejecutar Enter solo cuando ninguna señal confirme envío.
- [ ] Commit.

### Task 3: Checkpoints y continuar

- [ ] Crear pruebas de checkpoint pausado y continuación sin enviar.
- [ ] Persistir checkpoint por proyecto/proveedor/conversación.
- [ ] Reanudar streaming desde respuesta acumulada.
- [ ] Corregir mensajes y motivos de pausa.
- [ ] Commit.

### Task 4: Fusión multifuente

- [ ] Crear tabla de casos incrementales, acumulativos, solapados y UTF-8.
- [ ] Implementar `fusionarRespuesta` pura con fuente, confianza y terminado.
- [ ] Integrar DeepSeek SSE, API, IndexedDB y DOM.
- [ ] Commit.

### Task 5: Preflight y diagnóstico

- [ ] Crear fixtures de sesión, captcha, modal e invalidez.
- [ ] Implementar errores tipados y preflight por proveedor.
- [ ] Añadir `capi diagnostico pagina --proveedor ... --output json`.
- [ ] Añadir sanitización de fixture DOM.
- [ ] Commit.

### Task 6: Smokes deterministas

- [ ] Unificar runner de smoke con marcador único y JSON.
- [ ] Añadir texto, continuidad, archivo e imagen.
- [ ] Aislar proyecto y archivar conversación de prueba.
- [ ] Commit.

### Task 7: Refactor de módulos

- [ ] Extraer entrada, control de envío y adjuntos de Qwen.
- [ ] Extraer persistencia de salud y checkpoints.
- [ ] Mantener contratos y ejecutar suite tras cada extracción.
- [ ] Commit.

### Task 8: Cobertura y cierre

- [ ] Ejecutar cobertura y localizar módulos no cubiertos.
- [ ] Añadir pruebas de transiciones críticas hasta >=80%.
- [ ] Ejecutar typecheck, suite, contratos, smokes y `bun run verify`.
- [ ] Documentar comandos y resultados.
- [ ] Commit y merge en main.