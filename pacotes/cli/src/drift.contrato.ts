// SEMA-GOVERNED: sema.drift
// Descricao: helpers contratuais pequenos para o drift Sema; consulte contratos/sema/drift.sema antes de editar.

import { avaliarPontuacaoSemantica, resolverPoliticaPontuacaoSemantica } from "./driftScore.js";

export interface ImplementacaoDriftParseada {
  origem: string;
  caminho: string;
  valido: boolean;
}

export interface SimboloDriftIndexado {
  caminho: string;
  arquivo?: string;
  simbolo?: string;
}

export function parsearImplementacaoDrift(textoBruto: string): ImplementacaoDriftParseada {
  const [origem, caminho] = textoBruto.split(":");
  return {
    origem: (origem ?? "").trim().toUpperCase(),
    caminho: (caminho ?? "").trim(),
    valido: Boolean(origem && caminho),
  };
}

export function matchearImplDrift(
  implDeclarado: ImplementacaoDriftParseada,
  simbolosCodigoVivo: SimboloDriftIndexado[],
): { matchou: boolean; confianca: "ALTA" | "MEDIA" | "BAIXA"; candidato: SimboloDriftIndexado | null } {
  const candidato = simbolosCodigoVivo.find((simbolo) => simbolo.caminho === implDeclarado.caminho) ?? null;
  return {
    matchou: Boolean(candidato),
    confianca: candidato ? "ALTA" : "BAIXA",
    candidato,
  };
}

export function executarDriftCheck(
  contratos: string[],
  codigoVivo: string[],
): {
  impls_validos: number;
  impls_quebrados: number;
  vinculos_validos: number;
  vinculos_quebrados: number;
  vinculos_fora_do_escopo: number;
  score: number;
  piso_operacional: number;
  alvo_atual: number;
  proximo_alvo: number;
  bloqueado_por_pontuacao: boolean;
  travas_pontuacao: string[];
} {
  const implsValidos = Math.min(contratos.length, codigoVivo.length);
  const implsQuebrados = Math.max(0, contratos.length - implsValidos);
  const vinculosValidos = implsValidos;
  const vinculosQuebrados = implsQuebrados;
  const total = Math.max(1, contratos.length);
  const score = Math.round((implsValidos / total) * 100);
  const avaliacao = avaliarPontuacaoSemantica(score, resolverPoliticaPontuacaoSemantica());
  return {
    impls_validos: implsValidos,
    impls_quebrados: implsQuebrados,
    vinculos_validos: vinculosValidos,
    vinculos_quebrados: vinculosQuebrados,
    vinculos_fora_do_escopo: 0,
    score,
    piso_operacional: avaliacao.pontuacaoMinimaOperacional,
    alvo_atual: avaliacao.pontuacaoAlvoAtual,
    proximo_alvo: avaliacao.proximaPontuacaoAlvo,
    bloqueado_por_pontuacao: avaliacao.travasPontuacao.length > 0,
    travas_pontuacao: avaliacao.travasPontuacao,
  };
}
