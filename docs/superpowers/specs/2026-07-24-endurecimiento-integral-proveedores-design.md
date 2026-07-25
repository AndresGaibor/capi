# Endurecimiento integral de proveedores

## Objetivo

Completar el endurecimiento operativo de CAPI para Qwen y DeepSeek: recuperación automática, idempotencia, continuación persistida, fusión multifuente, preflight, diagnóstico seguro, smokes deterministas, refactor de módulos y cobertura mínima real del 80%.

## Ciclos

1. Recuperación e idempotencia.
2. Continuación y streaming.
3. Preflight y diagnóstico.
4. Smokes y fixtures anonimizados.
5. Refactor técnico.
6. Cobertura y cierre.

## Recuperación e idempotencia

Una conversación remota eliminada o inexistente se marcará localmente como inválida, dejará de ser principal y provocará un único reintento automático en un chat nuevo con el mismo prompt. El reintento llevará una huella por ejecución y nunca podrá superar uno.

Antes de usar Enter como fallback se comprobará si el mensaje ya apareció, cambió la URL, se vació la entrada, apareció Stop o comenzó una petición de completion.

## Salud de conversaciones

Las conversaciones persistidas tendrán estado `activa`, `invalida`, `eliminada_remotamente`, `requiere_autenticacion` o `archivada`. Solo `activa` podrá seleccionarse como principal. Los estados inválidos conservarán diagnóstico y fecha, sin eliminar historial local.

## Continuación y streaming

Los checkpoints persistirán proveedor, conversación, motivo, pensamiento, respuesta acumulada, marcas temporales y estado. `--continuar` observará el chat existente sin reenviar. La fusión de fuentes usará prioridad de terminación y solapamiento seguro entre SSE, API, IndexedDB y DOM. Ninguna fuente más corta reemplazará contenido válido más largo.

## Preflight y errores tipados

Antes de enviar se evaluarán host, entrada utilizable, sesión, captcha, modal bloqueante, redirección e invalidez de conversación. Los códigos serán `SESION_EXPIRADA`, `CAPTCHA_REQUERIDO`, `CONVERSACION_INVALIDA`, `PAGINA_NO_COMPATIBLE`, `SELECTOR_NO_ENCONTRADO` y `PROVEEDOR_OCUPADO`.

## Diagnóstico seguro

Se añadirá un comando de diagnóstico por proveedor que informe estrategia usada, candidatos, señales de estado y URL. No incluirá HTML completo, prompts, respuestas, cookies, tokens ni identificadores sensibles. Se añadirá captura de fixture anonimizado conservando solo estructura, roles, atributos accesibles y clases relevantes.

## Smokes

Los smokes usarán marcadores únicos, salida JSON, timeout, proyecto temporal y limpieza o archivado posterior. Cubrirán texto, continuidad, archivo e imagen cuando el proveedor lo soporte.

## Refactor

`QwenEnvio` se dividirá por entrada, control de envío y adjuntos. La persistencia de salud/checkpoints quedará separada de la selección. No se cambiarán contratos públicos salvo nuevas capacidades opcionales.

## Cobertura

El umbral seguirá en 80%. Se cubrirán transiciones y errores reales, no líneas artificiales. `bun run verify` deberá terminar con código 0.

## Criterios de aceptación

- Reintento automático único ante conversación eliminada.
- Ningún doble envío por fallback.
- `--continuar` no reenvía.
- DeepSeek no concatena respuestas completas ni rompe UTF-8.
- Preflight y diagnóstico entregan códigos accionables.
- Smokes deterministas y fixtures anonimizados disponibles.
- Módulos críticos reducen responsabilidades.
- `bun run verify` pasa con cobertura >= 80%.