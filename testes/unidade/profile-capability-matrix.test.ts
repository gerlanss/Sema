// SEMA-GOVERNED: sema.produto.governanca_ia.release_profiles + sema.produto.descoberta_capacidades
// Descrição: separa profiles validáveis de workflows especializados na view legada.

import assert from "node:assert/strict";
import test from "node:test";
import {
  criarPayloadCapabilityMatrix,
  renderizarCapabilityMatrixTexto,
} from "../../pacotes/cli/src/profileCommand.js";

test("profile capabilities não anuncia Author como profile validável", () => {
  const payload = criarPayloadCapabilityMatrix();
  assert.equal(payload.profiles.some((profile) => profile.profile === "author"), false);
  assert.deepEqual(payload.workflowsEspecializados, [{
    id: "workflow.author",
    comando: "sema author <subcomando>",
    resumo: "Workflow narrativo especializado; não é um profile validável.",
  }]);
  assert.equal(payload.resumo.profiles, payload.profiles.length);
  assert.equal(payload.resumo.workflowsEspecializados, 1);

  const texto = renderizarCapabilityMatrixTexto(payload);
  assert.match(texto, /SPECIALIZED_WORKFLOWS/u);
  assert.match(texto, /workflow\.author/u);
  assert.doesNotMatch(texto, /^- author: confianca=/mu);
});

