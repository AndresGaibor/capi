export function scriptUtilidadesDom(): string {
  return `
    const __capiDom = (() => {
      const esVisible = (elemento) => {
        if (!elemento) return false;
        const objetivo = elemento.closest?.('button,[role="button"]') || elemento;
        const estilo = window.getComputedStyle(objetivo);
        const rect = objetivo.getBoundingClientRect();
        return estilo.display !== 'none' && estilo.visibility !== 'hidden' && Number(estilo.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
      };
      const visibles = (selectores, raiz = document) => {
        const vistos = new Set();
        const resultado = [];
        for (const selector of selectores) {
          for (const elemento of raiz.querySelectorAll(selector)) {
            if (!vistos.has(elemento) && esVisible(elemento)) { vistos.add(elemento); resultado.push(elemento); }
          }
        }
        return resultado;
      };
      const primeroVisible = (selectores, raiz = document) => visibles(selectores, raiz)[0] || null;
      const textoLimpio = (elemento) => (elemento?.innerText || elemento?.textContent || '').replace(/\u200B/g, '').replace(/\\s+$/g, '').trim();
      const masCercano = (origen, candidatos) => {
        if (!origen || !candidatos.length) return candidatos[0] || null;
        const a = origen.getBoundingClientRect();
        return [...candidatos].sort((x,y) => {
          const rx=x.getBoundingClientRect(), ry=y.getBoundingClientRect();
          return Math.hypot(rx.left-a.left,rx.top-a.top)-Math.hypot(ry.left-a.left,ry.top-a.top);
        })[0] || null;
      };
      const clonarSinRuido = (elemento) => {
        if (!elemento) return null;
        const clon = elemento.cloneNode(true);
        clon.querySelectorAll('button,nav,[role="toolbar"],[data-testid*="thinking" i],[class*="thinking" i],[class*="tool-status" i],[aria-label*="copiar" i],[aria-label*="copy" i]').forEach(n=>n.remove());
        return clon;
      };
      return { esVisible, visibles, primeroVisible, textoLimpio, masCercano, clonarSinRuido };
    })();
  `;
}
