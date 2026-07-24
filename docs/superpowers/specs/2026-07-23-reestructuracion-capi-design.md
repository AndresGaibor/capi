# Diseño de reestructuración completa de CAPI

Fecha: 2026-07-23
Estado: aprobado

## Objetivo

Reestructurar CAPI como un monolito modular por capacidades y proveedores, eliminando la arquitectura actual y el código legado cuando cada reemplazo esté probado. La nueva CLI puede romper compatibilidad. WebBridge será el transporte inicial, pero los casos de uso quedarán preparados para API oficial, Playwright u otros transportes.

## Decisiones aprobadas

- Reestructuración completa de todo CAPI.
- Nueva CLI sin compatibilidad obligatoria con comandos actuales.
- WebBridge como transporte inicial detrás de puertos neutrales.
- Eliminación del legado cuando exista reemplazo probado.
- Errores mediante excepciones tipadas, no eventos `error`.
- Arquitectura por `nucleo`, `modulos`, `proveedores`, `plataforma` y `entradas`.

## Estructura objetivo

```text
src/
  nucleo/
  modulos/
  proveedores/
  plataforma/
  entradas/
```
## Responsabilidades

### Núcleo

Contiene tipos, eventos, errores y puertos neutrales: petición de chat, modelos, conversaciones, capacidades, proveedor de chat, transporte de navegador y salida. No puede importar Qwen, DeepSeek, WebBridge, Bun, Citty, consola ni selectores DOM.

### Módulos

Contiene casos de uso independientes del proveedor: enviar mensaje, listar y seleccionar modelos, listar conversaciones, obtener mensajes, verificar o importar sesión y capturar diagnóstico. Solo depende del núcleo.

### Proveedores

Cada proveedor mantiene juntos sus detalles: capacidades, traducción de modelos, navegación, selección de modelo, envío de prompt, extracción de streaming, conversaciones y scripts DOM. Un proveedor no puede importar otro proveedor.

### Plataforma

Implementa los puertos técnicos: cliente y transporte WebBridge, salida de consola, configuración, persistencia de sesión e IndexedDB. En el futuro podrán añadirse transportes HTTP o Playwright sin cambiar los casos de uso.

### Entradas

Contiene la CLI, comandos y composition root. Solo valida argumentos, resuelve casos de uso, ejecuta y renderiza resultados. No contiene `fetch`, selectores CSS ni condicionales específicos por proveedor.

## Contrato principal

`ProveedorChat` expone identificador, capacidades, disponibilidad, envío streaming y operaciones opcionales de modelos, conversaciones y sesión. Los casos de uso verifican capacidades antes de ejecutar.
## Flujo de envío

```text
CLI -> EnviarMensajeStreaming -> ProveedorChat -> PaginaChatProveedor
    -> PuertoTransporteNavegador -> WebBridge
```

La respuesta vuelve como eventos neutrales: inicio, pensamiento, respuesta, conversación, modelo y fin. Los fallos lanzan excepciones tipadas como timeout, modelo no disponible, capacidad no soportada, WebBridge no disponible o respuesta vacía.

## Qwen

Qwen será el primer proveedor migrado. El archivo monolítico actual se dividirá en resolución de modelos, navegación, selector de modelo, emisor de prompt, extractor de streaming, política de alternativas A/B, página de chat y proveedor.

La política A/B inicial será `PrimeraAlternativaNoVacia`: si hay varias `.response-message-box`, toma la primera respuesta no vacía sin hacer clic en “Prefiero esta respuesta”. Si todas están vacías, espera hasta el timeout tipado.

La selección de modelos admite nombres exactos y aliases. Si el modelo no existe, debe devolver la lista disponible y no enviar el prompt con otro modelo.

## DeepSeek

Después de Qwen se migrarán sesión, modelos, navegación, envío, streaming, conversaciones y mensajes. Los casos de uso actuales de DeepSeek serán reemplazados por casos neutrales y componentes del proveedor.

## CLI objetivo

```text
capi chat enviar --proveedor qwen --prompt "Hola" --modelo max
capi modelos listar --proveedor qwen
capi conversaciones listar --proveedor deepseek
capi conversaciones mensajes --proveedor deepseek --id <id>
capi sesion importar --proveedor deepseek
capi diagnostico pagina --proveedor qwen
capi servidor iniciar
```
## Migración

1. Crear núcleo, errores, puertos, eventos, capacidades y registro de proveedores.
2. Migrar Qwen y validar envío nuevo, conversación existente, modelos, streaming normal, pensamiento, A/B, respuestas vacías y timeouts.
3. Migrar DeepSeek al mismo contrato.
4. Crear la nueva CLI y composition root.
5. Migrar sesión, conversaciones, captura y servidor.
6. Eliminar cada componente legado cuando su reemplazo tenga pruebas, smoke y cero imports restantes.

## Pruebas

- Unitarias para aliases, políticas A/B, normalización, casos de uso, registro y mapeo de errores.
- Pruebas contractuales compartidas para todos los proveedores.
- Fixtures HTML reducidos para pantalla inicial, respuesta normal, respuesta A/B, selector de modelos y respuesta vacía.
- Smokes reales independientes para Qwen y DeepSeek usando WebBridge.

## Eliminación del legado

Se retirarán progresivamente los entrypoints experimentales, archivos de depuración, servicios y casos de uso antiguos, `DomScripts`, comandos y composition roots actuales. Antes de borrar un archivo se preservará cualquier comportamiento útil en pruebas o documentación.

## Reglas arquitectónicas

- `nucleo` no importa infraestructura ni proveedores.
- `modulos` solo importa `nucleo`.
- `proveedores` importa `nucleo` y archivos propios.
- `plataforma` implementa puertos del núcleo.
- `entradas` usa módulos y composición, sin lógica DOM.
- Ningún caso de uso contiene selectores CSS.
- Ningún comando CLI llama `fetch` directamente.
- No existen imports entre proveedores.

## Criterio de finalización

La migración termina cuando la nueva CLI cubra las capacidades aprobadas, Qwen y DeepSeek pasen pruebas unitarias, contractuales y smokes, no existan imports hacia la arquitectura vieja y el código legado reemplazado haya sido eliminado.
