# CAPI — instrucciones para agentes

CAPI permite consultar Qwen y DeepSeek desde agentes de código sin controlar manualmente el navegador.

## Inicio rápido

1. Ejecuta `bun run src/cli.ts discover --output json` para descubrir capacidades.
2. Consulta `bun run src/cli.ts schema chat.send --output json` antes de construir una llamada nueva.
3. Usa `--output jsonl` para chat con streaming y `--output json` para operaciones no streaming.
4. Usa `--dry-run` antes de una operación cuando necesites comprobar proveedor, modelo y conversación sin efectos.
5. No analices texto ANSI cuando exista salida JSON/JSONL.

## Uso recomendado

```bash
bun run src/cli.ts chat --output jsonl "Analiza este cambio"
bun run src/cli.ts chat -p qwen -m preview --output jsonl "Investiga este problema"
bun run src/cli.ts proyecto actual --output json
bun run src/cli.ts conversaciones proyecto --output json
bun run src/cli.ts doctor --output json
```

CAPI detecta la raíz Git, reutiliza contexto libre, limita concurrencia, registra conversaciones y recupera fallos transitorios. En DeepSeek, degradar de `expert` o `vision` a `default` siempre crea un chat nuevo.

## Reglas operativas

- No abras ni manipules directamente Qwen/DeepSeek si CAPI puede realizar la acción.
- No inventes flags: usa `discover` y `schema`.
- Conserva `requestId` para correlacionar eventos y errores.
- Ante un error con `retryable: true`, sigue `suggestions` o deja actuar al fallback automático.
- Usa `--fallback=false` solo cuando el modelo exacto sea un requisito estricto.
- No incluyas secretos, cookies o tokens en prompts ni logs.

## Validación del repositorio

```bash
bun run verify
bun run smoke:qwen
bun run smoke:deepseek
```

La skill portable está en `.agents/skills/capi/SKILL.md`. La integración MCP se inicia con `bun run mcp`.
