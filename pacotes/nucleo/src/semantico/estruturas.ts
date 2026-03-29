export type TipoExpressaoSemantica = "existe" | "comparacao" | "predicado" | "pertencimento" | "composta" | "negacao";

export interface ExpressaoBaseSemantica {
  tipo: TipoExpressaoSemantica;
  textoOriginal: string;
}

export interface ExpressaoExisteSemantica extends ExpressaoBaseSemantica {
  tipo: "existe";
  alvo: string;
}

export interface ExpressaoComparacaoSemantica extends ExpressaoBaseSemantica {
  tipo: "comparacao";
  alvo: string;
  operador: "==" | "!=" | ">" | ">=" | "<" | "<=";
  valor: string;
}

export interface ExpressaoPredicadoSemantica extends ExpressaoBaseSemantica {
  tipo: "predicado";
  alvo: string;
  predicado: string;
  argumentos?: string;
}

export interface ExpressaoPertencimentoSemantica extends ExpressaoBaseSemantica {
  tipo: "pertencimento";
  alvo: string;
  valores: string[];
}

export interface ExpressaoCompostaSemantica extends ExpressaoBaseSemantica {
  tipo: "composta";
  operadorLogico: "e" | "ou";
  termos: ExpressaoSemantica[];
}

export interface ExpressaoNegacaoSemantica extends ExpressaoBaseSemantica {
  tipo: "negacao";
  termo: ExpressaoSemantica;
}

export type ExpressaoSemantica =
  | ExpressaoExisteSemantica
  | ExpressaoComparacaoSemantica
  | ExpressaoPredicadoSemantica
  | ExpressaoPertencimentoSemantica
  | ExpressaoCompostaSemantica
  | ExpressaoNegacaoSemantica;

export interface EfeitoSemantico {
  textoOriginal: string;
  acao: string;
  alvo: string;
  complemento?: string;
}

export interface TransicaoEstadoSemantica {
  textoOriginal: string;
  origem: string;
  destino: string;
}

export interface EtapaFlowSemantica {
  textoOriginal: string;
  nome: string;
  task?: string;
  condicao?: ExpressaoSemantica;
  dependencias: string[];
}

const OPERADORES_COMPARACAO = new Set(["==", "!=", ">", ">=", "<", "<="]);

function removerParentesesExternos(texto: string): string {
  let atual = texto.trim();
  while (atual.startsWith("(") && atual.endsWith(")")) {
    let profundidade = 0;
    let removeu = true;
    for (let indice = 0; indice < atual.length; indice += 1) {
      const caractere = atual[indice]!;
      if (caractere === "(") {
        profundidade += 1;
      } else if (caractere === ")") {
        profundidade -= 1;
        if (profundidade === 0 && indice < atual.length - 1) {
          removeu = false;
          break;
        }
      }
    }

    if (!removeu) {
      break;
    }
    atual = atual.slice(1, -1).trim();
  }

  return atual;
}

function dividirNoNivelRaiz(texto: string, operador: " e " | " ou "): string[] {
  const partes: string[] = [];
  let profundidade = 0;
  let inicio = 0;

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caractere = texto[indice]!;
    if (caractere === "(") {
      profundidade += 1;
      continue;
    }
    if (caractere === ")") {
      profundidade -= 1;
      continue;
    }
    if (profundidade === 0 && texto.slice(indice, indice + operador.length) === operador) {
      partes.push(texto.slice(inicio, indice).trim());
      inicio = indice + operador.length;
      indice += operador.length - 1;
    }
  }

  const ultimaParte = texto.slice(inicio).trim();
  if (ultimaParte) {
    partes.push(ultimaParte);
  }

  return partes;
}

