# AGENTS.md — Guía para Agentes de IA en `capi`

Este documento proporciona el contexto técnico, la arquitectura, el estado del proyecto y las instrucciones operativas para agentes de IA que trabajen en la base de código `capi`.

---

## 📌 Información General

- **Proyecto**: `capi` (CLI en TypeScript + Bun para interactuar con DeepSeek Chat)
- **Ubicación**: `/Users/andresgaibor/code/javascript/capi`
- **Runtime**: Bun (`bun` en lugar de `node`, `bun test` para pruebas, `bunx tsc` para comprobación de tipos)
- **Bridge Backend**: `Bun.serve()` en puerto `3847`
- **WebBridge Extension/Daemon**: Escucha en `http://127.0.0.1:10086` (sesión CDP `capi-capture`)

---

## 🏛️ Arquitectura (Clean Architecture)

```
src/
├── dominio/deepseek/
│   ├── casos-de-uso/
│   │   ├── EnviarMensajeStreaming.ts   # Generador asíncrono para streaming en vivo
│   │   ├── EnviarMensaje.ts            # Envió con polling de respaldo
│   │   ├── ObtenerMensajes.ts          # Extracción desde IndexedDB o DOM
│   │   ├── ListarConversaciones.ts     # Paginación y listado via API
│   │   └── IniciarSesionDeepSeek.ts    # Captura de credenciales
│   ├── entidades/
│   │   ├── Conversacion.ts
│   │   ├── Mensaje.ts
│   │   └── SesionDeepSeek.ts
│   ├── puertos/
│   │   ├── PuertoInterfazWebBridge.ts
│   │   ├── PuertoApiDeepSeek.ts
│   │   ├── PuertoRepositorioIndexedDB.ts
│   │   ├── PuertoRepositorioSesion.ts
│   │   └── PuertoSalidaCLI.ts
│   └── servicios/
│       ├── NormalizarRespuestaDeepSeek.ts
│       └── ConvertirRegistroHistoria.ts
├── adaptadores/
│   ├── webbridge/AdaptadorKimiWebBridge.ts  # Cliente REST para daemon Kimi (CDP)
│   ├── api/AdaptadorApiDeepSeek.ts          # Llamadas HTTP directas a DeepSeek
│   ├── indexeddb/AdaptadorIndexedDB.ts      # Lectura de IndexedDB local via evaluate()
│   ├── persistencia/AdaptadorSesionArchivo.ts # Lectura/escritura en ~/.cache/capi/
│   └── cli/AdaptadorConsola.ts
├── aplicacion/deepseek/
│   └── ServicioChatDeepSeek.ts              # Orquestador de la capa de aplicación
├── auth/
│   └── deepseek.ts                         # Lógica de carga/guardado de tokens y cookies
└── comandos/
    ├── chat.ts                             # Comandos `capi chat (list|messages|send)`
    ├── capture.ts                          # Comando `capi capture`
    ├── serve.ts                            # Comando `capi serve`
    └── auth.ts                             # Comando `capi auth (status|deepseek)`
```

---

## 🚦 Verificación y Pruebas

Para garantizar la calidad de los cambios, **siempre** ejecuta:

```bash
# 1. Comprobación de tipos de TypeScript
bunx tsc --noEmit

# 2. Ejecución de suite de tests automatizada
bun test

# 3. Comprobación del estado de sesión
bun run src/cli.ts auth status
```

---

## 🔑 Credenciales y Autenticación

DeepSeek utiliza 4 credenciales esenciales almacenadas en `~/.cache/capi/deepseek-session.json`:
1. `authorization`: Token Bearer obtenido de `localStorage.getItem('userToken')`.
2. `thumbcache`: Cookie `.thumbcache_*`.
3. `awsWafToken`: Cookie `aws-waf-token`.
4. `dsSessionId`: Cookie **HttpOnly** `ds_session_id` (se captura automáticamente via CDP en `capi capture`).

---

## 📝 Reglas de Desarrollo para Agentes

1. **Rutas Relativas / Portabilidad**: No utilices rutas absolutas con nombres de usuario específicos (usar `process.execPath` o `process.env.HOME`).
2. **Streaming en Tiempo Real**: Al consultar elementos del DOM durante el streaming activo de DeepSeek, contempla tanto los selectores oficiales (`.ds-think-content`, `.ds-assistant-message-main-content`) como los fallbacks de generación en vivo (`.ds-markdown`, `[class*="think"]`, `[class*="stop"]`).
3. **Manejo de Errores**: No silencies errores ni utilices bloques `try/catch` vacíos sin diagnóstico. En los comandos CLI, utiliza los primitivos de `consola` y `@clack/prompts`.
