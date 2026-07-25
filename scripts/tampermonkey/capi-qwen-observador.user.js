// ==UserScript==
// @name         CAPI Qwen Observer
// @namespace    capi.local
// @version      1.0.0
// @description  Telemetría local y saneada para CAPI; no captura prompts, respuestas, cookies ni tokens.
// @match        https://chat.qwen.ai/*
// @grant        none
// ==/UserScript==
(() => {
  'use strict';
  const estado = window.__CAPI_QWEN_BRIDGE__ = {
    version: 1, estado: 'desconocido', generando: false,
    actualizadoEn: Date.now(), turnoId: null, mutaciones: 0
  };
  const actualizar = () => {
    const texto = document.body?.innerText || '';
    const botones = [...document.querySelectorAll('button,[role="button"]')];
    const stop = botones.some(b => /stop|detener/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`));
    const completado = /pensamiento completado/i.test(texto);
    estado.generando = stop;
    estado.estado = stop ? 'pensando' : completado ? 'esperando_respuesta' : 'esperando_turno';
    estado.actualizadoEn = Date.now(); estado.mutaciones++;
    window.dispatchEvent(new CustomEvent('capi:qwen-estado', { detail: { ...estado } }));
  };
  new MutationObserver(actualizar).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
  setInterval(actualizar, 15000); actualizar();
})();
