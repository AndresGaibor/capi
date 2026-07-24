# Diseño: gestión inteligente de contexto por proyecto

**Fecha:** 2026-07-24

## Objetivo

Convertir CAPI en una CLI que gestione conversaciones por proyecto, reutilice contexto de forma segura, controle concurrencia y pestañas del navegador, y mantenga proveedores y scripts DOM con responsabilidades aisladas.

## Decisiones aprobadas

1. Cuando `capi chat enviar` no recibe `--conversacion`, usará un modo híbrido: reutiliza automáticamente una conversación reciente y libre; pregunta cuando sea antigua o ambigua; crea otra cuando la elegida esté ocupada.
2. La identidad predeterminada de un proyecto es la raíz Git de la ruta actual. Si no existe Git, se usa la ruta absoluta actual.
3. Dos rutas físicas son proyectos independientes por defecto.
4. Varias rutas pueden vincularse manualmente mediante un identificador lógico común.
5. Al listar conversaciones se muestran primero las iniciadas desde la ruta actual y después las compartidas por el proyecto lógico, indicando su ruta de origen.

## Alcance

La primera versión incluye detección de proyecto, historial local, reutilización inteligente, asociación de conversaciones, favoritos y archivo, bloqueo entre procesos, límite de chats simultáneos, gestión de pestañas, sugerencias contextuales, diagnóstico ampliado y refactor de scripts DOM.

No incluye sincronización en la nube, copia del contenido completo de chats, estimación de tokens, integración con editores ni ejecución paralela ilimitada.

## Modelo de dominio

### Proyecto local

Representa una ruta física. Contiene `id`, `rutaRaiz`, `nombre`, `tipoDeteccion`, `remotoGit`, `ramaActual`, `creadoEn` y `usadoEn`.

### Proyecto lógico

Agrupa cero o más proyectos locales vinculados manualmente. La vinculación nunca se deduce solo por la URL remota para evitar mezclar clones o worktrees accidentalmente.

### Conversación registrada

Referencia una conversación externa sin copiar su contenido. Guarda proveedor, identificador externo, título, modelo, proyecto local de origen, proyecto lógico opcional, fechas, estado, favorita, archivada y último uso.

### Uso de conversación

Registra cada apertura o envío con ruta, proceso, proveedor y resultado. Permite ordenar el historial y explicar por qué una conversación fue elegida.

### Ocupación

Es un lease temporal renovable, no un booleano persistente. Contiene conversación, PID, identificador de proceso, fecha de adquisición y vencimiento. Un lease vencido puede recuperarse.

## Persistencia

Se usará SQLite local mediante `bun:sqlite`, sin nueva dependencia. La base estará en el directorio de datos de CAPI y tendrá migraciones versionadas.

Tablas mínimas: `proyectos_locales`, `proyectos_logicos`, `vinculos_proyecto`, `conversaciones`, `usos_conversacion`, `ocupaciones` y `preferencias_proyecto`.

La persistencia se expone mediante puertos del núcleo. Ningún comando CLI ni proveedor ejecutará SQL directamente. Las transacciones protegerán selección, ocupación y actualización del último uso.

## Selección de conversación

`SeleccionarConversacionProyecto` recibirá proyecto, proveedor, conversación explícita opcional y política de interacción.

Orden de decisión:

1. Una conversación indicada explícitamente siempre tiene prioridad y se registra en el proyecto actual tras validarla.
2. Se busca la conversación principal o última usada desde la ruta física actual.
3. Si no existe, se consideran conversaciones del proyecto lógico vinculado.
4. Solo se reutiliza automáticamente si coincide el proveedor, no está archivada, está libre y fue usada dentro del umbral configurable; el valor inicial será 12 horas.
5. Si hay varias candidatas equivalentes o la mejor supera el umbral, la CLI pregunta en terminal interactiva.
6. En una terminal no interactiva, se crea una conversación nueva ante cualquier ambigüedad.
7. Una conversación ocupada no se roba: se abre otra conversación o se falla si el usuario exigió el identificador explícitamente.

La decisión devolverá el motivo (`explicita`, `reciente_ruta`, `compartida`, `elegida`, `nueva_por_ambiguedad`, `nueva_por_ocupacion`) para que la CLI lo explique.

