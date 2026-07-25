# Núcleo (`src/nucleo/`) — Guía Detallada por Archivos para Agentes

El directorio `src/nucleo/` define los contratos fundamentales, tipos de dominio puro, jerarquía de errores y abstracciones de proveedores del sistema CAPI.

---

## Mapa Completo de Archivos y Contratos

### 1. `src/nucleo/archivos/` (Manejo y Detección de Archivos)
- **[`DetectarTipoArchivo.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/archivos/DetectarTipoArchivo.ts)**:
  - Función `detectarTipoArchivo(ruta: string)`: Analiza extensiones y firmas mágicas (magic bytes) para identificar imágenes (`image/png`, `image/jpeg`, `image/webp`, `image/gif`), documentos (`application/pdf`) o archivos de texto plano/código.
  - Función `esImagen(mime: string)`: Devuelve `true` si el MIME corresponde a un formato visual soportado.
  - Función `esDocumento(mime: string)`: Devuelve `true` para PDFs.

- **[`EstrategiaAdjuntos.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/archivos/EstrategiaAdjuntos.ts)**:
  - Interface/Enum que define los métodos de subida de archivos al navegador:
    - `"dom"`: Transferencia por inyección de File nativo en el DOM (utilizado por defecto en Qwen).
    - `"cdp"`: Inyección de archivos mediante Chrome DevTools Protocol `DOM.setFileInputFiles`.
    - `"datatransfer"`: Fallback usando eventos sintéticos de `DataTransfer`.

---

### 2. `src/nucleo/chat/` (Tipos de Petición y Eventos Streaming)
- **[`PeticionChat.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/chat/PeticionChat.ts)**:
  - Interface `PeticionChat`: Estructura enviada al proveedor.
    - `prompt: string`: Texto de la consulta.
    - `modelo?: string`: Nombre o alias del modelo (ej. `preview`, `max`, `expert`, `default`).
    - `conversacionId?: string`: ID de la conversación en la plataforma Web.
    - `archivos?: string[]`: Lista de rutas de archivos empaquetados o adjuntos.
    - `imagenes?: string[]`: Lista de rutas de imágenes para modelos mulitmodales.
    - `nuevaPestana?: boolean`: Fuerza la creación de una pestaña nueva.
    - `profundo?: boolean`: Activa el modo DeepThink/Razonamiento en DeepSeek.
    - `busqueda?: boolean`: Activa la búsqueda en la Web si la plataforma lo soporta.

- **[`EventoStreaming.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/chat/EventoStreaming.ts)**:
  - Type `EventoStreaming`: Discriminado por la propiedad `tipo`.
    - `{ tipo: "pensamiento", contenido: string }`: Bloques de razonamiento (DeepThink / Thought).
    - `{ tipo: "respuesta", contenido: string }`: Fragmento del mensaje principal del asistente.
    - `{ tipo: "error", error: string, recuperable?: boolean }`: Notificación de fallo durante el streaming.
    - `{ tipo: "fin", respuestaCompleta?: string }`: Evento de cierre con el acumulado total.

---

### 3. `src/nucleo/errores/` (Jerarquía Estructurada de Errores)
- **[`ErroresAplicacion.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/errores/ErroresAplicacion.ts)**:
  - Class `ErrorCAPI extends Error`: Clase base de error con `codigo`, `retryable` (booleano), `suggestions` (sugerencias para el agente) y `requestId`.
  - Class `ErrorProveedor extends ErrorCAPI`: Errores emitidos por la web de Qwen/DeepSeek (ej. servidor ocupado, alta demanda, timeout de DOM).
  - Class `ErrorSesionExpirada extends ErrorCAPI`: Emitido cuando WebBridge pierde la pestaña o expira la sesión del usuario.
  - Class `ErrorCapacidadNoSoportada extends ErrorCAPI`: Emitido al solicitar visión a un modelo solo de texto.

---

### 4. `src/nucleo/proveedores/` (Abstracción de LLMs Web)
- **[`ProveedorChat.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/proveedores/ProveedorChat.ts)**:
  - Interface `ProveedorChat`: Contrato obligatorio para todo adaptador de proveedor.
    - `id: string` (`"qwen"` | `"deepseek"`).
    - `enviarMensaje(peticion: PeticionChat): AsyncIterable<EventoStreaming>`: Generador asíncrono que emite la respuesta en streaming.
    - `obtenerConversacionActual(): Promise<string | undefined>`.
    - `estaDisponible(): Promise<boolean>`.

- **[`RegistroProveedores.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/proveedores/RegistroProveedores.ts)**:
  - Class `RegistroProveedores`: Registry central donde se matriculan las instancias de `ProveedorChat`. Permite resolver un proveedor por su ID en tiempo de ejecución.

- **[`CapacidadesProveedor.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/proveedores/CapacidadesProveedor.ts)**:
  - Interfaz de capacidades que declara soporte para visión, adjuntos de código, búsqueda web y razonamiento profundo por proveedor.

- **[`CapacidadesMultimodales.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/proveedores/CapacidadesMultimodales.ts)**:
  - Funciones para mapear y validar qué modelos soportan visión (ej. Qwen `preview` / `plus` y DeepSeek `vision`).

---

### 5. `src/nucleo/proyectos/` (Modelo de Proyecto Git/Físico)
- **[`Proyecto.ts`](file:///Users/andresgaibor/code/javascript/capi/src/nucleo/proyectos/Proyecto.ts)**:
  - Interface `Proyecto`: Representa una carpeta de código o repositorio Git rastreado.
    - `id: string`: Hash único derivado de la ruta.
    - `nombre: string`: Nombre del directorio.
    - `rutaRaiz: string`: Ruta absoluta en el sistema de archivos.
