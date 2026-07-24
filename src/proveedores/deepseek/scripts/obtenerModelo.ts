export const scriptObtenerModeloDeepSeek = () => `(() => {
  const badge = document.querySelector('[class*="model"] [class*="badge"], [data-model-type][aria-selected="true"]');
  return badge?.getAttribute('data-model-type') || badge?.textContent?.trim() || null;
})()`;
