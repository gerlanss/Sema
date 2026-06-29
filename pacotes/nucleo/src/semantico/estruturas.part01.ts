// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.

import type { IsolamentoEfeitoSemantico, PrivilegioEfeitoSemantico } from "./seguranca.js";

import { ehValorLiteralSemantico } from "./estruturas.part02.js";

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
  predicadoCanonico?: string;
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

export const CATEGORIAS_EFEITO = new Set<CategoriaEfeitoSemantico>([
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

export const CRITICIDADES_EFEITO = new Set<CriticidadeEfeitoSemantico>([
  "baixa",
  "media",
  "alta",
  "critica",
]);

export const MAPEAMENTO_EFEITOS_LEGADOS: Record<string, CategoriaEfeitoSemantico> = {
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

export const PREDICADOS_CANONICOS: Record<string, string> = {
  preenchida: "preenchido",
  preenchido: "preenchido",
  valido: "valido",
  valida: "valido",
  validos: "valido",
  validas: "valido",
  nao_vazia: "nao_vazio",
  nao_vazio: "nao_vazio",
  email_valida: "email_valido",
  email_valido: "email_valido",
  numero_valida: "numero_valido",
  numero_valido: "numero_valido",
  positiva: "positivo",
  positivo: "positivo",
  unico: "unico",
  unica: "unico",
  anterior_a: "anterior_a",
  posterior_a: "posterior_a",
  nao_expirada: "nao_expirado",
  nao_expirado: "nao_expirado",
};

export function normalizarPredicadoSemantico(predicado: string): string {
  const normalizado = predicado.trim().toLowerCase();
  return PREDICADOS_CANONICOS[normalizado] ?? normalizado;
}

export const PRIVILEGIOS_EFEITO = new Set<PrivilegioEfeitoSemantico>([
  "leitura",
  "escrita",
  "publicacao",
  "execucao",
  "admin",
  "egress",
]);

export const ISOLAMENTOS_EFEITO = new Set<IsolamentoEfeitoSemantico>([
  "tenant",
  "processo",
  "host",
  "vps",
  "global",
]);

export const OPERADORES_COMPARACAO = new Set(["==", "!=", ">", ">=", "<", "<="]);

export function removerParentesesExternos(texto: string): string {
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

export function dividirNoNivelRaiz(texto: string, operador: " e " | " ou "): string[] {
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

export function criarComparacaoDerivada(
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
    const predicado = correspondenciaMarcador[2]!;
    return {
      tipo: "predicado",
      textoOriginal: normalizado,
      alvo: correspondenciaMarcador[1]!,
      predicado,
      predicadoCanonico: normalizarPredicadoSemantico(predicado),
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
    const predicado = correspondenciaPredicado[2]!;
    return {
      tipo: "predicado",
      textoOriginal: normalizado,
      alvo: correspondenciaPredicado[1]!,
      predicado,
      predicadoCanonico: normalizarPredicadoSemantico(predicado),
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
