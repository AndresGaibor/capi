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

function subComandosDe(definicion: DefinicionComando): string[] {
  return Object.keys(definicion.subCommands ?? {});
}

function sugerenciasDeSubcomando(definicion: DefinicionComando, typo: string): string[] {
  const candidatos = subComandosDe(definicion);
  return candidatos
    .map((s) => ({ s, d: distancia(typo, s) }))
    .filter((c) => c.d <= Math.max(2, Math.floor(typo.length / 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((c) => c.s);
}

function normalizarRutaChat(ruta: string[], tokens: string[], raiz: DefinicionComando): { ruta: string[]; insertarEnviar: boolean } {
  if (ruta[0] === "chat" && ruta.length === 1) {
    return { ruta: [...ruta, "enviar"], insertarEnviar: true };
  }
  return { ruta, insertarEnviar: false };
}

function resolverComando(raiz: DefinicionComando, rawArgs: string[]): { nombre: string; definicion: DefinicionComando; padre?: DefinicionComando; typoSubcomando?: string; padreDelTypo?: DefinicionComando } {
  const tokens = rawArgs.filter((arg) => !arg.startsWith("-") && !arg.includes("="));
  const tokensFiltrados: string[] = [];
  for (const t of tokens) {
    if (tokensFiltrados.length === 1 && tokensFiltrados[0] === "chat") {
      tokensFiltrados.push("enviar");
    }
    tokensFiltrados.push(t);
  }
  let actual = raiz;
  let padre: DefinicionComando | undefined;
  const ruta: string[] = [];
  let typoSubcomando: string | undefined;
  let padreDelTypo: DefinicionComando | undefined;
  for (let i = 0; i < tokensFiltrados.length; i++) {
    const token = tokensFiltrados[i]!;
    const siguiente = actual.subCommands?.[token];
    if (!siguiente) {
      const tieneSubcomandos = Object.keys(actual.subCommands ?? {}).length > 0;
      if (tieneSubcomandos) {
        typoSubcomando = token;
        padreDelTypo = actual;
      }
      break;
    }
    padre = actual;
    ruta.push(token);
    actual = siguiente;
  }
  return {
    nombre: ruta.join(" ") || (typoSubcomando ? "" : "capi"),
    definicion: actual,
    padre: typoSubcomando ? padreDelTypo ?? raiz : padre,
    typoSubcomando,
    padreDelTypo,
  };
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

export function validarArgumentosDesconocidos(rawArgs: string[], raiz?: DefinicionComando | object): { ok: boolean; unknowns: string[]; suggestions: string[]; command: string; available: string[]; subcommandSuggestions?: string[] } {
  if (!raiz) return { ok: true, unknowns: [], suggestions: [], command: "capi", available: [] };
  const { nombre, definicion, padre, typoSubcomando } = resolverComando(raiz as DefinicionComando, rawArgs);
  const available = flagsDe(definicion);
  const unknowns: string[] = [];
  for (const arg of rawArgs) {
    if (!arg.startsWith("-") || FLAGS_GLOBALES.has(arg)) continue;
    const base = arg.startsWith("--") ? arg.split("=", 1)[0]! : arg;
    if (!available.includes(base)) unknowns.push(arg);
  }
  const subcommandSuggestions = typoSubcomando && padre ? sugerenciasDeSubcomando(padre, typoSubcomando) : [];
  const suggestions = !typoSubcomando ? unknowns.map((unknown) => {
    const candidato = available
      .map((flag) => ({ flag, distancia: distancia(unknown.replace(/=.*/, ""), flag) }))
      .sort((a, b) => a.distancia - b.distancia)[0];
    return candidato && candidato.distancia <= 4 ? candidato.flag : "";
  }).filter(Boolean) : [];
  return {
    ok: unknowns.length === 0 && !typoSubcomando,
    unknowns: typoSubcomando ? [typoSubcomando] : unknowns,
    suggestions: [...new Set(suggestions)],
    command: nombre === "capi" && padre && padre !== raiz ? "" : nombre,
    available,
    subcommandSuggestions,
  };
}

export function mostrarErrorYHelp(comando: string, unknowns: string[], suggestions: string[] = [], available: string[] = [], subcommandSuggestions: string[] = []): void {
  console.error(`\n\x1b[31mError: subcomando o argumento desconocido: ${unknowns.join(", ")}\x1b[0m`);
  if (subcommandSuggestions.length) console.error(`¿Quizá quisiste decir: ${subcommandSuggestions.join(", ")}?`);
  else if (suggestions.length) console.error(`¿Quizá quisiste decir: ${suggestions.join(", ")}?`);
  const subfijo = comando ? ` ${comando}` : "";
  const target = subfijo ? `\x1b[36mcapi${subfijo} --help\x1b[0m` : `\x1b[36mcapi --help\x1b[0m`;
  console.error(`\nUsa ${target} para ver los argumentos disponibles.`);
  if (available.length) console.error(`Flags disponibles: ${available.join(", ")}\n`);
}
