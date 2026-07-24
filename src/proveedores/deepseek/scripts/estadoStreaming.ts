export const scriptEstadoStreamingDeepSeek = () => `(() => {
  const thinkNodes = [...document.querySelectorAll('[class*="thinking"], [class*="reasoning"]')];
  const respNodes = [...document.querySelectorAll('.ds-markdown, [class*="markdown"], [class*="response"]')];
  const think = thinkNodes.at(-1)?.textContent?.trim() || '';
  const response = respNodes.at(-1)?.textContent?.trim() || '';
  const stop = !!document.querySelector('button[aria-label*="stop" i], [class*="stop"]');
  const warning = document.querySelector('.ds-button--warning, [class*="warning"]');
  return { think, response, done: !!response && !stop, isAssistant: !!think || !!response || stop || !!warning, isError: !!warning, errorMessage: warning?.textContent?.trim() || 'Server is busy.' };
})()`;
