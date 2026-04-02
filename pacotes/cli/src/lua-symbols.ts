export interface SimboloLuaExtraido {
  simbolo: string;
  parametros: Array<{ nome: string; obrigatorio: boolean }>;
}

function limparLinhaLua(linha: string): string {
  return linha.replace(/--.*$/, "").trim();
}

function contarOcorrencias(texto: string, padrao: RegExp): number {
  return texto.match(padrao)?.length ?? 0;
}

function contarAberturasLua(linha: string): number {
  let total = contarOcorrencias(linha, /\bfunction\b/g) + contarOcorrencias(linha, /\brepeat\b/g);
  if (/\bif\b[\s\S]*\bthen\b/.test(linha)) {
    total += 1;
  }
  if (/\b(?:for|while)\b[\s\S]*\bdo\b/.test(linha)) {
    total += 1;
  }
  if (/^\s*do\b/.test(linha)) {
    total += 1;
  }
  return total;
}

function contarFechamentosLua(linha: string): number {
  return contarOcorrencias(linha, /\bend\b/g) + contarOcorrencias(linha, /\buntil\b/g);
}

function extrairParametrosLua(parametros: string): Array<{ nome: string; obrigatorio: boolean }> {
  return parametros
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== "self" && item !== "...")
    .map((nome) => ({ nome, obrigatorio: true }));
}

function normalizarSimboloLua(simbolo: string): string {
  return simbolo.replace(/:/g, ".");
}

export function extrairSimbolosLua(codigo: string): SimboloLuaExtraido[] {
  const simbolos = new Map<string, SimboloLuaExtraido>();
  let profundidade = 0;

  for (const linhaBruta of codigo.split(/\r?\n/)) {
    const linha = limparLinhaLua(linhaBruta);
    if (!linha) {
      continue;
    }

    if (profundidade === 0) {
      const definicaoDireta = linha.match(/^(?:local\s+)?function\s+([A-Za-z_]\w*(?:[.:][A-Za-z_]\w*)*)\s*\(([^)]*)\)/);
      if (definicaoDireta) {
        const simbolo = normalizarSimboloLua(definicaoDireta[1]!);
        simbolos.set(simbolo, {
          simbolo,
          parametros: extrairParametrosLua(definicaoDireta[2] ?? ""),
        });
      }

      const atribuicao = linha.match(/^(?:local\s+)?([A-Za-z_]\w*(?:[.:][A-Za-z_]\w*)*)\s*=\s*function\s*\(([^)]*)\)/);
      if (atribuicao) {
        const simbolo = normalizarSimboloLua(atribuicao[1]!);
        if (!simbolos.has(simbolo)) {
          simbolos.set(simbolo, {
            simbolo,
            parametros: extrairParametrosLua(atribuicao[2] ?? ""),
          });
        }
      }
    }

    profundidade += contarAberturasLua(linha) - contarFechamentosLua(linha);
    if (profundidade < 0) {
      profundidade = 0;
    }
  }

  return [...simbolos.values()];
}
