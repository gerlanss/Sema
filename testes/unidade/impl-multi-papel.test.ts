// SEMA-GOVERNED: sema.produto.dsl_impl
// Descricao: prova impl multi-papel por camada no nucleo e no IR.

import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo } from "../../pacotes/nucleo/dist/index.js";

const CONTRATO_BASE = (impl: string) => `module exemplo.impl {
  entity Item {
    fields {
      id: Id
    }
  }
  task criar_item {
    input {
      nome: Texto required
    }
    output {
      item: Item
    }
    guarantees {
      item existe
    }
    impl {
      ${impl}
    }
  }
}
`;

test("impl multi-papel valida e preserva cada papel no IR", () => {
  const codigo = CONTRATO_BASE([
    "ts_rota: server.routes.itens.criarItem",
    "ts_servico: server.services.itens.criarItem",
    "ts_persistencia: server.repositories.itens.criar",
  ].join("\n      "));
  const resultado = compilarCodigo(codigo, "contrato-multi-papel.sema");

  assert.equal(resultado.diagnosticos.filter((diagnostico) => diagnostico.severidade === "erro").length, 0);
  const implementacoes = resultado.ir!.tasks[0]!.implementacoesExternas;
  assert.equal(implementacoes.length, 3);
  assert.deepEqual(
    implementacoes.map((impl) => `${impl.origem}:${impl.papel ?? "-"}`),
    ["ts:rota", "ts:servico", "ts:persistencia"],
  );
});

test("impl nu continua valido e compativel", () => {
  const resultado = compilarCodigo(CONTRATO_BASE("ts: server.services.itens.criarItem"), "contrato-impl-nu.sema");

  assert.equal(resultado.diagnosticos.filter((diagnostico) => diagnostico.severidade === "erro").length, 0);
  assert.equal(resultado.ir!.tasks[0]!.implementacoesExternas[0]!.papel, undefined);
});

test("combinacao duplicada de origem e papel e rejeitada", () => {
  const codigo = CONTRATO_BASE([
    "ts: server.a.criar",
    "ts: server.b.criar",
  ].join("\n      "));
  const resultado = compilarCodigo(codigo, "contrato-duplicado.sema");

  const sem060 = resultado.diagnosticos.find((diagnostico) => diagnostico.codigo === "SEM060");
  assert.ok(sem060, "esperava SEM060 para impl ts duplicado");
});

test("papel fora do catalogo e rejeitado com SEM059", () => {
  const resultado = compilarCodigo(CONTRATO_BASE("ts_banana: server.a.criar"), "contrato-papel-invalido.sema");

  const sem059 = resultado.diagnosticos.find((diagnostico) => diagnostico.codigo === "SEM059");
  assert.ok(sem059, "esperava SEM059 para papel invalido");
  assert.equal(resultado.ir!.tasks[0]!.implementacoesExternas.length, 0);
});
