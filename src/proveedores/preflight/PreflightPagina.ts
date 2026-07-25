export type CodigoPreflight =
  | "SESION_EXPIRADA"
  | "CAPTCHA_REQUERIDO"
  | "CONVERSACION_INVALIDA"
  | "PAGINA_NO_COMPATIBLE"
  | "SELECTOR_NO_ENCONTRADO"
  | "PROVEEDOR_OCUPADO";

export type ResultadoPreflight =
  | { ok: true; estrategia: "dom"; url: string; candidatos: string[]; senales: string[] }
  | { ok: false; codigo: CodigoPreflight; estrategia: "dom"; url: string; candidatos: string[]; senales: string[] };

const textoVisible = (documento: Document) => (documento.body?.innerText ?? documento.body?.textContent ?? "").toLowerCase();

export function inspeccionarPreflightPagina(documento: Document, ubicacion: Location, proveedor: "qwen" | "deepseek"): ResultadoPreflight {
  const texto = textoVisible(documento);
  const url = `${ubicacion.origin}${ubicacion.pathname}`;
  const candidatos = proveedor === "qwen" ? ["chat.qwen.ai"] : ["chat.deepseek.com"];
  const senales: string[] = [];
  const falla = (codigo: CodigoPreflight, senal: string): ResultadoPreflight => ({ ok: false, codigo, estrategia: "dom", url, candidatos, senales: [senal] });
  if (!ubicacion.host.endsWith(candidatos[0]!)) return falla("PAGINA_NO_COMPATIBLE", "host-no-compatible");
  if (documento.querySelector("iframe[src*='captcha' i], .captcha, [data-sitekey], [class*='captcha' i]") || /captcha|verify you are human/.test(texto)) return falla("CAPTCHA_REQUERIDO", "captcha");
  if (documento.querySelector("button, a") && /iniciar sesión|sign in|log in|login/.test(texto)) return falla("SESION_EXPIRADA", "sesion");
  if (/conversation (?:not found|deleted)|conversaci[oó]n (?:no encontrada|eliminada)/.test(texto)) return falla("CONVERSACION_INVALIDA", "conversacion-invalida");
  if (documento.querySelector("[role='dialog'][aria-modal='true'], .modal-mask, .ant-modal-wrap")) return falla("PROVEEDOR_OCUPADO", "modal-bloqueante");
  const entrada = documento.querySelector("textarea, [contenteditable='true'], [role='textbox']");
  if (!entrada) return falla("SELECTOR_NO_ENCONTRADO", "entrada-ausente");
  senales.push("entrada-utilizable");
  return { ok: true, estrategia: "dom", url, candidatos, senales };
}

export function sanitizarFixtureDom(documento: Document): string {
  const raiz = documento.querySelector("main, body");
  if (!raiz) return "";
  const copia = raiz.cloneNode(true) as HTMLElement;
  for (const elemento of copia.querySelectorAll("*")) {
    for (const atributo of [...elemento.attributes]) {
      const permitido = atributo.name === "role" || atributo.name === "class" || atributo.name.startsWith("aria-") || atributo.name === "type";
      if (!permitido || /token|cookie|secret|value|href|src|id/i.test(atributo.name)) elemento.removeAttribute(atributo.name);
    }
    for (const nodo of [...elemento.childNodes]) if (nodo.nodeType === 3) nodo.remove();
  }
  return copia.outerHTML;
}
