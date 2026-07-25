# Módulos (`src/modulos/`) — Guía Detallada por Archivo y Casos de Uso

El directorio `src/modulos/` organiza los casos de uso del sistema de acuerdo con la Arquitectura Limpia. Cada carpeta representa un subdominio funcional independiente.

---

## 1. Subdominio de Chat (`src/modulos/chat/`)

- **[`EnviarMensajeConContexto.ts`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/chat/aplicacion/EnviarMensajeConContexto.ts)**:
  - **Propósito**: Caso de uso orquestador principal de CAPI.
  - **Operaciones**:
    1. Interpreta las fuentes de contexto solicitadas (archivos, carpetas, git diffs).
    2. Adquiere un lease de ocupación en la base de datos para la conversación elegida mediante `ControlEjecucionChat`.
    3. Registra el inicio del chat en el historial persistence local mediante `RegistroChatHistorial`.
    4. Empaqueta el contexto en un único archivo cacheado (`EmpaquetadorContexto`).
    5. Transmite los eventos en streaming aplicando la `PoliticaRecuperacionProveedor` en caso de fallos transitorios (ej. servidor ocupado, bajando de `preview` a `max`).

- **[`ControlEjecucionChat.ts`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/chat/aplicacion/ControlEjecucionChat.ts)**:
  - **Propósito**: Control de concurrencia y leases atómicos de conversación.
  - **Operaciones**: Garantiza que no existan más de 3 ejecuciones concurrentes a nivel global y evita que dos procesos CLI escriban simultáneamente en la misma conversación Web.

- **[`PoliticaRecuperacionProveedor.ts`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/chat/aplicacion/PoliticaRecuperacionProveedor.ts)**:
  - **Propósito**: Lógica de resiliencia y fallback automático.
  - **Operaciones**: Detecta si un error devuelto por la web es reintentable (`retryable: true`) o si requiere degradar el modelo (ej. bajar de Qwen `preview` a `max`, o en DeepSeek crear un chat nuevo si se degrada de `expert` a `default`).

- **[`RegistroChatHistorial.ts`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/chat/aplicacion/RegistroChatHistorial.ts)**:
  - **Propósito**: Auditoría y registro de mensajes enviados. Mantiene la trazabilidad asociando rama de Git, commit, hash del paquete de contexto y proveedor.

---

## 2. Subdominio de Contexto (`src/modulos/contexto/`)

- **[`EmpaquetadorContexto.ts`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/contexto/aplicacion/EmpaquetadorContexto.ts)**:
  - **Propósito**: Lee, limpia y consolida múltiples archivos de código en una sola entrega estructurada para el LLM.
  - **Operaciones**: Excluye archivos binarios y secretos (`.env`), trunca fragmentos que excedan los presupuestos de tokens/bytes y genera un hash de contenido.

- **[`SeleccionarContextoAutomatico.ts`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/contexto/aplicacion/SeleccionarContextoAutomatico.ts)**:
  - **Propósito**: Descubrimiento inteligente de archivos relevantes cuando se usa `--contexto-auto`.
  - **Operaciones**: Analiza diffs de Git, imports en archivos recientemente modificados y archivos de prueba asociados.

- **[`SepararAdjuntosContexto.ts`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/contexto/aplicacion/SepararAdjuntosContexto.ts)**:
  - **Propósito**: Clasifica las fuentes entre archivos de texto empaquetables y adjuntos nativos multimedia (PNG, JPEG, WebP, PDF).

- **[`RankearContextoLocal.ts`](file:///Users/andresgaibor/code/javascript/capi/src/modulos/contexto/aplicacion/RankearContextoLocal.ts)**:
  - **Propósito**: Reordena y prioriza los archivos descubiertos según su relevancia respecto al prompt enviado.

---

## 3. Otros Subdominios de Lógica Neutral

- **Conversaciones (`src/modulos/conversaciones/`)**:
  - `GestorContextoConversacion.ts`: Selecciona automáticamente la conversación más reciente asociada al proyecto actual o determina cuándo crear un chat nuevo (`id="new"`).
- **Visión (`src/modulos/vision/`)**:
  - `AnalizarImagen.ts` & `CompararImagenes.ts`: Preparan peticiones multimodales estructuradas para extraer texto, analizar capturas de UI o realizar comparaciones visuales.
- **Modelos (`src/modulos/modelos/`)**:
  - `SeleccionarModeloMultimodal.ts`: Valida y selecciona modelos compatibles con capacidad visual o de razonamiento.
- **Diagnóstico (`src/modulos/diagnostico/`)**:
  - Implementa la suite de comprobaciones del comando `doctor`.
