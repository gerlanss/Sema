// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.indice, sema.produto.governanca_ia.contexto.drift_pack, sema.produto.governanca_ia.contexto.entrypoint_pack
// Descrição: prova que os pacotes compactos preservam evidência necessária e descartam contexto redundante de forma determinística.
import assert from "node:assert/strict";
import test from "node:test";
import { criarEntrypointPack } from "../../pacotes/cli/src/entrypointPack.js";
import { criarGuiaCapacidadeIa, criarAgentContextPack } from "../../pacotes/cli/src/agentContextPack.js";
import { criarDriftPack } from "../../pacotes/cli/src/driftPack.js";
import { selecionarIndiceContexto } from "../../pacotes/cli/src/indexPack.js";
import type { ResultadoDrift } from "../../pacotes/cli/src/drift.part01.js";
import { validarSintaxeInvocacaoPublica } from "../../pacotes/cli/src/cliGrammar.js";

test("index-pack seleciona módulos relacionados e não envia o índice bruto", () => {
  const pacote = selecionarIndiceContexto({
    request: "cancelar agendamento",
    baseProject: "C:/projeto",
    sourceIndexChars: 40_000,
    modulos: [
      {
        arquivo: "agenda.sema",
        modulo: "app.agenda",
        faz: "gerencia agendamentos e cancelamentos",
        tarefasPrincipais: ["cancelar_agendamento", "criar_agendamento"],
        regrasCriticas: ["cancelamento deve registrar motivo"],
        efeitos: ["persistir cancelamento"],
        riscosPrincipais: ["dupla reserva"],
        lacunas: [],
        arquivosProvaveis: ["src/agenda.ts"],
        arquivosProvaveisEditar: ["src/agenda.ts"],
        checksSugeridos: ["validar cancelamento"],
        testesMinimos: ["cancelamento"],
      },
      {
        arquivo: "financeiro.sema",
        modulo: "app.financeiro",
        faz: "concilia pagamentos",
        tarefasPrincipais: ["conciliar_pagamento"],
        regrasCriticas: [],
        efeitos: [],
        riscosPrincipais: [],
        lacunas: [],
        arquivosProvaveis: ["src/financeiro.ts"],
        arquivosProvaveisEditar: [],
        checksSugeridos: [],
        testesMinimos: [],
      },
    ],
  });
  assert.equal(pacote.schema, "sema.ai.index-pack/v1");
  assert.equal(pacote.authority.rawIndexForwarded, false);
  assert.equal(pacote.matches.length, 1);
  assert.equal(pacote.matches[0]?.module, "app.agenda");
  assert.ok(pacote.telemetry.reductionPercent > 0);
});

test("drift-pack preserva trava e divergência, omitindo somente detalhes válidos", () => {
  const resultado = {
    sucesso: false,
    escopo_aplicado: { escopo: "arquivo", cache: { modo: "fresh" } },
    modulos: [{ caminho: "x.sema", modulo: "app.x", tasks: 1, routes: 0 }],
    tasks: [{ modulo: "app.x", task: "salvar", impls: 1, implsValidos: 0, implsQuebrados: 1, semImplementacao: false, scoreSemantico: 70, confiancaVinculo: "media", riscoOperacional: "alto", lacunas: ["impl quebrada"], arquivosProvaveisEditar: ["src/x.ts"], checksSugeridos: ["verificar"] }],
    impls_validos: [{ modulo: "app.x", task: "ler", origem: "ts", caminho: "src/x.ts", status: "resolvido" }],
    impls_quebrados: [{ modulo: "app.x", task: "salvar", origem: "ts", caminho: "src/x.ts", status: "quebrado" }],
    vinculos_validos: [],
    vinculos_quebrados: [{ modulo: "app.x", donoTipo: "task", dono: "salvar", tipo: "arquivo", valor: "src/x.ts", status: "nao_encontrado", confianca: "baixa" }],
    vinculos_fora_do_escopo: [],
    rotas_divergentes: [],
    recursos_validos: [],
    recursos_divergentes: [],
    persistencia_real: [],
    resumo_operacional: {
      scoreMedio: 70, confiancaGeral: "media", pontuacaoAbaixoDoPiso: true, pontuacaoAbaixoDoAlvo: true,
      travasPontuacao: ["impl quebrada"], riscosPrincipais: ["salvar não rastreável"], oQueTocar: ["src/x.ts"],
      oQueValidar: ["sema verificar"], oQueEstaFrouxo: ["vínculo"], oQueFoiInferido: [],
    },
    diagnosticos: [{ tipo: "impl_quebrado", modulo: "app.x", task: "salvar", severidade: "erro", mensagem: "símbolo ausente" }],
  } as unknown as ResultadoDrift;
  const pacote = criarDriftPack(resultado, { rawDriftChars: 20_000 });
  assert.equal(pacote.schema, "sema.ai.drift-pack/v1");
  assert.equal(pacote.authority.rawDriftForwarded, false);
  assert.equal(pacote.counts.brokenImplementations, 1);
  assert.equal(pacote.blockers.implementations[0]?.task, "salvar");
  assert.equal(pacote.blockers.links[0]?.status, "nao_encontrado");
  assert.ok(pacote.telemetry.reductionPercent > 0);
});

test("entrypoint-pack preserva a política da capacidade escolhida sem duplicar o pack inteiro", () => {
  const agentContextPack = criarAgentContextPack(criarGuiaCapacidadeIa());
  const pacote = criarEntrypointPack({ agentContextPack, capacity: "media", rawAgentContextChars: 40_000 });
  assert.equal(pacote.schema, "sema.ai.entrypoint-pack/v1");
  assert.equal(pacote.capacity, "media");
  assert.match(pacote.context.policies.governedCode, /SEMA-GOVERNED/);
  assert.ok(pacote.context.failClosed.length > 0);
  assert.equal(pacote.authority.rawAgentContextForwarded, false);
  assert.ok(pacote.telemetry.reductionPercent > 0);
});

test("flags compactas são aceitas somente nas combinações governadas", () => {
  assert.equal(validarSintaxeInvocacaoPublica(["resumo", ".", "--pacote", "--somente-pacote", "--pedido", "cancelar", "--json"]).dispatchPermitido, true);
  assert.equal(validarSintaxeInvocacaoPublica(["drift", ".", "--pacote", "--json"]).dispatchPermitido, true);
  assert.equal(validarSintaxeInvocacaoPublica(["contexto-ia", "x.sema", "--pacote", "--capacidade", "media", "--json"]).dispatchPermitido, true);
  assert.throws(() => validarSintaxeInvocacaoPublica(["resumo", ".", "--somente-pacote", "--json"]));
  assert.throws(() => validarSintaxeInvocacaoPublica(["contexto-ia", "x.sema", "--capacidade", "inventada", "--json"]));
});