## Concurrencia

Antes del envío se adquiere una ocupación atómica. Se renueva durante el streaming y se libera en `finally` incluso si hay error o interrupción.

El límite inicial será de tres envíos simultáneos globales y uno por conversación. Será configurable por proyecto y globalmente.

Los procesos muertos no bloquearán permanentemente: un lease expira tras 90 segundos sin renovación. La recuperación queda registrada para diagnóstico.

Cuando se alcance el límite, la CLI mostrará las conversaciones activas y sugerirá esperar, reutilizar una libre o cancelar. No abrirá chats ilimitados silenciosamente.

## Gestión del navegador

Se introducirá un `GestorPestanas` independiente de los proveedores. Su responsabilidad será localizar, abrir, reutilizar y cerrar pestañas mediante el transporte disponible.

Cada pestaña conocida tendrá proveedor, URL, conversación externa opcional, proyecto local, estado (`libre`, `ocupada`, `desconocida`) y última actividad.

Reglas:

- La conversación actual nunca se cerrará para abrir otra.
- Una nueva conversación usa primero una pestaña libre compatible; si no existe, abre una nueva.
- No se reutiliza una pestaña ocupada por otro proceso.
- El máximo inicial será cinco pestañas administradas por proveedor.
- Al superar el máximo se cierra únicamente la pestaña libre menos reciente; si todas están ocupadas, la operación se rechaza con una recomendación clara.
- Los proveedores describen cómo reconocer sus URLs y abrir una conversación, pero no deciden la política global de pestañas.

## Límites de responsabilidad

`ProveedorChat` conserva integración específica: disponibilidad, modelos, envío, lectura de streaming y acceso a conversaciones externas.

El módulo de proyectos detecta rutas y vínculos. El módulo de conversaciones decide selección, historial y ocupación. La plataforma gestiona SQLite, procesos y pestañas. La entrada CLI solo transforma argumentos, invoca casos de uso y renderiza resultados.

`DeepSeekConversaciones` se dividirá: cliente de API de conversaciones, lector IndexedDB y adaptador de mapeo. No podrá navegar, consultar IndexedDB, autenticar y mapear en una sola clase.

El manejo repetido de excepciones de comandos se reemplazará por un ejecutor común que traduzca errores tipados a salida, código de proceso y siguiente acción sugerida.

## Scripts DOM

Los scripts seguirán siendo específicos por proveedor cuando dependan de su DOM, pero compartirán primitivas puras para serialización, validación y contratos de resultado.

Cada script debe:

- ser una función generadora sin acceso directo a consola, filesystem o estado global;
- recibir datos serializables y escapar entradas con `JSON.stringify`;
- devolver un resultado discriminado `{ ok: true, valor } | { ok: false, codigo, detalle }`;
- mantener selectores centralizados por proveedor;
- separar acciones (`escribir`, `enviar`, `seleccionar`) de lectores (`estado`, `modelo`, `respuesta`);
- poder ejecutarse contra fixtures HTML con pruebas unitarias;
- evitar temporizadores y polling duplicados cuando el navegador pueda observar mutaciones.

No se construirá un AST genérico para JavaScript: añadiría complejidad sin valor suficiente. Se usarán pequeños generadores tipados y utilidades compartidas.

## Experiencia CLI

Se añadirá `capi chat` como alias intuitivo de `capi chat enviar`, conservando el comando actual.

Comandos previstos:

- `capi proyecto actual`
- `capi proyecto vincular <alias>`
- `capi proyecto desvincular`
- `capi conversaciones proyecto`
- `capi conversaciones usar <id>`
- `capi conversaciones fijar <id>`
- `capi conversaciones archivar <id>`
- `capi conversaciones favoritas`
- `capi diagnostico completo`

La lista del proyecto mostrará primero conversaciones de la ruta actual y luego las compartidas, con proveedor, modelo, título, antigüedad, origen, favorita, ocupación y marcador de conversación activa.

Cada comando exitoso o fallido podrá devolver una sola sugerencia relevante. Las sugerencias serán producidas por la capa de aplicación como datos; la CLI decide su formato. No se imprimirán consejos genéricos repetitivos.

## Compatibilidad y migración

