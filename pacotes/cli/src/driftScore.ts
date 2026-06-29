// SEMA-GOVERNED: sema.drift
// Descricao: politica de pontuacao semantica para drift; consulte contratos/sema/drift.sema antes de editar.

import type { SemaConfigProjeto } from "./projetoTipos.js";
import type { NivelConfiancaSemantica } from "@sema/nucleo";

export const PONTUACAO_SEMANTICA_MINIMA_OPERACIONAL = 80;
export const PONTUACAO_SEMANTICA_ALVO_FINAL = 100;
export const PASSO_EVOLUCAO_PONTUACAO_SEMANTICA = 0.5;

export interface PoliticaPontuacaoSemantica {
  minimaOperacional: number;
  alvoAtual: number;
  alvoFinal: number;
  passoEvolucao: number;
}

export interface AvaliacaoPontuacaoSemantica {
  pontuacaoMinimaOperacional: number;
  pontuacaoAlvoAtual: number;
  pontuacaoAlvoFinal: number;
  passoEvolucaoPontuacao: number;
  proximaPontuacaoAlvo: number;
  pontuacaoAbaixoDoPiso: boolean;
  pontuacaoAbaixoDoAlvo: boolean;
  travasPontuacao: string[];
  confiancaGeral: NivelConfiancaSemantica;
}

function normalizarPontuacao(valor: unknown, padrao: number): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return padrao;
  }
  return Math.max(0, Math.min(PONTUACAO_SEMANTICA_ALVO_FINAL, Math.round(valor * 10) / 10));
}

function normalizarPasso(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    return PASSO_EVOLUCAO_PONTUACAO_SEMANTICA;
  }
  return Math.max(0.1, Math.min(10, Math.round(valor * 10) / 10));
}

export function resolverPoliticaPontuacaoSemantica(config?: SemaConfigProjeto): PoliticaPontuacaoSemantica {
  const minimaOperacional = normalizarPontuacao(
    config?.pontuacaoSemanticaMinimaOperacional,
    PONTUACAO_SEMANTICA_MINIMA_OPERACIONAL,
  );
  const alvoFinal = Math.max(minimaOperacional, normalizarPontuacao(config?.pontuacaoSemanticaAlvoFinal, PONTUACAO_SEMANTICA_ALVO_FINAL));
  const alvoAtual = Math.max(
    minimaOperacional,
    Math.min(alvoFinal, normalizarPontuacao(config?.pontuacaoSemanticaAlvo, minimaOperacional)),
  );
  return {
    minimaOperacional,
    alvoAtual,
    alvoFinal,
    passoEvolucao: normalizarPasso(config?.pontuacaoSemanticaPasso),
  };
}

export function avaliarPontuacaoSemantica(scoreMedio: number, politica: PoliticaPontuacaoSemantica): AvaliacaoPontuacaoSemantica {
  const score = normalizarPontuacao(scoreMedio, 0);
  const pontuacaoAbaixoDoPiso = score < politica.minimaOperacional;
  const pontuacaoAbaixoDoAlvo = score < politica.alvoAtual;
  const baseProxima = score >= politica.alvoAtual ? Math.max(score, politica.alvoAtual) + politica.passoEvolucao : politica.alvoAtual;
  const proximaPontuacaoAlvo = Math.min(politica.alvoFinal, Math.round(baseProxima * 10) / 10);
  const travasPontuacao = pontuacaoAbaixoDoPiso
    ? ["pontuacao_semantica_abaixo_do_piso_operacional"]
    : pontuacaoAbaixoDoAlvo
      ? ["pontuacao_semantica_abaixo_do_alvo_evolutivo"]
      : [];
  const confiancaGeral: NivelConfiancaSemantica = score >= politica.alvoAtual
    ? "alta"
    : score >= 55
      ? "media"
      : "baixa";

  return {
    pontuacaoMinimaOperacional: politica.minimaOperacional,
    pontuacaoAlvoAtual: politica.alvoAtual,
    pontuacaoAlvoFinal: politica.alvoFinal,
    passoEvolucaoPontuacao: politica.passoEvolucao,
    proximaPontuacaoAlvo,
    pontuacaoAbaixoDoPiso,
    pontuacaoAbaixoDoAlvo,
    travasPontuacao,
    confiancaGeral,
  };
}
