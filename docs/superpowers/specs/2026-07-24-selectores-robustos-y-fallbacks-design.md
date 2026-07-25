# Selectores robustos y fallbacks para Qwen y DeepSeek

## Objetivo

Reducir la fragilidad de CAPI frente a cambios de clases, estructura DOM y estados de generación en Qwen y DeepSeek, manteniendo compatibilidad con WebBridge y sin depender de automatizaciones externas.

## Alcance

Este ciclo cubre únicamente:

- localización de entrada de texto;
- localización del control de envío;
- localización del control de detención;
- identificación de mensajes de usuario y asistente;
- extracción de pensamiento y respuesta;
- detección de errores y finalización;
- fallbacks de lectura para streaming.

No incluye cambios de arquitectura fuera de proveedores, nuevos proveedores ni interceptación permanente de APIs privadas.
## Principios

1. Priorizar atributos semánticos y accesibles sobre clases CSS.
2. Resolver candidatos en orden, no con un selector global ambiguo.
3. Restringir búsquedas al contenedor relevante.
4. Filtrar siempre por visibilidad real.
5. Usar heurísticas estructurales solo como último recurso.
6. Mantener scripts autocontenidos en IIFE para WebBridge.
7. Conservar salidas JSON/JSONL y `requestId`.
8. No introducir cookies, tokens ni secretos en logs o pruebas.

## Arquitectura propuesta

Se añadirá una pequeña biblioteca compartida de resolución DOM para scripts ejecutados en página. Sus funciones serán puras y autocontenidas:

- `esVisible(elemento)`;
- `primeroVisible(selectores, raiz)`;
- `visibles(selectores, raiz)`;
- `textoLimpio(elemento)`;
- `candidatoMasCercano(origen, candidatos)`;
- `puntuarCandidato(elemento, criterios)`.

Los proveedores conservarán sus módulos separados; la biblioteca no conocerá Qwen ni DeepSeek.
## Cadenas de selección

Cada intención tendrá una lista ordenada de selectores:

1. atributos accesibles (`aria-label`, `title`, `placeholder`, `role`);
2. atributos funcionales (`name`, `contenteditable`, `type`);
3. relaciones estructurales con el formulario o mensaje actual;
4. clases estables conocidas;
5. heurística controlada y acotada.

No se aceptarán como selector final global expresiones genéricas como `[class*="response"]` o `[class*="stop"]` sin validar contexto, visibilidad y semántica.

Para enviar, el fallback estructural localizará la entrada visible y elegirá el botón visible más cercano que tenga semántica de enviar o un icono compatible. Para respuestas, se buscará únicamente después del mensaje de usuario correlacionado con el prompt actual.

## Qwen

La entrada aceptará textarea y editores `contenteditable`. El asistente podrá identificarse por atributos, contenido markdown, bloque de pensamiento, toolbar de acciones o posición posterior al prompt.

Cuando aparezca “Pensamiento completado” sin respuesta visible, CAPI ejecutará una lectura final ampliada del bloque asistente. Excluirá toolbars, botones, etiquetas de estado y avisos generales antes de decidir que la respuesta está vacía.
## DeepSeek

La extracción seguirá este orden:

1. captura SSE asociada al envío actual;
2. historial autenticado o respaldo ya existente;
3. IndexedDB cuando esté disponible;
4. DOM semántico;
5. DOM estructural acotado al último turno.

Los fragmentos se fusionarán de forma incremental evitando duplicados, prefijos repetidos y concatenaciones parciales incorrectas. Un nodo con una clase que contenga `response`, `markdown` o `stop` no será suficiente por sí solo.

## Detección de finalización

La finalización se decidirá mediante señales combinadas:

- respuesta no vacía y estable;
- ausencia de un control Stop visible y semánticamente válido;
- presencia de toolbar final;
- captura de red marcada como terminada;
- textarea nuevamente utilizable;
- estado de error explícito.

Una sola señal débil no declarará finalización. La estabilidad se evaluará en el orquestador de streaming con varias lecturas consecutivas, no mediante esperas fijas dentro del DOM.
## Errores y diagnóstico

Cuando no se encuentre un elemento, el error deberá indicar:

- intención fallida;
- proveedor;
- cantidad de candidatos encontrados;
- estrategias intentadas;
- URL y estado general sin datos sensibles.

Los diagnósticos no imprimirán HTML completo, cookies, tokens ni contenido privado del usuario.

## Pruebas

Se ampliarán fixtures y pruebas para cubrir:

- clases renombradas;
- entrada `contenteditable`;
- botón por `aria-label` sin clase conocida;
- respuesta sin clase histórica;
- toolbar accesible;
- botón Stop oculto o falso positivo;
- múltiples turnos y correlación con el prompt actual;
- respuesta vacía después de pensamiento completado;
- nodos irrelevantes con `response` o `markdown` en la clase;
- fusión de fragmentos SSE acumulativos e incrementales.

Cada cambio seguirá RED → GREEN → REFACTOR. Después se ejecutarán typecheck, suite completa, smoke de ambos proveedores y pruebas reales con WebBridge.
## Validación real

Las pruebas operativas respetarán los `AGENTS.md`:

1. `discover` y `schema` antes de construir llamadas;
2. `--dry-run` para validar proveedor, modelo y conversación;
3. JSONL para streaming;
4. sesión WebBridge única por tarea;
5. `snapshot` como diagnóstico semántico;
6. `evaluate` siempre encapsulado en IIFE;
7. autoarranque del demonio si el puerto 10086 rechaza conexión.

## Criterios de aceptación

- Qwen y DeepSeek pueden enviar usando al menos un fallback sin clases históricas.
- Los fixtures con falsos positivos no producen respuestas ni estados Stop incorrectos.
- La respuesta se correlaciona con el prompt actual.
- Qwen realiza extracción final ampliada tras pensamiento completado.
- DeepSeek no trunca ni concatena incorrectamente respuestas por mezclar fragmentos.
- La suite completa y typecheck permanecen verdes.
- Los smoke reales no abren chats nuevos salvo cuando corresponda por contrato.

## Fuera de alcance

No se promete inmunidad total ante rediseños completos de los sitios. Cuando todas las estrategias fallen, CAPI deberá fallar con diagnóstico accionable en lugar de interactuar con un elemento ambiguo.