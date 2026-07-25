export function normalizarUrlConversacion(id: string): string {
  const limpio = id.trim();
  if (/^https?:\/\//i.test(limpio)) {
    try {
      const url = new URL(limpio, "https://chatgpt.com");
      const match = url.pathname.match(/\/c\/([^/?#]+)/);
      if (match) return `https://chatgpt.com/c/${match[1]}`;
      return limpio;
    } catch {
      return `https://chatgpt.com/c/${limpio}`;
    }
  }
  if (limpio.startsWith("/")) {
    const match = limpio.match(/\/c\/([^/?#]+)/);
    if (match) return `https://chatgpt.com/c/${match[1]}`;
    return `https://chatgpt.com${limpio}`;
  }
  const uuid = limpio.replace(/^c\//, "");
  return `https://chatgpt.com/c/${uuid}`;
}

export function canonicalizarConversacion(href: string): string | null {
  try {
    const url = new URL(href, "https://chatgpt.com");
    const match = url.pathname.match(/\/c\/([^/?#]+)/);
    if (!match) return null;
    return `https://chatgpt.com/c/${match[1]}`;
  } catch {
    return null;
  }
}
