// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: prova que the score weighs verified behavior above declared presence.

import test from "node:test";
import assert from "node:assert/strict";
import { calcularScoreTask, resumirLacunasTask } from "../../pacotes/cli/src/drift.part04.js";
import type { IrTask } from "@sema/nucleo";

function taskBase(overrides: Partial<IrTask> = {}): IrTask {
  return {
    nome: "criar_produto",
    implementacoesExternas: [{ origem: "ts", caminho: "src.produtos.criarProduto" }],
    vinculos: [],
    guarantees: [],
    execucao: { explicita: true },
    ...overrides,
  } as unknown as IrTask;
}

const guardrails = {
  publica: true,
  sensivel: false,
  auth: true,
  authz: true,
  dados: true,
  audit: true,
  segredos: false,
  forbidden: true,
  dadosSensiveis: false,
  efeitoPrivilegiado: false,
  exigeSegredos: false,
};

test("evidencia de testes verificados soma pontos no score sem regredir declarativos", () => {
  const task = taskBase();
  const semEvidencia = calcularScoreTask(task, 1, 0, 1, 0, false);
  const comEvidencia = calcularScoreTask(task, 1, 0, 1, 0, false, {
    sucesso: true,
    quantidadeTestes: 4,
    alvo: "typescript",
  });
  const evidenciaSemTeste = calcularScoreTask(task, 1, 0, 1, 0, false, {
    sucesso: true,
    quantidadeTestes: 0,
    alvo: "typescript",
  });
  const evidenciaComFalha = calcularScoreTask(task, 1, 0, 1, 0, false, {
    sucesso: false,
    quantidadeTestes: 4,
    alvo: "typescript",
  });

  assert.equal(comEvidencia - semEvidencia, 8);
  assert.equal(evidenciaSemTeste, semEvidencia);
  assert.equal(evidenciaComFalha, semEvidencia);
  assert.ok(comEvidencia <= 100);
});

test("task publica com impl e sem verificacao ganha lacuna sem_evidencia_verificada", () => {
  const task = taskBase();
  const semEvidencia = resumirLacunasTask(task, false, 0, 0, guardrails);
  const comEvidencia = resumirLacunasTask(task, false, 0, 0, guardrails, {
    sucesso: true,
    quantidadeTestes: 2,
    alvo: "typescript",
  });

  assert.ok(semEvidencia.includes("sem_evidencia_verificada"));
  assert.ok(!comEvidencia.includes("sem_evidencia_verificada"));
});

test("task sem implementacao nao ganha lacuna de evidencia", () => {
  const task = taskBase({ implementacoesExternas: [] });
  const lacunas = resumirLacunasTask(task, true, 0, 0, guardrails);
  assert.ok(!lacunas.includes("sem_evidencia_verificada"));
});
