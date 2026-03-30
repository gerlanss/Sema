export interface SimboloCppExtraido {
  simbolo: string;
  retorno?: string;
  parametros: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

function extrairParametrosCpp(assinatura: string): Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }> {
  return assinatura.split(",").map((parametroBruto) => {
    const parametro = parametroBruto.trim();
    if (!parametro || parametro === "void") {
      return undefined;
    }
    const semPadrao = parametro.split("=")[0]?.trim() ?? parametro;
    const partes = semPadrao.split(/\s+/).filter(Boolean);
    if (partes.length < 2) {
      return undefined;
    }
    const nome = partes.at(-1)!.replace(/[&*]+$/, "");
    const tipoTexto = partes.slice(0, -1).join(" ");
    return {
      nome,
      tipoTexto,
      obrigatorio: !parametro.includes("="),
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function extrairSimbolosCpp(codigo: string): SimboloCppExtraido[] {
  const simbolos = new Map<string, SimboloCppExtraido>();

  for (const match of codigo.matchAll(/(?:^|\n)\s*(?:inline\s+|static\s+|virtual\s+|constexpr\s+|friend\s+|extern\s+|template\s*<[^>]+>\s*)*(?:[\w:<>~*&]+\s+)+([A-Za-z_]\w*)::([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:const)?\s*(?:\{|;)/g)) {
    const simbolo = `${match[1]!}.${match[2]!}`;
    simbolos.set(simbolo, {
      simbolo,
      parametros: extrairParametrosCpp(match[3] ?? ""),
    });
  }

  for (const match of codigo.matchAll(/(?:^|\n)\s*(?:inline\s+|static\s+|virtual\s+|constexpr\s+|friend\s+|extern\s+)*(?:[\w:<>~*&]+\s+)+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:const)?\s*(?:\{|;)/g)) {
    const nome = match[1]!;
    if (["if", "for", "while", "switch", "return"].includes(nome)) {
      continue;
    }
    if (!simbolos.has(nome)) {
      simbolos.set(nome, {
        simbolo: nome,
        parametros: extrairParametrosCpp(match[2] ?? ""),
      });
    }
  }

  const pilhaClasses: string[] = [];
  for (const linha of codigo.split(/\r?\n/)) {
    const trim = linha.trim();
    const classe = trim.match(/^(?:class|struct)\s+([A-Za-z_]\w*)/);
    if (classe) {
      pilhaClasses.push(classe[1]!);
      continue;
    }
    if (trim.startsWith("};") || trim === "}" || trim === "};") {
      pilhaClasses.pop();
      continue;
    }

    const metodoClasse = trim.match(/^(?:inline\s+|static\s+|virtual\s+|constexpr\s+)*(?:[\w:<>~*&]+\s+)+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:const)?\s*\{/);
    if (metodoClasse && pilhaClasses.length > 0) {
      const nomeClasse = pilhaClasses[pilhaClasses.length - 1]!;
      const nomeMetodo = metodoClasse[1]!;
      if (!["if", "for", "while", "switch"].includes(nomeMetodo)) {
        const simbolo = `${nomeClasse}.${nomeMetodo}`;
        if (!simbolos.has(simbolo)) {
          simbolos.set(simbolo, {
            simbolo,
            parametros: extrairParametrosCpp(metodoClasse[2] ?? ""),
          });
        }
      }
    }
  }

  return [...simbolos.values()];
}