export function parsearExpressaoSemantica(texto: string): ExpressaoSemantica | undefined {
  const normalizado = removerParentesesExternos(texto.trim());
  if (!normalizado) {
    return undefined;
  }

  const partesOu = dividirNoNivelRaiz(normalizado, " ou ");
  if (partesOu.length > 1) {
    const termos = partesOu.map((parte) => parsearExpressaoSemantica(parte)).filter((parte): parte is ExpressaoSemantica => Boolean(parte));
    return termos.length === partesOu.length
      ? { tipo: "composta", textoOriginal: normalizado, operadorLogico: "ou", termos }
      : undefined;
  }

  const partesE = dividirNoNivelRaiz(normalizado, " e ");
  if (partesE.length > 1) {
    const termos = partesE.map((parte) => parsearExpressaoSemantica(parte)).filter((parte): parte is ExpressaoSemantica => Boolean(parte));
    return termos.length === partesE.length
      ? { tipo: "composta", textoOriginal: normalizado, operadorLogico: "e", termos }
      : undefined;
  }

  if (normalizado.startsWith("nao ")) {
    const termo = parsearExpressaoSemantica(normalizado.slice("nao ".length).trim());
    return termo
      ? { tipo: "negacao", textoOriginal: normalizado, termo }
      : undefined;
  }

  const correspondenciaMarcador = normalizado.match(/^(persistencia|estado|sucesso)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
  if (correspondenciaMarcador) {
    return {
      tipo: "predicado",
      textoOriginal: normalizado,
      alvo: correspondenciaMarcador[1]!,
      predicado: correspondenciaMarcador[2]!,
    };
  }

  const correspondenciaExiste = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s+existe$/);
  if (correspondenciaExiste) {
    return {
      tipo: "existe",
      textoOriginal: normalizado,
      alvo: correspondenciaExiste[1]!,
    };
  }

  const correspondenciaPredicado = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s+deve_ser\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(.+))?$/);
  if (correspondenciaPredicado) {
    return {
      tipo: "predicado",
      textoOriginal: normalizado,
      alvo: correspondenciaPredicado[1]!,
      predicado: correspondenciaPredicado[2]!,
      argumentos: correspondenciaPredicado[3]?.trim(),
    };
  }

  const correspondenciaPertencimento = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s+em\s+\[(.+)\]$/);
  if (correspondenciaPertencimento) {
    const valores = correspondenciaPertencimento[2]!
      .split(",")
      .map((valor) => valor.trim())
      .filter(Boolean);
    if (valores.length === 0) {
      return undefined;
    }
    return {
      tipo: "pertencimento",
      textoOriginal: normalizado,
      alvo: correspondenciaPertencimento[1]!,
      valores,
    };
  }

  const partes = normalizado.split(/\s+/).filter(Boolean);
  if (partes.length >= 3 && OPERADORES_COMPARACAO.has(partes[1]!)) {
    return {
      tipo: "comparacao",
      textoOriginal: normalizado,
      alvo: partes[0]!,
      operador: partes[1] as ExpressaoComparacaoSemantica["operador"],
      valor: partes.slice(2).join(" "),
    };
  }

  return undefined;
}

export function parsearEfeitoSemantico(texto: string): EfeitoSemantico | undefined {
  const normalizado = texto.trim();
  if (!normalizado) {
    return undefined;
  }

  const partes = normalizado.split(/\s+/).filter(Boolean);
  if (partes.length < 2) {
    return undefined;
  }

  return {
    textoOriginal: normalizado,
    acao: partes[0]!,
    alvo: partes[1]!,
    complemento: partes.slice(2).join(" ").trim() || undefined,
  };
}

export function parsearTransicaoEstado(texto: string): TransicaoEstadoSemantica | undefined {
  const normalizado = texto.trim();
  if (!normalizado) {
    return undefined;
  }

  const correspondencia = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*->\s*([A-Za-z_][A-Za-z0-9_.]*)$/);
  if (!correspondencia) {
    return undefined;
  }

  return {
    textoOriginal: normalizado,
    origem: correspondencia[1]!,
    destino: correspondencia[2]!,
  };
}

export function parsearEtapaFlow(texto: string): EtapaFlowSemantica | undefined {
  const normalizado = texto.trim();
  if (!normalizado.startsWith("etapa ")) {
    return undefined;
  }

  const semPrefixo = normalizado.slice("etapa ".length).trim();
  const nome = semPrefixo.split(/\s+/)[0];
  if (!nome) {
    return undefined;
  }

  const resto = semPrefixo.slice(nome.length).trim();
  const task = resto.match(/\busa\s+([A-Za-z_][A-Za-z0-9_.]*)/)?.[1];
  const dependenciasTexto = resto.match(/\bdepende_de\s+([A-Za-z0-9_.,\s]+)/)?.[1];
  const dependencias = dependenciasTexto
    ? dependenciasTexto.split(",").map((parte) => parte.trim()).filter(Boolean)
    : [];

  const indiceQuando = resto.indexOf(" quando ");
  const indiceDepende = resto.indexOf(" depende_de ");
  let condicao: ExpressaoSemantica | undefined;
  if (indiceQuando !== -1) {
    const fimCondicao = indiceDepende !== -1 && indiceDepende > indiceQuando ? indiceDepende : resto.length;
    const textoCondicao = resto.slice(indiceQuando + " quando ".length, fimCondicao).trim();
    condicao = parsearExpressaoSemantica(textoCondicao);
  }

  return {
    textoOriginal: normalizado,
    nome,
    task,
    condicao,
    dependencias,
  };
}

export function extrairReferenciasDaExpressao(expressao: ExpressaoSemantica): string[] {
  if (expressao.tipo === "composta") {
    return expressao.termos.flatMap(extrairReferenciasDaExpressao);
  }

  if (expressao.tipo === "negacao") {
    return extrairReferenciasDaExpressao(expressao.termo);
  }

  const referencias = [expressao.alvo];

  if (expressao.tipo === "comparacao" && expressao.valor && pareceReferenciaSemantica(expressao.valor)) {
    referencias.push(expressao.valor);
  }

  return referencias;
}

export function pareceReferenciaSemantica(valor: string): boolean {
  const normalizado = valor.trim();
  if (!normalizado) {
    return false;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(normalizado)) {
    return false;
  }

  if (["verdadeiro", "falso", "nulo"].includes(normalizado)) {
    return false;
  }

  if (/^[A-Z][A-Z0-9_]*$/.test(normalizado)) {
    return false;
  }

  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(normalizado);
}
