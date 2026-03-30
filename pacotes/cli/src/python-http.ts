export interface FuncaoPythonDecorada {
  nome: string;
  parametros: string;
  retorno?: string;
  indentacao: number;
  decorators: string[];
}

export interface ParametroRotaFlask {
  nome: string;
  conversor?: string;
}

export interface RotaFlaskDecorada {
  nomeFuncao: string;
  parametros: string;
  retorno?: string;
  metodo: string;
  caminho: string;
}

function contarParenteses(texto: string): number {
  let saldo = 0;
  let quote: "'" | '"' | undefined;
  let escapando = false;

  for (const caractere of texto) {
    if (escapando) {
      escapando = false;
      continue;
    }

    if (caractere === "\\") {
      escapando = true;
      continue;
    }

    if (quote) {
      if (caractere === quote) {
        quote = undefined;
      }
      continue;
    }

    if (caractere === "'" || caractere === '"') {
      quote = caractere;
      continue;
    }

    if (caractere === "(") {
      saldo += 1;
      continue;
    }

    if (caractere === ")") {
      saldo -= 1;
    }
  }

  return saldo;
}

export function contarIndentacaoPython(linha: string): number {
  let total = 0;
  for (const caractere of linha) {
    if (caractere === " ") {
      total += 1;
      continue;
    }
    if (caractere === "\t") {
      total += 4;
      continue;
    }
    break;
  }
  return total;
}

function juntarCaminhoHttp(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base ?? "", sufixo ?? ""]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\/+|\/+$/g, ""));

  const caminho = `/${partes.join("/")}`.replace(/\/+/g, "/");
  return caminho === "//" ? "/" : caminho;
}

function detectarBlueprintsFlask(texto: string): Map<string, string | undefined> {
  const blueprints = new Map<string, string | undefined>();
  const linhas = texto.split(/\r?\n/);
  let atual: { nome: string; linhas: string[]; saldo: number } | undefined;

  const finalizar = () => {
    if (!atual) {
      return;
    }
    const conteudo = atual.linhas.join(" ");
    const prefixo = conteudo.match(/\burl_prefix\s*=\s*["']([^"']+)["']/)?.[1];
    blueprints.set(atual.nome, prefixo);
    atual = undefined;
  };

  for (const linha of linhas) {
    const trim = linha.trim();
    if (!trim || trim.startsWith("#")) {
      continue;
    }

    if (atual) {
      atual.linhas.push(trim);
      atual.saldo += contarParenteses(trim);
      if (atual.saldo <= 0) {
        finalizar();
      }
      continue;
    }

    const inicio = trim.match(/^([A-Za-z_]\w*)\s*=\s*Blueprint\s*\(/);
    if (!inicio) {
      continue;
    }

    atual = {
      nome: inicio[1]!,
      linhas: [trim],
      saldo: contarParenteses(trim),
    };

    if (atual.saldo <= 0) {
      finalizar();
    }
  }

  finalizar();
  return blueprints;
}

export function extrairFuncoesPythonDecoradas(texto: string): FuncaoPythonDecorada[] {
  const funcoes: FuncaoPythonDecorada[] = [];
  const linhas = texto.split(/\r?\n/);
  let decoratorsPendentes: string[] = [];
  let decoratorAtual: { linhas: string[]; saldo: number } | undefined;

  const finalizarDecorator = () => {
    if (!decoratorAtual) {
      return;
    }
    decoratorsPendentes.push(decoratorAtual.linhas.join(" ").replace(/\s+/g, " ").trim());
    decoratorAtual = undefined;
  };

  for (const linha of linhas) {
    const trim = linha.trim();
    const indentacao = contarIndentacaoPython(linha);

    if (decoratorAtual) {
      decoratorAtual.linhas.push(trim);
      decoratorAtual.saldo += contarParenteses(trim);
      if (decoratorAtual.saldo <= 0) {
        finalizarDecorator();
      }
      continue;
    }

    if (!trim || trim.startsWith("#")) {
      continue;
    }

    if (trim.startsWith("@")) {
      decoratorAtual = {
        linhas: [trim],
        saldo: contarParenteses(trim),
      };
      if (decoratorAtual.saldo <= 0) {
        finalizarDecorator();
      }
      continue;
    }

    const definicao = trim.match(/^(?:async\s+def|def)\s+([A-Za-z_]\w*)\s*\((.*)\)(?:\s*->\s*([^:]+))?:\s*(?:#.*)?$/);
    if (definicao) {
      funcoes.push({
        nome: definicao[1]!,
        parametros: definicao[2] ?? "",
        retorno: definicao[3]?.trim(),
        indentacao,
        decorators: decoratorsPendentes,
      });
      decoratorsPendentes = [];
      continue;
    }

    decoratorsPendentes = [];
  }

  return funcoes;
}

function extrairMetodosFlask(decorator: string): string[] {
  const blocoMethods = decorator.match(/\bmethods\s*=\s*\[([^\]]*)\]/i)?.[1];
  if (!blocoMethods) {
    return ["GET"];
  }

  const encontrados = [...blocoMethods.matchAll(/["']([A-Za-z]+)["']/g)]
    .map((match) => match[1]!.toUpperCase())
    .filter((metodo) => ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(metodo));

  return [...new Set(encontrados)];
}

export function normalizarCaminhoFlask(caminho: string): string {
  return caminho.replace(/<(?:(\w+):)?([A-Za-z_]\w*)>/g, "{$2}");
}

export function extrairParametrosCaminhoFlask(caminho: string): ParametroRotaFlask[] {
  return [...caminho.matchAll(/<(?:(\w+):)?([A-Za-z_]\w*)>/g)].map((match) => ({
    conversor: match[1] ?? undefined,
    nome: match[2]!,
  }));
}

export function extrairRotasFlaskDecoradas(texto: string): RotaFlaskDecorada[] {
  const blueprints = detectarBlueprintsFlask(texto);
  const rotas: RotaFlaskDecorada[] = [];

  for (const funcao of extrairFuncoesPythonDecoradas(texto)) {
    if (funcao.indentacao > 0) {
      continue;
    }

    for (const decorator of funcao.decorators) {
      const match = decorator.match(/^@([A-Za-z_]\w*)\.route\(([\s\S]*)\)$/);
      if (!match) {
        continue;
      }

      const alvo = match[1]!;
      const argumentos = match[2] ?? "";
      const sufixo = argumentos.match(/["']([^"']+)["']/)?.[1];
      const prefixo = alvo === "app" ? undefined : blueprints.get(alvo);
      const metodos = extrairMetodosFlask(decorator);

      for (const metodo of metodos) {
        rotas.push({
          nomeFuncao: funcao.nome,
          parametros: funcao.parametros,
          retorno: funcao.retorno,
          metodo,
          caminho: normalizarCaminhoFlask(juntarCaminhoHttp(prefixo, sufixo)),
        });
      }
    }
  }

  return rotas;
}
