interface NodoAccesible {
  role?: string;
  name?: string;
  children?: unknown;
}

const esNodo = (valor: unknown): valor is NodoAccesible =>
  !!valor && typeof valor === "object";

const TEXTO_INTERFAZ = /^(?:acknowledging (?:receipt|the signal).*|saltar|skip|autom[aá]tico|el contenido generado por ia puede no ser preciso\.?|esta retroalimentaci[oó]n nos ayudar[aá]|¿?qu[eé] respuesta prefieres\??|respuesta [12]|prefiero esta respuesta)$/i;

export function extraerRespuestaSnapshotQwen(tree: unknown): string {
  const textos: string[] = [];
  let despuesDelPensamiento = false;
  let terminado = false;

  const visitar = (valor: unknown): void => {
    if (terminado) return;
    if (Array.isArray(valor)) {
      for (const item of valor) visitar(item);
      return;
    }
    if (!esNodo(valor)) return;
    const nombre = typeof valor.name === "string" ? valor.name.trim() : "";
    if (valor.role === "button" && /^(copiar|copy|regenerar|regenerate)$/i.test(nombre)) {
      if (despuesDelPensamiento) terminado = true;
      return;
    }
    if (valor.role === "textbox" && /cómo puedo ayudarte|how can i help/i.test(nombre)) {
      if (despuesDelPensamiento) terminado = true;
      return;
    }
    if (valor.role === "StaticText" && nombre) {
      if (/^pensamiento completado$/i.test(nombre)) {
        textos.length = 0;
        despuesDelPensamiento = true;
        terminado = false;
        return;
      }
      if (despuesDelPensamiento && !TEXTO_INTERFAZ.test(nombre) && textos.at(-1) !== nombre) textos.push(nombre);
      return;
    }
    visitar(valor.children);
  };

  visitar(tree);
  return textos.join("\n").trim();
}
