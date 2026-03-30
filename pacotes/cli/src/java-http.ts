export interface ParametroRotaJava {
  nome: string;
  tipoSema: "Texto" | "Inteiro" | "Decimal" | "Id";
}

export interface SimboloJavaExtraido {
  simbolo: string;
  retorno?: string;
  parametros: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

export interface RotaJavaExtraida {
  origem: "java";
  metodo: string;
  caminho: string;
  simbolo: string;
  parametros: ParametroRotaJava[];
  retorno?: string;
}

const METODOS_HTTP = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function contarChar(texto: string, alvo: string): number {
  return [...texto].filter((char) => char === alvo).length;
}

function juntarCaminho(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base, sufixo]
    .map((parte) => (parte ?? "").trim())
    .filter(Boolean)
    .map((parte) => parte.replace(/^\/+|\/+$/g, ""));
  return `/${partes.join("/")}`.replace(/\/+/g, "/");
}

function extrairParametrosAssinaturaJava(assinatura: string): Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }> {
  return assinatura.split(",").map((parametroBruto) => {
    const parametro = parametroBruto.trim();
    if (!parametro) {
      return undefined;
    }
    const limpo = parametro.replace(/^@\w+(?:\([^)]*\))?\s*/g, "").trim();
    const partes = limpo.split(/\s+/).filter(Boolean);
    if (partes.length < 2) {
      return undefined;
    }
    return {
      nome: partes.at(-1)!,
      tipoTexto: partes.slice(0, -1).join(" "),
      obrigatorio: true,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function mapearTipoJava(tipo?: string): ParametroRotaJava["tipoSema"] {
  const normalizado = (tipo ?? "").toLowerCase();
  if (/(^|\.)(int|integer|long|short)$/.test(normalizado)) {
    return "Inteiro";
  }
  if (/(^|\.)(float|double|bigdecimal|decimal)$/.test(normalizado)) {
    return "Decimal";
  }
  if (/uuid|id$/i.test(normalizado)) {
    return "Id";
  }
  return "Texto";
}

function extrairAtributosJava(linhas: string[], inicio: number): { atributos: string[]; proximoIndice: number } {
  const atributos: string[] = [];
  let indice = inicio;

  while (indice < linhas.length) {
    const linha = linhas[indice]!.trim();
    if (!linha.startsWith("@")) {
      break;
    }
    let atual = linha;
    let saldo = contarChar(linha, "(") - contarChar(linha, ")");
    while (saldo > 0 && indice + 1 < linhas.length) {
      indice += 1;
      const complemento = linhas[indice]!.trim();
      atual += ` ${complemento}`;
      saldo += contarChar(complemento, "(") - contarChar(complemento, ")");
    }
    atributos.push(atual);
    indice += 1;
  }

  return { atributos, proximoIndice: indice };
}

function extrairCaminhoJava(atributo: string): string | undefined {
  return atributo.match(/"([^"]+)"/)?.[1];
}

function extrairMetodosJava(atributo: string): string[] {
  const direto = atributo.match(/@(Get|Post|Put|Patch|Delete)Mapping/i)?.[1]?.toUpperCase();
  if (direto && METODOS_HTTP.has(direto)) {
    return [direto];
  }

  const requestMethod = [...atributo.matchAll(/RequestMethod\.(GET|POST|PUT|PATCH|DELETE)/gi)]
    .map((match) => match[1]!.toUpperCase())
    .filter((metodo) => METODOS_HTTP.has(metodo));
  if (requestMethod.length > 0) {
    return [...new Set(requestMethod)];
  }
  return [];
}

function normalizarCaminhoJava(caminho: string): string {
  return caminho.replace(/\{([^}:]+):[^}]+\}/g, "{$1}").replace(/\/+/g, "/");
}

function extrairParametrosRotaJava(caminho: string, assinatura: string): ParametroRotaJava[] {
  const assinaturaMap = new Map<string, string>();
  for (const parametro of extrairParametrosAssinaturaJava(assinatura)) {
    assinaturaMap.set(parametro.nome, parametro.tipoTexto ?? "");
  }
  return [...caminho.matchAll(/\{([^}:]+)(?::[^}]+)?\}/g)].map((match) => {
    const nome = match[1]!;
    return {
      nome,
      tipoSema: mapearTipoJava(assinaturaMap.get(nome)),
    };
  });
}

