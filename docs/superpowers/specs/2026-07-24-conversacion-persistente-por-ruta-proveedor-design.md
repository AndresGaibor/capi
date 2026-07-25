# Conversación persistente por ruta y proveedor

## Objetivo

CAPI debe reutilizar indefinidamente una única conversación activa por combinación `proyecto_local_id + proveedor`.

Una conversación nueva solo se crea cuando no existe ninguna registrada para esa combinación o cuando el usuario usa explícitamente `--nueva`.

## Regla funcional principal

Orden de prioridad para seleccionar conversación:

1. `--nueva`: no reutiliza ninguna conversación y crea una nueva.
2. `--conversacion ID_O_URL`: usa exactamente la conversación indicada.
3. Conversación principal persistida para `proyecto_local_id + proveedor`.
4. Conversación más reciente no archivada de esa combinación, para compatibilidad con datos antiguos.
5. Si no existe ninguna, crear una conversación nueva.

El chat abierto casualmente en el navegador nunca debe sustituir la selección persistida.
## Semántica de `--nueva`

Cuando el envío termina y el proveedor expone el ID real de la conversación creada:

- registrar la conversación para el proyecto y proveedor actuales;
- desmarcar cualquier conversación principal anterior de esa combinación;
- marcar la conversación recién creada como principal;
- reutilizarla en las ejecuciones posteriores sin `--nueva`.

Una conversación indicada mediante `--conversacion` se usa para esa ejecución, pero no cambia automáticamente la principal. Esto evita que una consulta puntual reconfigure el proyecto sin intención explícita.

## Semántica de `--continuar`

`--continuar` debe resolver la conversación con el mismo orden persistente, excepto que no puede crear una conversación nueva.

Si no existe conversación explícita ni persistida, debe devolver un error indicando que se use `--conversacion URL_O_ID` o que primero se envíe un mensaje normal.

`--continuar` no debe depender de la pestaña activa del navegador.
## Arquitectura y responsabilidades

### Entrada CLI

`src/entradas/cli/comandos/chat/enviar.ts` interpreta flags y normaliza IDs o URLs. No consulta la conversación abierta del navegador como selección implícita.

### Selección de conversación

`GestorContextoProyecto` y `SeleccionarConversacion` son la única fuente de decisión automática. La selección solo considera conversaciones del proyecto local o sus vínculos lógicos y siempre filtra por proveedor.

### Persistencia

`RepositorioConversaciones` mantiene la conversación principal. Al promover una conversación, la actualización debe ser atómica: primero desmarca la principal anterior del mismo `proyecto_local_id + proveedor` y después marca la nueva.

### Orquestación del envío

`EnviarMensajeConContexto` conserva el ID seleccionado, recibe el ID final creado por el proveedor y registra el resultado. Solo promueve como principal cuando la petición contiene `forzarNueva: true`.

### Proveedores

Qwen y DeepSeek continúan siendo responsables de navegar, enviar, observar el streaming y exponer el ID final de la URL. No deciden qué conversación corresponde al proyecto.
## Casos especiales

- Qwen y DeepSeek tienen conversaciones principales independientes para la misma ruta.
- Dos rutas Git distintas no comparten conversación salvo mediante el mecanismo existente de proyecto lógico vinculado.
- Una conversación archivada nunca se selecciona automáticamente.
- Una conversación ocupada no provoca silenciosamente un chat nuevo; se mantiene el error de concurrencia existente.
- Los fallbacks que por restricciones del proveedor deban crear una conversación nueva registran su ID, pero no sustituyen la principal salvo que la petición original use `--nueva`.
- El modo `--dry-run` no consulta ni modifica el navegador y muestra la selección que realmente usaría la ejecución.

## Pruebas automatizadas

La suite debe demostrar:

1. Reutilización indefinida aunque la conversación sea antigua.
2. Aislamiento por proveedor.
3. Aislamiento por proyecto local.
4. Prioridad de `--conversacion` sin cambiar la principal.
5. `--nueva` promueve el ID final creado.
6. El chat abierto en el navegador no modifica la selección.
7. `--continuar` usa la conversación persistida.
8. `--continuar` falla claramente cuando no existe conversación.
9. La promoción de principal desmarca la anterior de forma atómica.
## Validación real con WebBridge

Las pruebas manuales deben respetar todos los `AGENTS.md` aplicables:

1. Ejecutar `discover` y `schema chat.send` antes de construir comandos.
2. Ejecutar `--dry-run --output json` para capturar el ID seleccionado sin efectos.
3. Usar `--output jsonl` para las pruebas reales de streaming.
4. Crear una sesión WebBridge única para esta tarea y mantener `session` como campo de primer nivel.
5. Si el demonio no responde en `127.0.0.1:10086`, iniciar `~/.kimi-webbridge/bin/kimi-webbridge start` automáticamente.
6. Priorizar `snapshot` para inspeccionar la página; usar `evaluate` encapsulado en una IIFE cuando sea necesario confirmar `location.href`.
7. No registrar cookies, tokens ni secretos.

Secuencia mínima por proveedor:

- ejecutar con `--nueva` y capturar el ID final;
- ejecutar de nuevo sin `--nueva` y comprobar que se reutiliza ese ID;
- navegar manualmente la sesión WebBridge a otro chat;
- ejecutar nuevamente y comprobar que CAPI vuelve al ID persistido;
- repetir la comprobación con `--continuar` cuando exista una respuesta pendiente.

## Criterio de aceptación

La funcionalidad se considera terminada cuando pruebas unitarias, integración, `bun run typecheck`, `bun test` y pruebas reales con Qwen y DeepSeek confirman que el mismo `proyecto_local_id + proveedor` conserva contexto hasta que el usuario ejecuta `--nueva`.