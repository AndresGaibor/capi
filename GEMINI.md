# GEMINI.md — Directrices del Proyecto CAPI

Este archivo define las reglas de codificación, las convenciones del entorno de ejecución Bun y los flujos de trabajo para Antigravity y Gemini CLI.

## ⚡ Reglas Principales de Bun

- **Ejecución**: Usar siempre `bun <file>` en lugar de `node` o `ts-node`.
- **Testing**: Usar `bun test` en lugar de Jest o Vitest.
- **Gestión de paquetes**: Usar `bun install` o `bun add`.
- **Built-in APIs**:
  - `Bun.serve()` para servidores HTTP/WebSockets.
  - `Bun.file()` en lugar de `node:fs` `readFile`/`writeFile` cuando sea posible.
  - Carga automática de variables de entorno desde `.env`.

## 📦 Estructura del Código

- **Clean Architecture & Hexagonal**: Mantener clara separación entre Dominio, Casos de Uso, Puertos y Adaptadores.
- **TypeScript**: Estricto (no `any` implícitos). Verificar siempre tipos con `bunx tsc --noEmit`.
- **Nombres en Español**: Las clases de dominio y adaptadores mantienen la nomenclatura descriptiva en español (ej. `ServicioChatDeepSeek`, `AdaptadorKimiWebBridge`, `EnviarMensajeStreaming`).

## 🧪 Pruebas Automatizadas

Cualquier cambio en la lógica de dominio o servicios debe incluir su correspondiente test en la carpeta `test/`:
- Formato del nombre: `test/<modulo>.test.ts`.
- Ejecución rápida: `bun test`.
