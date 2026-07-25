export const scriptEstadoStreamingDeepSeek = () => `(() => {
  const captura = window.__capiDeepSeekCompletion;
  const extraer = raw => {
    const partes = [];
    const visitar = valor => {
      if (!valor || typeof valor !== 'object') return;
      if (Array.isArray(valor)) { valor.forEach(visitar); return; }
      const objeto = valor;
      const choices = Array.isArray(objeto.choices) ? objeto.choices : [];
      for (const choice of choices) {
        const delta = choice?.delta;
        const mensaje = choice?.message;
        if (typeof delta?.content === 'string') partes.push(delta.content);
        else if (typeof mensaje?.content === 'string') partes.push(mensaje.content);
      }
      for (const [clave, contenido] of Object.entries(objeto)) {
        if (clave === 'choices') continue;
        if (typeof contenido === 'string' && /^(response|answer)$/i.test(clave)) partes.push(contenido);
        else if (contenido && typeof contenido === 'object') visitar(contenido);
      }
    };
    for (const linea of String(raw || '').replaceAll(String.fromCharCode(13), '').split(String.fromCharCode(10))) {
      const dato = linea.replace(/^data:\s*/, '').trim();
      if (!dato || dato === '[DONE]') continue;
      try { visitar(JSON.parse(dato)); } catch {}
    }
    let resultado = '';
    for (const parte of partes.filter(Boolean)) {
      if (parte === resultado || resultado.endsWith(parte)) continue;
      if (parte.startsWith(resultado)) resultado = parte;
      else if (!resultado.startsWith(parte)) resultado += parte;
    }
    return resultado;
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
