# Actualizar CAPI Qwen Observer

La telemetría avanzada requiere el userscript **CAPI - Qwen Observer 1.1.0**, cuyo bridge interno es `version: 2`.

Artefacto:

```text
~/code/javascript/tampermonkey-scripts/dist/capi-qwen-observador.user.js
```

La actualización puede instalarse abriendo el artefacto o usando la URL de actualización configurada en su cabecera. CAPI sigue funcionando sin el userscript: DOM, snapshot e historial permanecen disponibles como fallbacks.

Para verificar desde la consola de Qwen:

```js
window.__CAPI_QWEN_BRIDGE__
```

Debe mostrar `version: 2`, `proveedor: "qwen"`, `firmaEstado`, `ultimoCambioRealEn` y nunca prompts o respuestas.