Los flags actuales `--proveedor`, `--conversacion`, `--modelo`, `--razonamiento`, `--busqueda` y `--archivo` conservan su significado.

La primera ejecución crea la base y registra el proyecto actual sin modificar sesiones existentes. Las conversaciones externas solo se incorporan al historial cuando se usan, se seleccionan explícitamente o el usuario solicita importarlas.

Si SQLite no puede abrirse, los comandos de consulta informan el problema y `chat enviar` puede operar en modo degradado creando una conversación nueva, sin reutilización ni concurrencia distribuida. Este modo debe anunciarse claramente.

## Diagnóstico

`diagnostico completo` verificará: detección de proyecto, acceso a base, versión de esquema, ocupaciones vencidas, transporte, navegador, pestañas administradas, sesión por proveedor, selectores principales, modelo y lectura de streaming.

La salida humana usará estados claros; `--json` devolverá datos estables para automatización. Nunca incluirá tokens, cookies, prompts ni contenido de respuestas.

## Pruebas y reglas de arquitectura

Se mantendrá TDD y la cobertura modular no podrá caer por debajo del umbral existente.

Pruebas obligatorias:

- detección Git y fallback por ruta;
- aislamiento entre dos proyectos físicos;
- vinculación y orden ruta-actual/compartidas;
- selección reciente, antigua, ambigua, explícita y ocupada;
- adquisición atómica, renovación, liberación y recuperación de leases;
- límite global y por conversación;
- política de pestañas y conservación de la pestaña actual;
- migraciones SQLite idempotentes;
- modo no interactivo y modo degradado;
- scripts DOM contra fixtures normales, alternativos y rotos;
- pruebas de arquitectura que prohíban SQL en CLI/proveedores, DOM en módulos y política de proyectos dentro de proveedores.

Los smoke tests reales de Qwen y DeepSeek continuarán separados de la suite determinista.

## Entregas incrementales

### Entrega 1: proyectos e historial

Detección de proyecto, SQLite, migraciones, vínculos, registro y listado por ruta/proyecto lógico. No cambia todavía la selección automática del chat.

### Entrega 2: selección inteligente y CLI

Política híbrida, conversación principal, favoritos, archivo, interacción terminal y sugerencias contextuales.

### Entrega 3: concurrencia y pestañas

Leases, límites simultáneos, recuperación, inventario de pestañas y política de apertura/reutilización.

### Entrega 4: refactor de proveedores y DOM

División de responsabilidades de DeepSeek, contratos uniformes de scripts, selectores centralizados, diagnóstico completo y endurecimiento arquitectónico.

Cada entrega debe finalizar con typecheck, pruebas, cobertura, revisión de arquitectura y un commit independiente. Los smoke tests se ejecutarán al cerrar las entregas que alteren navegación o DOM.

## Criterios de aceptación

1. Ejecutar CAPI desde dos repositorios distintos nunca mezcla conversaciones sin vínculo manual.
2. Dos rutas vinculadas comparten historial, pero la ruta actual aparece primero y conserva su conversación preferida.
3. Un envío sin `--conversacion` reutiliza de forma explicable una conversación reciente y libre, y no reutiliza silenciosamente una antigua, ambigua u ocupada.
4. Dos procesos no pueden enviar simultáneamente a la misma conversación.
5. Abrir otro chat no cierra ni reemplaza la conversación en uso.
6. Los límites evitan crecimiento indefinido de procesos y pestañas.
7. Los comandos muestran errores accionables y una recomendación pertinente.
8. Ningún proveedor contiene política de proyectos, concurrencia global o renderizado CLI.
9. Ningún caso de uso contiene selectores, JavaScript DOM o SQL.
10. La funcionalidad actual de Qwen y DeepSeek sigue pasando sus pruebas y smoke tests correspondientes.

## Riesgos y mitigaciones

Los DOM externos cambian: fixtures, diagnóstico y errores tipados reducen el tiempo de reparación. Los procesos pueden morir: leases vencibles evitan bloqueos permanentes. SQLite puede dañarse: migraciones transaccionales, respaldo previo a cambios de esquema y modo degradado mantienen operatividad. La automatización del navegador puede no exponer todas las pestañas: el gestor tratará como administradas solo las que pueda identificar de forma confiable.
