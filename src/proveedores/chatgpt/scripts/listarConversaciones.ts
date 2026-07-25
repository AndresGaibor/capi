import { SELECTORES_CHATGPT } from "../selectores/SelectoresChatGPT";

export function scriptListarConversacionesChatGPT(): string {
  return `(() => {
    const enlaces = [...document.querySelectorAll(${JSON.stringify(SELECTORES_CHATGPT.conversaciones)})];
    const vistos = new Set();
    return enlaces
      .map(a => ({ href: a.href, titulo: (a.textContent || "").trim() }))
      .filter((item) => {
        if (!item.href || !item.href.includes("/c/")) return false;
        if (vistos.has(item.href)) return false;
        vistos.add(item.href);
        return true;
      })
      .map(item => ({
        href: item.href.split("?")[0],
        titulo: item.titulo || item.href.split("/c/")[1] || "Conversación"
      }));
  })()`;
}
