// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: extracao PHP para drift/importacao; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

export interface ParametroRotaPhp {
  nome: string;
  tipoSema: "Texto" | "Inteiro" | "Decimal" | "Id";
}

export interface SimboloPhpExtraido {
  simbolo: string;
  aliases?: string[];
  retorno?: string;
  parametros: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

export interface RotaPhpExtraida {
  origem: "php";
  metodo: string;
  caminho: string;
  simbolo: string;
  parametros: ParametroRotaPhp[];
  retorno?: string;
}

const METODOS_HTTP = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function contarChar(texto: string, alvo: string): number {
  return [...texto].filter((char) => char === alvo).length;
}

function limparStringPhp(valor: string | undefined): string | undefined {
  const limpo = (valor ?? "").trim();
  if (!limpo) {
    return undefined;
  }
  if ((limpo.startsWith("\"") && limpo.endsWith("\"")) || (limpo.startsWith("'") && limpo.endsWith("'"))) {
    return limpo.slice(1, -1);
  }
  return limpo;
}

function normalizarCaminhoPhp(caminho: string): string {
  const limpo = caminho
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/:([A-Za-z_]\w*)/g, "{$1}")
    .replace(/\{([^}:?]+)\??(?::[^}]+)?\}/g, "{$1}");
  return `/${limpo}`.replace(/\/+/g, "/");
}

function juntarCaminhoPhp(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base, sufixo]
    .map((parte) => (parte ?? "").trim())
    .filter(Boolean)
    .map((parte) => parte.replace(/^\/+|\/+$/g, ""));
  return normalizarCaminhoPhp(partes.join("/"));
}

function mapearTipoPhp(tipo?: string): ParametroRotaPhp["tipoSema"] {
  const normalizado = (tipo ?? "").toLowerCase().replace(/^[?\\]+/, "");
  if (/^(int|integer)$/.test(normalizado)) {
    return "Inteiro";
  }
  if (/^(float|double|decimal)$/.test(normalizado)) {
    return "Decimal";
  }
  if (/uuid|id$/.test(normalizado)) {
    return "Id";
  }
  return "Texto";
}

