// SEMA-GOVERNED: sema.drift
// Descricao: testes da politica de pontuacao semantica do drift.

import assert from "node:assert/strict";
import test from "node:test";
import { avaliarPontuacaoSemantica, resolverPoliticaPontuacaoSemantica } from "../../pacotes/cli/src/driftScore.js";

test("pontuacao semantica abaixo de 80 trava o drift", () => {
  const politica = resolverPoliticaPontuacaoSemantica();
  const avaliacao = avaliarPontuacaoSemantica(79.9, politica);

  assert.equal(avaliacao.pontuacaoMinimaOperacional, 80);
  assert.equal(avaliacao.pontuacaoAbaixoDoPiso, true);
  assert.equal(avaliacao.pontuacaoAbaixoDoAlvo, true);
  assert.deepEqual(avaliacao.travasPontuacao, ["pontuacao_semantica_abaixo_do_piso_operacional"]);
  assert.equal(avaliacao.confiancaGeral, "media");
});

test("alvo evolutivo bloqueia abaixo do alvo configurado", () => {
  const politica = resolverPoliticaPontuacaoSemantica({
    pontuacaoSemanticaMinimaOperacional: 80,
    pontuacaoSemanticaAlvo: 85.5,
    pontuacaoSemanticaPasso: 0.5,
  });
  const avaliacao = avaliarPontuacaoSemantica(85, politica);

  assert.equal(avaliacao.pontuacaoAbaixoDoPiso, false);
  assert.equal(avaliacao.pontuacaoAbaixoDoAlvo, true);
  assert.deepEqual(avaliacao.travasPontuacao, ["pontuacao_semantica_abaixo_do_alvo_evolutivo"]);
  assert.equal(avaliacao.confiancaGeral, "media");
});

test("meta recomendada sobe meio ponto ate cem quando o alvo atual passa", () => {
  const politica = resolverPoliticaPontuacaoSemantica({
    pontuacaoSemanticaAlvo: 85,
    pontuacaoSemanticaPasso: 0.5,
  });
  const avaliacao = avaliarPontuacaoSemantica(85, politica);
  const avaliacaoFinal = avaliarPontuacaoSemantica(100, politica);

  assert.equal(avaliacao.travasPontuacao.length, 0);
  assert.equal(avaliacao.confiancaGeral, "alta");
  assert.equal(avaliacao.proximaPontuacaoAlvo, 85.5);
  assert.equal(avaliacaoFinal.proximaPontuacaoAlvo, 100);
});
