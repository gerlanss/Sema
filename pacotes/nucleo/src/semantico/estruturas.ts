import type { IsolamentoEfeitoSemantico, PrivilegioEfeitoSemantico } from "./seguranca.js";

export type TipoExpressaoSemantica = "existe" | "comparacao" | "predicado" | "pertencimento" | "composta" | "negacao";
export type CategoriaEfeitoSemantico =
  | "persistencia"
  | "consulta"
  | "evento"
  | "notificacao"
  | "auditoria"
  | "db.read"
  | "db.write"
  | "queue.publish"
  | "queue.consume"
  | "fs.read"
  | "fs.write"
  | "network.egress"
  | "secret.read"
  | "shell.exec";
export type CriticidadeEfeitoSemantico = "baixa" | "media" | "alta" | "critica";

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
  valorLiteral?: boolean;
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
  categoria: CategoriaEfeitoSemantico;
  alvo: string;
  detalhe?: string;
  criticidade?: CriticidadeEfeitoSemantico;
  criticidadeTexto?: string;
  privilegio?: PrivilegioEfeitoSemantico;
  privilegioTexto?: string;
  isolamento?: IsolamentoEfeitoSemantico;
  isolamentoTexto?: string;
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
  mapeamentos: Array<{ campo: string; valor: string }>;
  emSucesso?: string;
  emErro?: string;
  porErro: Array<{ tipo: string; destino: string }>;
}

export interface ContratoErroRouteSemantico {
  nome: string;
  codigo: string;
  mensagem?: string;
}

export interface ContratoRouteSemantico {
  metodo?: string;
  caminho?: string;
  task?: string;
  inputPublico: Array<{ nome: string; tipo: string; modificadores: string[] }>;
  outputPublico: Array<{ nome: string; tipo: string; modificadores: string[] }>;
  errosPublicos: ContratoErroRouteSemantico[];
  effectsPublicos: EfeitoSemantico[];
}

const CATEGORIAS_EFEITO = new Set<CategoriaEfeitoSemantico>([
  "persistencia",
  "consulta",
  "evento",
  "notificacao",
  "auditoria",
  "db.read",
  "db.write",
  "queue.publish",
  "queue.consume",
  "fs.read",
  "fs.write",
  "network.egress",
  "secret.read",
  "shell.exec",
]);

const CRITICIDADES_EFEITO = new Set<CriticidadeEfeitoSemantico>([
  "baixa",
  "media",
  "alta",
  "critica",
]);

const MAPEAMENTO_EFEITOS_LEGADOS: Record<string, CategoriaEfeitoSemantico> = {
  grava: "persistencia",
  atualiza: "persistencia",
  persiste: "persistencia",
  consulta: "consulta",
  le: "consulta",
  acessa: "consulta",
  emite: "evento",
  notifica: "notificacao",
  envia: "notificacao",
  registra: "auditoria",
  audita: "auditoria",
};

const PRIVILEGIOS_EFEITO = new Set<PrivilegioEfeitoSemantico>([
  "leitura",
  "escrita",
  "publicacao",
  "execucao",
  "admin",
  "egress",
]);

const ISOLAMENTOS_EFEITO = new Set<IsolamentoEfeitoSemantico>([
  "tenant",
  "processo",
  "host",
  "vps",
  "global",
]);

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

function criarComparacaoDerivada(
  base: ExpressaoComparacaoSemantica,
  valor: string,
): ExpressaoComparacaoSemantica | undefined {
  const valorNormalizado = removerParentesesExternos(valor.trim());
  if (!valorNormalizado) {
    return undefined;
  }

  return {
    tipo: "comparacao",
    textoOriginal: `${base.alvo} ${base.operador} ${valorNormalizado}`,
    alvo: base.alvo,
    operador: base.operador,
    valor: valorNormalizado,
    valorLiteral: ehValorLiteralSemantico(valorNormalizado),
  };
}

