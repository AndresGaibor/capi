type DefinicionComando = {
  args?: Record<string, { alias?: string | string[]; type?: string }>;
  subCommands?: Record<string, DefinicionComando>;
};

const FLAGS_GLOBALES = new Set(["--help", "-h", "--version", "-v"]);

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0]!;
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const anterior = fila[j]!;
      fila[j] = a[i - 1] === b[j - 1]
        ? diagonal
        : Math.min(diagonal + 1, fila[j]! + 1, fila[j - 1]! + 1);
      diagonal = anterior;
    }
  }
  return fila[b.length]!;
}

function resolverComando(raiz: DefinicionComando, rawArgs: string[]): { nombre: string; definicion: DefinicionComando } {
  const tokens = rawArgs.filter((arg) => !arg.startsWith("-") && !arg.includes("="));
  let actual = raiz;
  const ruta: string[] = [];
  for (const token of tokens) {
    const siguiente = actual.subCommands?.[token];
    if (!siguiente) break;
    ruta.push(token);
    actual = siguiente;
  }
  if (ruta[0] === "chat" && ruta.length === 1) {
    const enviar = actual.subCommands?.enviar;
    if (enviar) {
      ruta.push("enviar");
      actual = enviar;
    }
  }
  return { nombre: ruta.join(" ") || "capi", definicion: actual };
}

function flagsDe(definicion: DefinicionComando): string[] {
  const flags = new Set<string>(FLAGS_GLOBALES);
  for (const [nombre, argumento] of Object.entries(definicion.args ?? {})) {
    const cli = `--${nombre.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)}`;
    flags.add(cli);
    for (const alias of argumento.alias ? (Array.isArray(argumento.alias) ? argumento.alias : [argumento.alias]) : []) flags.add(`-${alias}`);
  }
  return [...flags];
}

export function validarArgumentosDesconocidos(rawArgs: string[], raiz?: DefinicionComando | object): { ok: boolean; unknowns: string[]; suggestions: string[]; command: string; available: string[] } {
  if (!raiz) return { ok: true, unknowns: [], suggestions: [], command: "capi", available: [] };
  const { nombre, definicion } = resolverComando(raiz as DefinicionComando, rawArgs);
  const available = flagsDe(definicion);
  const unknowns: string[] = [];
  for (const arg of rawArgs) {
    if (!arg.startsWith("-") || FLAGS_GLOBALES.has(arg)) continue;
    const base = arg.startsWith("--") ? arg.split("=", 1)[0]! : arg;
    if (!available.includes(base)) unknowns.push(arg);
  }
  const suggestions = unknowns.map((unknown) => {
    const candidato = available
      .map((flag) => ({ flag, distancia: distancia(unknown.replace(/=.*/, ""), flag) }))
      .sort((a, b) => a.distancia - b.distancia)[0];
    return candidato && candidato.distancia <= 4 ? candidato.flag : "";
  }).filter(Boolean);
  return { ok: unknowns.length === 0, unknowns, suggestions: [...new Set(suggestions)], command: nombre, available };
}

export function mostrarErrorYHelp(comando: string, unknowns: string[], suggestions: string[] = [], available: string[] = []): void {
  console.error(`\n\x1b[31mError: argumento(s) desconocido(s): ${unknowns.join(", ")}\x1b[0m`);
  if (suggestions.length) console.error(`¿Quizá quisiste decir: ${suggestions.join(", ")}?`);
  console.error(`\nUsa \x1b[36mcapi ${comando} --help\x1b[0m para ver los argumentos disponibles.`);
  if (available.length) console.error(`Flags disponibles: ${available.join(", ")}\n`);
}