export function extrairSimbolosJava(codigo: string): SimboloJavaExtraido[] {
  const simbolos = new Map<string, SimboloJavaExtraido>();
  const linhas = codigo.split(/\r?\n/);
  const pilhaClasses: Array<{ nome: string; profundidade: number }> = [];
  let profundidade = 0;

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const linhaOriginal = linhas[indice]!;
    const { atributos, proximoIndice } = extrairAtributosJava(linhas, indice);
    if (atributos.length > 0) {
      indice = proximoIndice;
    }
    const linha = (linhas[indice] ?? linhaOriginal).trim();
    if (!linha || linha.startsWith("//")) {
      profundidade += contarChar(linhaOriginal, "{") - contarChar(linhaOriginal, "}");
      while (pilhaClasses.length > 0 && profundidade < pilhaClasses[pilhaClasses.length - 1]!.profundidade) {
        pilhaClasses.pop();
      }
      continue;
    }

    const classe = linha.match(/\bclass\s+([A-Za-z_]\w*)/);
    if (classe) {
      pilhaClasses.push({ nome: classe[1]!, profundidade: profundidade + 1 });
      profundidade += contarChar(linha, "{") - contarChar(linha, "}");
      while (pilhaClasses.length > 0 && profundidade < pilhaClasses[pilhaClasses.length - 1]!.profundidade) {
        pilhaClasses.pop();
      }
      continue;
    }

    const metodo = linha.match(/\b(?:public|protected|private)\s+(?:static\s+|final\s+|synchronized\s+)*([A-Za-z0-9_<>,.?[\]\s]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (metodo) {
      const classeAtual = pilhaClasses[pilhaClasses.length - 1];
      const simbolo = classeAtual ? `${classeAtual.nome}.${metodo[2]!}` : metodo[2]!;
      simbolos.set(simbolo, {
        simbolo,
        retorno: metodo[1]!.trim(),
        parametros: extrairParametrosAssinaturaJava(metodo[3]!),
      });
    }

    profundidade += contarChar(linha, "{") - contarChar(linha, "}");
    while (pilhaClasses.length > 0 && profundidade < pilhaClasses[pilhaClasses.length - 1]!.profundidade) {
      pilhaClasses.pop();
    }
  }

  return [...simbolos.values()];
}

export function extrairRotasJava(codigo: string): RotaJavaExtraida[] {
  const rotas = new Map<string, RotaJavaExtraida>();
  const linhas = codigo.split(/\r?\n/);
  const pilhaClasses: Array<{ nome: string; profundidade: number; rotaBase?: string; rest: boolean }> = [];
  let profundidade = 0;

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const linhaOriginal = linhas[indice]!;
    const { atributos, proximoIndice } = extrairAtributosJava(linhas, indice);
    if (atributos.length > 0) {
      indice = proximoIndice;
    }
    const linha = (linhas[indice] ?? linhaOriginal).trim();
    if (!linha || linha.startsWith("//")) {
      profundidade += contarChar(linhaOriginal, "{") - contarChar(linhaOriginal, "}");
      while (pilhaClasses.length > 0 && profundidade < pilhaClasses[pilhaClasses.length - 1]!.profundidade) {
        pilhaClasses.pop();
      }
      continue;
    }

    const classe = linha.match(/\bclass\s+([A-Za-z_]\w*)/);
    if (classe) {
      const rotaBase = atributos
        .filter((atributo) => /@RequestMapping/i.test(atributo))
        .map((atributo) => extrairCaminhoJava(atributo))
        .find(Boolean);
      pilhaClasses.push({
        nome: classe[1]!,
        profundidade: profundidade + 1,
        rotaBase,
        rest: atributos.some((atributo) => /@RestController/i.test(atributo)),
      });
      profundidade += contarChar(linha, "{") - contarChar(linha, "}");
      while (pilhaClasses.length > 0 && profundidade < pilhaClasses[pilhaClasses.length - 1]!.profundidade) {
        pilhaClasses.pop();
      }
      continue;
    }

    const classeAtual = pilhaClasses[pilhaClasses.length - 1];
    const metodo = linha.match(/\b(?:public|protected)\s+(?:static\s+|final\s+)*([A-Za-z0-9_<>,.?[\]\s]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (classeAtual && metodo) {
      for (const atributo of atributos.filter((item) => /@(Get|Post|Put|Patch|Delete)Mapping|@RequestMapping/i.test(item))) {
        const metodos = extrairMetodosJava(atributo);
        const caminho = normalizarCaminhoJava(juntarCaminho(classeAtual.rotaBase, extrairCaminhoJava(atributo)));
        for (const httpMetodo of metodos) {
          const registro: RotaJavaExtraida = {
            origem: "java",
            metodo: httpMetodo,
            caminho,
            simbolo: `${classeAtual.nome}.${metodo[2]!}`,
            parametros: extrairParametrosRotaJava(caminho, metodo[3] ?? ""),
            retorno: metodo[1]!.trim(),
          };
          rotas.set(`${registro.metodo}:${registro.caminho}:${registro.simbolo}`, registro);
        }
      }
    }

    profundidade += contarChar(linha, "{") - contarChar(linha, "}");
    while (pilhaClasses.length > 0 && profundidade < pilhaClasses[pilhaClasses.length - 1]!.profundidade) {
      pilhaClasses.pop();
    }
  }

  return [...rotas.values()];
}
