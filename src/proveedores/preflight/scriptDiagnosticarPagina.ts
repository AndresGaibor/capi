export function scriptDiagnosticarPagina(proveedor: "qwen" | "deepseek"): string {
  const host = proveedor === "qwen" ? "chat.qwen.ai" : "chat.deepseek.com";
  return `(() => {
    const texto=(document.body?.innerText||'').toLowerCase();
    const senales=[];
    let codigo;
    if(location.host!==${JSON.stringify(host)}) { codigo='PAGINA_NO_COMPATIBLE'; senales.push('host-no-compatible'); }
    else if(document.querySelector("iframe[src*='captcha' i],.captcha,[data-sitekey],[class*='captcha' i]")||/captcha|verify you are human/.test(texto)) { codigo='CAPTCHA_REQUERIDO'; senales.push('captcha'); }
    else if(/iniciar sesión|sign in|log in|login/.test(texto)) { codigo='SESION_EXPIRADA'; senales.push('sesion'); }
    else if(/conversation (?:not found|deleted)|conversaci[oó]n (?:no encontrada|eliminada)/.test(texto)) { codigo='CONVERSACION_INVALIDA'; senales.push('conversacion-invalida'); }
    else if(document.querySelector("[role='dialog'][aria-modal='true'],.modal-mask,.ant-modal-wrap")) { codigo='PROVEEDOR_OCUPADO'; senales.push('modal-bloqueante'); }
    else if(!document.querySelector("textarea,[contenteditable='true'],[role='textbox']")) { codigo='SELECTOR_NO_ENCONTRADO'; senales.push('entrada-ausente'); }
    else senales.push('entrada-utilizable');
    return { proveedor:${JSON.stringify(proveedor)}, estrategia:'dom', ok:!codigo, codigo, url:location.origin+location.pathname, candidatos:[${JSON.stringify(host)}], senales };
  })()`;
}