function extrairParametrosPhp(assinatura: string): Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }> {
  return assinatura.split(",").map((parametroBruto) => {
    const parametro = parametroBruto.trim();
    if (!parametro) {
      return undefined;
    }
    const semPadrao = parametro.split("=")[0]?.trim() ?? parametro;
    const nome = semPadrao.match(/\$([A-Za-z_]\w*)/)?.[1];
    if (!nome) {
      return undefined;
    }
    const tipoTexto = semPadrao
      .slice(0, semPadrao.indexOf(`$${nome}`))
      .replace(/\b(?:public|protected|private|readonly|static)\b/g, "")
      .replace(/[&.]{1,3}/g, "")
      .trim() || undefined;
    return {
      nome,
      tipoTexto,
      obrigatorio: !parametro.includes("=") && !tipoTexto?.startsWith("?"),
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function extrairParametrosRotaPhp(caminho: string, assinatura: string): ParametroRotaPhp[] {
  const assinaturaMap = new Map<string, string>();
  for (const parametro of extrairParametrosPhp(assinatura)) {
    assinaturaMap.set(parametro.nome, parametro.tipoTexto ?? "");
  }
  return [...normalizarCaminhoPhp(caminho).matchAll(/\{([^}]+)\}/g)].map((match) => {
    const nome = match[1]!;
    return {
      nome,
      tipoSema: mapearTipoPhp(assinaturaMap.get(nome)),
    };
  });
}

function removerComentariosBloco(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "");
}

interface ClassePhpAberta {
  nome: string;
  profundidade: number;
  rotaBase?: string;
}

interface AtributoRoutePhp {
  caminho: string;
  metodos: string[];
}

function extrairAtributoRoutePhp(linha: string): AtributoRoutePhp | undefined {
  const match = linha.match(/#\[\s*Route\s*\(([\s\S]+)\)\s*\]/i);
  if (!match) {
    return undefined;
  }
  const corpo = match[1]!;
  const caminho = limparStringPhp(corpo.match(/(?:path\s*:\s*)?(['"][^'"]+['"])/i)?.[1]);
  if (!caminho) {
    return undefined;
  }
  const metodos = [...corpo.matchAll(/['"](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)['"]/gi)]
    .map((item) => item[1]!.toUpperCase())
    .filter((metodo) => METODOS_HTTP.has(metodo));
  return {
    caminho,
    metodos: metodos.length > 0 ? [...new Set(metodos)] : ["GET"],
  };
}

function extrairTargetLaravel(bloco: string): string | undefined {
  const arrayController = bloco.match(/([A-Za-z_][\\A-Za-z0-9_]*)::class\s*,\s*['"]([A-Za-z_]\w*)['"]/);
  if (arrayController) {
    const classe = arrayController[1]!.split("\\").at(-1)!;
    return `${classe}.${arrayController[2]!}`;
  }

  const stringController = bloco.match(/['"]([A-Za-z_][\\A-Za-z0-9_]*)@([A-Za-z_]\w*)['"]/);
  if (stringController) {
    const classe = stringController[1]!.split("\\").at(-1)!;
    return `${classe}.${stringController[2]!}`;
  }

  const invokable = bloco.match(/([A-Za-z_][\\A-Za-z0-9_]*)::class/);
  if (invokable) {
    const classe = invokable[1]!.split("\\").at(-1)!;
    return `${classe}.__invoke`;
  }

  const closure = bloco.match(/function\s*\(/);
  if (closure) {
    return "closure";
  }

  return undefined;
}

function assinaturaFuncaoPhp(linha: string): RegExpMatchArray | null {
  return linha.match(/^(?:(?:public|protected|private|static|final|abstract|readonly)\s+)*function\s+&?\s*([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?::\s*([?\\A-Za-z_][\\A-Za-z0-9_|?]*))?/);
}

function namespaceParaCaminhoPhp(namespace: string | undefined): string | undefined {
  const limpo = namespace?.trim().replace(/\\+/g, ".");
  return limpo || undefined;
}

function variantesNamespacePhp(namespace: string | undefined, classe: string, metodo: string): string[] {
  const base = namespaceParaCaminhoPhp(namespace);
  if (!base) {
    return [];
  }
  const caminho = `${base}.${classe}.${metodo}`;
  const partes = caminho.split(".");
  const primeiroMinusculo = partes.length > 0
    ? [partes[0]!.toLowerCase(), ...partes.slice(1)].join(".")
    : caminho;
  return [...new Set([caminho, primeiroMinusculo])];
}

export function extrairSimbolosPhp(codigo: string): SimboloPhpExtraido[] {
  const simbolos = new Map<string, SimboloPhpExtraido>();
  const linhas = removerComentariosBloco(codigo).split(/\r?\n/);
  const pilhaClasses: ClassePhpAberta[] = [];
  let profundidade = 0;
  let namespaceAtual: string | undefined;

  for (const linhaOriginal of linhas) {
    const linha = linhaOriginal.trim();
    if (!linha || linha.startsWith("//") || linha.startsWith("#")) {
      profundidade += contarChar(linhaOriginal, "{") - contarChar(linhaOriginal, "}");
      continue;
    }

    const namespace = linha.match(/^namespace\s+([^;{]+)\s*[;{]/);
    if (namespace) {
      namespaceAtual = namespace[1]!.trim();
    }

    const classe = linha.match(/\b(?:class|trait)\s+([A-Za-z_]\w*)/);
    const classeSemChaveNaLinha = Boolean(classe && !linhaOriginal.includes("{"));
    if (classe) {
      pilhaClasses.push({ nome: classe[1]!, profundidade: profundidade + 1 });
    }

    const funcao = assinaturaFuncaoPhp(linha);
    if (funcao) {
      const nome = funcao[1]!;
      if (!["__construct", "__destruct"].includes(nome)) {
        const classeAtual = pilhaClasses[pilhaClasses.length - 1];
        const simbolo = classeAtual ? `${classeAtual.nome}.${nome}` : nome;
        simbolos.set(simbolo, {
          simbolo,
          aliases: classeAtual ? variantesNamespacePhp(namespaceAtual, classeAtual.nome, nome) : [],
          retorno: funcao[3]?.trim(),
          parametros: extrairParametrosPhp(funcao[2] ?? ""),
        });
      }
    }

    profundidade += contarChar(linhaOriginal, "{") - contarChar(linhaOriginal, "}");
    while (!classeSemChaveNaLinha && pilhaClasses.length > 0 && profundidade < pilhaClasses[pilhaClasses.length - 1]!.profundidade) {
      pilhaClasses.pop();
    }
  }

  return [...simbolos.values()];
}

export function extrairRotasPhp(codigo: string): RotaPhpExtraida[] {
  const rotas = new Map<string, RotaPhpExtraida>();
  const texto = removerComentariosBloco(codigo);

  for (const match of texto.matchAll(/\b(?:Route::|\$?[A-Za-z_]\w*->)(get|post|put|patch|delete|head|options)\s*\(\s*(['"][^'"]+['"])\s*,\s*([\s\S]*?)\)\s*;/gi)) {
    const metodo = match[1]!.toUpperCase();
    if (!METODOS_HTTP.has(metodo)) {
      continue;
    }
    const caminho = normalizarCaminhoPhp(limparStringPhp(match[2]!) ?? "/");
    const simbolo = extrairTargetLaravel(match[3] ?? "") ?? metodo.toLowerCase();
    rotas.set(`${metodo}:${caminho}:${simbolo}`, {
      origem: "php",
      metodo,
      caminho,
      simbolo,
      parametros: extrairParametrosRotaPhp(caminho, ""),
    });
  }

  const linhas = texto.split(/\r?\n/);
  const pilhaClasses: ClassePhpAberta[] = [];
  let atributoPendente: AtributoRoutePhp | undefined;
  let profundidade = 0;

  for (const linhaOriginal of linhas) {
    const linha = linhaOriginal.trim();
    const atributo = extrairAtributoRoutePhp(linha);
    if (atributo) {
      atributoPendente = atributo;
      continue;
    }

    const classe = linha.match(/\b(?:class|trait)\s+([A-Za-z_]\w*)/);
    const classeSemChaveNaLinha = Boolean(classe && !linhaOriginal.includes("{"));
    if (classe) {
      pilhaClasses.push({
        nome: classe[1]!,
        profundidade: profundidade + 1,
        rotaBase: atributoPendente?.caminho,
      });
      atributoPendente = undefined;
    }

    const funcao = assinaturaFuncaoPhp(linha);
    if (funcao && atributoPendente) {
      const classeAtual = pilhaClasses[pilhaClasses.length - 1];
      const nome = funcao[1]!;
      const simbolo = classeAtual ? `${classeAtual.nome}.${nome}` : nome;
      const caminho = juntarCaminhoPhp(classeAtual?.rotaBase, atributoPendente.caminho);
      for (const metodo of atributoPendente.metodos) {
        rotas.set(`${metodo}:${caminho}:${simbolo}`, {
          origem: "php",
          metodo,
          caminho,
          simbolo,
          parametros: extrairParametrosRotaPhp(caminho, funcao[2] ?? ""),
          retorno: funcao[3]?.trim(),
        });
      }
      atributoPendente = undefined;
    } else if (funcao) {
      atributoPendente = undefined;
    }

    profundidade += contarChar(linhaOriginal, "{") - contarChar(linhaOriginal, "}");
    while (!classeSemChaveNaLinha && pilhaClasses.length > 0 && profundidade < pilhaClasses[pilhaClasses.length - 1]!.profundidade) {
      pilhaClasses.pop();
    }
  }

  return [...rotas.values()];
}
