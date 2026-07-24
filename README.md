# CAPI

CLI modular para interactuar con Qwen y DeepSeek mediante WebBridge local.

## Arquitectura

```text
src/
  nucleo/       contratos, eventos, capacidades y errores neutrales
  modulos/      casos de uso independientes del proveedor
  proveedores/  integraciones de Qwen y DeepSeek
  plataforma/   WebBridge, consola y persistencia
  entradas/     CLI y composition root
```

Los casos de uso no conocen selectores DOM, WebBridge ni proveedores concretos. Cada proveedor encapsula navegación, modelos, envío y streaming. DeepSeek también implementa sesión, conversaciones y mensajes, con respaldo de IndexedDB cuando el DOM no expone la respuesta.

## Requisitos

- Bun.
- WebBridge activo en `http://127.0.0.1:10086`.
- Sesión iniciada en el proveedor que se utilizará.

## Comandos

```bash
bun run src/cli.ts chat enviar -p qwen -m plus "Hola"
bun run src/cli.ts chat enviar -p deepseek -m default "Hola"
bun run src/cli.ts modelos listar -p qwen
bun run src/cli.ts conversaciones listar -p deepseek
bun run src/cli.ts conversaciones mensajes -p deepseek <id>
bun run src/cli.ts sesion importar -p deepseek
bun run src/cli.ts diagnostico pagina -p deepseek
bun run src/cli.ts servidor iniciar
```

## Modelos

Qwen acepta los aliases `plus`, `max` y `preview`. DeepSeek acepta `default`, `expert` y `vision`.

## Validación

```bash
bun run typecheck
bun test
bun run coverage
bun run verify
bun run smoke:qwen
bun run smoke:deepseek
```

`bun run verify` ejecuta TypeScript, toda la suite y una puerta mínima de 80% de cobertura de líneas para las capas modulares. Los smokes requieren WebBridge y comprueban el recorrido real prompt → respuesta → fin.

## Pruebas

La suite cubre contratos, casos de uso, composición, CLI, reglas arquitectónicas, navegación, selección de modelos, envío, streaming, errores, fixtures DOM, respuestas A/B, respuesta vacía y respaldo IndexedDB.

## Reglas arquitectónicas

- `nucleo` no depende de capas externas.
- `modulos` no contiene DOM ni `fetch`.
- Los proveedores no importan DI ni otros proveedores.
- Los proveedores no usan `fetch` directamente.
- Los errores de proveedor se expresan mediante excepciones tipadas.