export function parsearExpressaoSemantica(texto: string): ExpressaoSemantica | undefined {
  const normalizado = removerParentesesExternos(texto.trim());
  if (!normalizado) {
    return undefined;
  }

  const partesOu = dividirNoNivelRaiz(normalizado, " ou ");
  if (partesOu.length > 1) {
    const termos: ExpressaoSemantica[] = [];
    let comparacaoBase: ExpressaoComparacaoSemantica | undefined;
    let usouAtalhoComparacao = false;

    for (const parte of partesOu) {
      const termo = parsearExpressaoSemantica(parte);
      if (termo) {
        termos.push(termo);
        if (termo.tipo === "comparacao" && (termo.operador === "==" || termo.operador === "!=")) {
          comparacaoBase = termo;
        }
        continue;
      }

      if (comparacaoBase) {
        const derivada = criarComparacaoDerivada(comparacaoBase, parte);
        if (derivada) {
          comparacaoBase.valorLiteral = true;
          usouAtalhoComparacao = true;
          termos.push(derivada);
          continue;
        }
      }

      return undefined;
    }

    if (usouAtalhoComparacao) {
      for (const termo of termos) {
        if (termo.tipo === "comparacao" && termo.alvo === comparacaoBase?.alvo && termo.operador === comparacaoBase?.operador) {
          termo.valorLiteral = true;
        }
      }
    }

    return { tipo: "composta", textoOriginal: normalizado, operadorLogico: "ou", termos };
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
    const valorComparacao = partes.slice(2).join(" ");
    return {
      tipo: "comparacao",
      textoOriginal: normalizado,
      alvo: partes[0]!,
      operador: partes[1] as ExpressaoComparacaoSemantica["operador"],
      valor: valorComparacao,
      valorLiteral: ehValorLiteralSemantico(valorComparacao),
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

  const partesSemCriticidade = [...partes];
  let criticidadeTexto: string | undefined;
  let privilegioTexto: string | undefined;
  let isolamentoTexto: string | undefined;

  const extrairQualificador = (nome: string): string | undefined => {
    const indiceInline = partesSemCriticidade.findIndex((parte) => parte.startsWith(`${nome}=`));
    if (indiceInline !== -1) {
      const valor = partesSemCriticidade[indiceInline]!.slice(`${nome}=`.length).trim();
      partesSemCriticidade.splice(indiceInline, 1);
      return valor;
    }

    const indiceSeparado = partesSemCriticidade.findIndex((parte) => parte === nome);
    if (
      indiceSeparado !== -1
      && partesSemCriticidade[indiceSeparado + 1] === "="
      && partesSemCriticidade[indiceSeparado + 2]
    ) {
      const valor = partesSemCriticidade[indiceSeparado + 2]!.trim();
      partesSemCriticidade.splice(indiceSeparado, 3);
      return valor;
    }

    return undefined;
  };

  criticidadeTexto = extrairQualificador("criticidade");
  privilegioTexto = extrairQualificador("privilegio");
  isolamentoTexto = extrairQualificador("isolamento");

  if (partesSemCriticidade.length < 2) {
    return undefined;
  }

  const categoriaNormalizada = partesSemCriticidade[0] as CategoriaEfeitoSemantico;
  const criticidade = criticidadeTexto && CRITICIDADES_EFEITO.has(criticidadeTexto as CriticidadeEfeitoSemantico)
    ? criticidadeTexto as CriticidadeEfeitoSemantico
    : undefined;
  const privilegio = privilegioTexto && PRIVILEGIOS_EFEITO.has(privilegioTexto as PrivilegioEfeitoSemantico)
    ? privilegioTexto as PrivilegioEfeitoSemantico
    : undefined;
  const isolamento = isolamentoTexto && ISOLAMENTOS_EFEITO.has(isolamentoTexto as IsolamentoEfeitoSemantico)
    ? isolamentoTexto as IsolamentoEfeitoSemantico
    : undefined;
  if (CATEGORIAS_EFEITO.has(categoriaNormalizada)) {
    return {
      textoOriginal: normalizado,
      categoria: categoriaNormalizada,
      alvo: partesSemCriticidade[1]!,
      detalhe: partesSemCriticidade.slice(2).join(" ").trim() || undefined,
      criticidade,
      criticidadeTexto,
      privilegio,
      privilegioTexto,
      isolamento,
      isolamentoTexto,
    };
  }

  const categoriaLegada = MAPEAMENTO_EFEITOS_LEGADOS[partesSemCriticidade[0]!.toLowerCase()];
  if (categoriaLegada) {
    return {
      textoOriginal: normalizado,
      categoria: categoriaLegada,
      alvo: partesSemCriticidade[1]!,
      detalhe: partesSemCriticidade.slice(2).join(" ").trim() || undefined,
      criticidade,
      criticidadeTexto,
      privilegio,
      privilegioTexto,
      isolamento,
      isolamentoTexto,
    };
  }

  return {
    textoOriginal: normalizado,
    categoria: partesSemCriticidade[0]! as CategoriaEfeitoSemantico,
    alvo: partesSemCriticidade[1]!,
    detalhe: partesSemCriticidade.slice(2).join(" ").trim() || undefined,
    criticidade,
    criticidadeTexto,
    privilegio,
    privilegioTexto,
    isolamento,
    isolamentoTexto,
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
  const comTexto = resto.match(/\bcom\s+(.+?)(?=\s+(quando|depende_de|em_sucesso|em_erro|por_erro)\b|$)/)?.[1];
  const dependenciasTexto = resto.match(/\bdepende_de\s+(.+?)(?=\s+(quando|com|em_sucesso|em_erro|por_erro)\b|$)/)?.[1];
  const dependencias = dependenciasTexto
    ? dependenciasTexto.split(",").map((parte) => parte.trim()).filter(Boolean)
    : [];
  const emSucesso = resto.match(/\bem_sucesso\s+([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
  const emErro = resto.match(/\bem_erro\s+([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
  const porErroTexto = resto.match(/\bpor_erro\s+(.+?)(?=\s+(quando|depende_de|em_sucesso|em_erro)\b|$)/)?.[1];
  const mapeamentos = (comTexto
    ? comTexto.split(",").map((parte) => parte.trim()).filter(Boolean)
    : [])
    .map((parte) => {
      const [campo, ...restoValor] = parte.split("=");
      return {
        campo: campo?.trim() ?? "",
        valor: restoValor.join("=").trim(),
      };
    })
    .filter((item) => item.campo && item.valor);
  const porErro = (porErroTexto
    ? porErroTexto.split(",").map((parte) => parte.trim()).filter(Boolean)
    : [])
    .map((parte) => {
      const [tipo, ...restoDestino] = parte.split("=");
      return {
        tipo: tipo?.trim() ?? "",
        destino: restoDestino.join("=").trim(),
      };
    })
    .filter((item) => item.tipo && item.destino);

  const indiceQuando = resto.indexOf(" quando ");
  const indicesTerminoCondicao = [
    resto.indexOf(" depende_de "),
    resto.indexOf(" em_sucesso "),
    resto.indexOf(" em_erro "),
    resto.indexOf(" por_erro "),
  ].filter((indice) => indice !== -1 && indice > indiceQuando);
  let condicao: ExpressaoSemantica | undefined;
  if (indiceQuando !== -1) {
    const fimCondicao = indicesTerminoCondicao.length > 0 ? Math.min(...indicesTerminoCondicao) : resto.length;
    const textoCondicao = resto.slice(indiceQuando + " quando ".length, fimCondicao).trim();
    condicao = parsearExpressaoSemantica(textoCondicao);
  }

  return {
    textoOriginal: normalizado,
    nome,
    task,
    condicao,
    dependencias,
    mapeamentos,
    emSucesso,
    emErro,
    porErro,
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

  if (
    expressao.tipo === "comparacao"
    && expressao.valor
    && !expressao.valorLiteral
    && pareceReferenciaSemantica(expressao.valor)
  ) {
    referencias.push(expressao.valor);
  }

  return referencias;
}

export function pareceReferenciaSemantica(valor: string): boolean {
  const normalizado = valor.trim();
  if (!normalizado) {
    return false;
  }

  if (ehValorLiteralSemantico(normalizado)) {
    return false;
  }

  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(normalizado);
}

function ehValorLiteralSemantico(valor: string): boolean {
  const normalizado = valor.trim();
  if (!normalizado) {
    return false;
  }

  if (
    (normalizado.startsWith("\"") && normalizado.endsWith("\""))
    || (normalizado.startsWith("'") && normalizado.endsWith("'"))
  ) {
    return true;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(normalizado)) {
    return true;
  }

  if (["verdadeiro", "falso", "nulo"].includes(normalizado)) {
    return true;
  }

  return /^[A-Z][A-Z0-9_]*$/.test(normalizado);
}

export function ehCategoriaEfeitoSemantico(valor: string): valor is CategoriaEfeitoSemantico {
  return CATEGORIAS_EFEITO.has(valor as CategoriaEfeitoSemantico);
}

export function ehCriticidadeEfeitoSemantico(valor: string): valor is CriticidadeEfeitoSemantico {
  return CRITICIDADES_EFEITO.has(valor as CriticidadeEfeitoSemantico);
}
