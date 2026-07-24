export const scriptEstadoStreamingDeepSeek = () => `(() => {
  const captura = window.__capiDeepSeekCompletion;
  const extraer = raw => {
    const partes = [];
    const visitar = valor => {
      if (!valor) return;
      if (typeof valor === 'string') return;
      if (Array.isArray(valor)) { valor.forEach(visitar); return; }
      if (typeof valor !== 'object') return;
      for (const [clave, contenido] of Object.entries(valor)) {
        if (typeof contenido === 'string' && /^(content|text|response|answer)$/i.test(clave)) partes.push(contenido);
        else visitar(contenido);
      }
    };
    for (const linea of String(raw || '').replaceAll(String.fromCharCode(13), '').split(String.fromCharCode(10))) {
      const dato = linea.replace(/^data:\s*/, '').trim();
      if (!dato || dato === '[DONE]') continue;
      try { visitar(JSON.parse(dato)); } catch {}
    }
    const unicas = partes.filter((p, i) => p && (i === 0 || p !== partes[i - 1]));
    return unicas.join('');
  };
  const thinkNodes = [...document.querySelectorAll('[class*="thinking"], [class*="reasoning"]')];
  const respNodes = [...document.querySelectorAll('.ds-markdown, [class*="markdown"], [class*="response"]')];
  const think = thinkNodes.at(-1)?.textContent?.trim() || '';
  const respuestaCapturada = extraer(captura?.raw);
  const response = respuestaCapturada || respNodes.at(-1)?.textContent?.trim() || '';
  const stop = !!document.querySelector('button[aria-label*="stop" i], [class*="stop"]');
  const warning = document.querySelector('.ds-button--warning, [class*="warning"]');
  return { think, response, done: captura?.done ? !!response : (!!response && !stop), isAssistant: !!think || !!response || stop || !!warning, isError: !!warning || !!captura?.error, errorMessage: captura?.error || warning?.textContent?.trim() || 'Server is busy.' };
})()`;
