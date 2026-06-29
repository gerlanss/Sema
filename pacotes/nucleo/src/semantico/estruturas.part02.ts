// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.

import type { IsolamentoEfeitoSemantico, PrivilegioEfeitoSemantico } from "./seguranca.js";

import { CATEGORIAS_EFEITO, CRITICIDADES_EFEITO, CategoriaEfeitoSemantico, CriticidadeEfeitoSemantico, EfeitoSemantico, EtapaFlowSemantica, ExpressaoSemantica, ISOLAMENTOS_EFEITO, MAPEAMENTO_EFEITOS_LEGADOS, PRIVILEGIOS_EFEITO, TransicaoEstadoSemantica, parsearExpressaoSemantica } from "./estruturas.part01.js";

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

export function ehValorLiteralSemantico(valor: string): boolean {
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
