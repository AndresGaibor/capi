# CAPI

CLI modular para interactuar con proveedores de chat mediante WebBridge.

## Arquitectura

- `src/nucleo`: contratos, eventos, capacidades y errores neutrales.
- `src/modulos`: casos de uso independientes del proveedor.
- `src/proveedores`: integraciones específicas de Qwen y DeepSeek.
- `src/plataforma`: transporte WebBridge, consola y persistencia.
- `src/entradas`: CLI y composition root.

## Comandos

```bash
bun run src/cli.ts chat enviar -p qwen -m plus "Hola"
bun run src/cli.ts modelos listar -p qwen
bun run src/cli.ts conversaciones listar -p deepseek
bun run src/cli.ts conversaciones mensajes -p deepseek <id>
bun run src/cli.ts sesion importar -p deepseek
bun run src/cli.ts diagnostico pagina -p deepseek
bun run src/cli.ts servidor iniciar
```

## Validación

```bash
bun run check
bun run smoke:qwen
bun run smoke:deepseek
```

WebBridge debe estar activo en `http://127.0.0.1:10086` y el navegador debe tener sesión iniciada en el proveedor correspondiente.
