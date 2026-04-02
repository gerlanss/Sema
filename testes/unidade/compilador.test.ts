import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";

test("compilador gera AST e IR para task valida", () => {
  const codigo = `
module exemplo.valido {
  task eco {
    input {
      mensagem: Texto required
    }
    output {
      mensagem: Texto
    }
    guarantees {
      mensagem existe
    }
    tests {
      caso "eco simples" {
        given {
          mensagem: "oi"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;
  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.modulo?.nome, "exemplo.valido");
  assert.equal(resultado.ir?.tasks[0]?.nome, "eco");
});

test("compilador acusa ausencia de guarantees", () => {
  const codigo = `
module exemplo.invalido {
  task eco {
    input {
      mensagem: Texto required
    }
    output {
      mensagem: Texto
    }
  }
}
`;
  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM005"));
});

test("compilador aceita atalho de comparacao multi-valor em rules", () => {
  const codigo = `
module exemplo.rules.multi_valor {
  task notificar {
    input {
      canal: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      canal == "sms" ou "email"
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          canal: "sms"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  const regra = resultado.ir?.tasks[0]?.regrasEstruturadas[0];
  assert.equal(regra?.tipo, "composta");
  if (regra?.tipo === "composta") {
    assert.equal(regra.termos.length, 2);
    assert.equal(regra.termos[0]?.tipo, "comparacao");
    assert.equal(regra.termos[1]?.tipo, "comparacao");
  }
});

test("compilador orienta mover validacao de input para rules quando ela aparece em guarantees", () => {
  const codigo = `
module exemplo.guarantees.input {
  task autenticar {
    input {
      metodo: Texto required
    }
    output {
      token: Texto
    }
    guarantees {
      metodo existe
    }
    tests {
      caso "ok" {
        given {
          metodo: "sms"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  const diagnostico = resultado.diagnosticos.find((item) => item.codigo === "SEM031");
  assert.ok(diagnostico);
  assert.match(diagnostico.dica ?? "", /mova isso para rules/);
});

test("compilador valida route, flow e state no MVP atual", () => {
  const codigo = `
module exemplo.rotas {
  state status_execucao {
    etapa: Texto
  }

  task criar_item {
    input {
      nome: Texto required
    }
    output {
      item_id: Id
    }
    guarantees {
      item_id existe
    }
    tests {
      caso "cria item" {
        given {
          nome: "ok"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  flow cadastro {
    task: criar_item
    recebe_nome
    grava_item
  }

  route itens {
    metodo: POST
    caminho: /itens
    task: criar_item
    input {
      nome: Texto
    }
    output {
      item_id: Id
    }
  }
}
`;
  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.flows[0]?.tasksReferenciadas[0], "criar_item");
  assert.equal(resultado.ir?.routes[0]?.metodo, "POST");
  assert.equal(resultado.ir?.routes[0]?.inputPublico[0]?.nome, "nome");
  assert.equal(resultado.ir?.routes[0]?.outputPublico[0]?.nome, "item_id");
  assert.equal(resultado.ir?.states[0]?.nome, "status_execucao");
});

test("compilador rejeita route invalida", () => {
  const codigo = `
module exemplo.route.invalida {
  task criar_item {
    input {
      nome: Texto required
    }
    output {
      item_id: Id
    }
    guarantees {
      item_id existe
    }
    tests {
      caso "ok" {
        given {
          nome: "a"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route itens {
    metodo: FETCH
    caminho: itens
    task: task_inexistente
  }
}
`;
  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM016"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM017"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM018"));
});

test("compilador resolve use entre multiplos modulos do projeto", () => {
  const tipos = `
module base.tipos {
  entity Usuario {
    fields {
      id: Id
      nome: Texto
    }
  }

  task buscar_usuario {
    input {
      id: Id required
    }
    output {
      usuario: Usuario
    }
    guarantees {
      usuario existe
    }
    tests {
      caso "busca usuario" {
        given {
          id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const app = `
module app.cadastro {
  use base.tipos

  task registrar_acesso {
    input {
      usuario: Usuario required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "registra acesso" {
        given {
          usuario: "u-1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  flow consulta {
    task: buscar_usuario
    task: registrar_acesso
  }
}
`;

  const resultado = compilarProjeto([
    { caminho: "base.sema", codigo: tipos },
    { caminho: "app.sema", codigo: app },
  ]);

  assert.equal(temErros(resultado.diagnosticos), false);
  const moduloApp = resultado.modulos.find((modulo) => modulo.modulo?.nome === "app.cadastro");
  assert.ok(moduloApp?.ir);
  assert.deepEqual(moduloApp.ir?.uses, ["base.tipos"]);
  assert.deepEqual(moduloApp.ir?.flows[0]?.tasksReferenciadas, ["buscar_usuario", "registrar_acesso"]);
});

test("compilador acusa use para modulo inexistente", () => {
  const codigo = `
module app.invalido {
  use base.inexistente

  task eco {
    input {
      mensagem: Texto required
    }
    output {
      mensagem: Texto
    }
    guarantees {
      mensagem existe
    }
    tests {
      caso "eco" {
        given {
          mensagem: "oi"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarProjeto([{ caminho: "app.sema", codigo }]);
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM019"));
});

test("compilador resolve use relativo ao namespace atual", () => {
  const dominio = `
module app.ingressos.dominio {
  entity Ingresso {
    fields {
      id: Id
      codigo: Texto
    }
  }
}
`;

  const api = `
module app.ingressos.api {
  use dominio

  task consultar {
    input {
      ingresso: Ingresso required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          ingresso: "ing-1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarProjeto([
    { caminho: "dominio.sema", codigo: dominio },
    { caminho: "api.sema", codigo: api },
  ]);

  assert.equal(temErros(resultado.diagnosticos), false);
  const moduloApi = resultado.modulos.find((modulo) => modulo.modulo?.nome === "app.ingressos.api");
  assert.deepEqual(moduloApi?.ir?.uses, ["app.ingressos.dominio"]);
});

test("compilador aceita interop externo com origens suportadas sem exigir modulo sema local", () => {
  const codigo = `
module app.interop {
  use ts app.gateway.pagamentos
  use py servicos.conciliacao
  use dart app.mobile.pagamentos
  use cs src.Controllers.HealthController
  use java com.acme.health.HealthController
  use go internal.health
  use rust src.handlers.health
  use cpp src.runtime.RuntimeBridge

  task consultar_status {
    input {
      pagamento_id: Id required
    }
    output {
      status: Texto
    }
    guarantees {
      status existe
    }
    tests {
      caso "consulta" {
        given {
          pagamento_id: "p-1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.deepEqual(resultado.ir?.uses, []);
  assert.deepEqual(resultado.ir?.imports.map((item) => `${item.origem}:${item.caminho}`), [
    "ts:app.gateway.pagamentos",
    "py:servicos.conciliacao",
    "dart:app.mobile.pagamentos",
    "cs:src.Controllers.HealthController",
    "java:com.acme.health.HealthController",
    "go:internal.health",
    "rust:src.handlers.health",
    "cpp:src.runtime.RuntimeBridge",
  ]);
  assert.deepEqual(resultado.ir?.interoperabilidades.map((item) => `${item.origem}:${item.caminho}`), [
    "ts:app.gateway.pagamentos",
    "py:servicos.conciliacao",
    "dart:app.mobile.pagamentos",
    "cs:src.Controllers.HealthController",
    "java:com.acme.health.HealthController",
    "go:internal.health",
    "rust:src.handlers.health",
    "cpp:src.runtime.RuntimeBridge",
  ]);
});

test("compilador rejeita interop externo com identificador invalido", () => {
  const codigo = `
module app.interop.invalido {
  use ts app..gateway

  task eco {
    input {
      mensagem: Texto required
    }
    output {
      mensagem: Texto
    }
    guarantees {
      mensagem existe
    }
    tests {
      caso "eco" {
        given {
          mensagem: "oi"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM058"));
});

test("compilador vincula task a implementacoes externas explicitas", () => {
  const codigo = `
module app.impl {
  task processar_pagamento {
    input {
      pagamento_id: Id required
    }
    output {
      protocolo: Id
    }
    effects {
      consulta gateway_pagamento
    }
    impl {
      ts: app.gateway.pagamentos.processar
      py: servicos.pagamentos.processar
      dart: app.mobile.pagamentos.processar
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          pagamento_id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.deepEqual(resultado.ir?.tasks[0]?.implementacoesExternas.map((impl) => `${impl.origem}:${impl.caminho}`), [
    "ts:app.gateway.pagamentos.processar",
    "py:servicos.pagamentos.processar",
    "dart:app.mobile.pagamentos.processar",
  ]);
});

test("compilador rejeita impl com origem duplicada ou caminho invalido", () => {
  const codigo = `
module app.impl.invalido {
  task processar_pagamento {
    input {
      pagamento_id: Id required
    }
    output {
      protocolo: Id
    }
    impl {
      ts: app.gateway.pagamentos.processar
      py: app..gateway.invalido
      typescript: app.gateway.duplicado
      kotlin: app.gateway.legacy
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          pagamento_id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM059"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM060"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM061"));
});

test("compilador formaliza rules, effects, guarantees e state com transicoes", () => {
  const codigo = `
module exemplo.pagamento.avancado {
  enum StatusPagamento {
    PENDENTE,
    AUTORIZADO,
    RECUSADO,
    PROCESSADO
  }

  state ciclo_pagamento {
    fields {
      status: StatusPagamento
      conciliado: Booleano
    }
    invariants {
      status existe
      conciliado == falso
    }
    transitions {
      PENDENTE -> AUTORIZADO
      AUTORIZADO -> PROCESSADO
      PENDENTE -> RECUSADO
    }
  }

  task processar {
    input {
      valor: Decimal required
      token: Texto required
    }
    output {
      status: StatusPagamento
    }
    rules {
      valor > 0
      token existe
      token deve_ser valido
    }
    effects {
      consulta gateway
      auditoria pagamento
    }
    state ciclo_pagamento {
      transitions {
        PENDENTE -> AUTORIZADO
        AUTORIZADO -> PROCESSADO
      }
    }
    guarantees {
      status em [AUTORIZADO, PROCESSADO]
    }
    tests {
      caso "processa" {
        given {
          valor: 10
          token: "ok"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.tasks[0]?.regrasEstruturadas.length, 3);
  assert.equal(resultado.ir?.tasks[0]?.efeitosEstruturados.length, 2);
  assert.equal(resultado.ir?.tasks[0]?.efeitosEstruturados[0]?.categoria, "consulta");
  assert.equal(resultado.ir?.tasks[0]?.efeitosEstruturados[1]?.categoria, "auditoria");
  assert.equal(resultado.ir?.tasks[0]?.garantiasEstruturadas.length, 1);
  assert.equal(resultado.ir?.tasks[0]?.stateContract?.nomeEstado, "ciclo_pagamento");
  assert.equal(resultado.ir?.tasks[0]?.stateContract?.transicoes.length, 2);
  assert.equal(resultado.ir?.states[0]?.invariantes.length, 2);
  assert.equal(resultado.ir?.states[0]?.transicoes.length, 3);
});

test("compilador valida invariantes em entity e type como contrato de dominio", () => {
  const codigo = `
module exemplo.operacao {
  enum StatusGate {
    ABERTO,
    FECHADO
  }

  type Janela {
    fields {
      semana: Data
      strategy_id: Id
    }
    invariants {
      semana existe
      strategy_id existe
    }
  }

  entity Slice {
    fields {
      id: Id
      gate: StatusGate
      janela: Janela
    }
    invariants {
      id existe
      gate em [ABERTO, FECHADO]
      janela existe
    }
  }

  task registrar {
    input {
      id: Id required
    }
    output {
      ok: Booleano
    }
    guarantees {
      ok existe
    }
    tests {
      caso "ok" {
        given {
          id: "s1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.types[0]?.invariantes.length, 2);
  assert.equal(resultado.ir?.entities[0]?.invariantes.length, 3);
});

test("compilador rejeita invariantes de entity e type referenciando campos inexistentes", () => {
  const codigo = `
module exemplo.operacao {
  type Janela {
    fields {
      semana: Data
    }
    invariants {
      strategy_id existe
    }
  }

  entity Slice {
    fields {
      id: Id
    }
    invariants {
      gate existe
    }
  }

  task registrar {
    input {
      id: Id required
    }
    output {
      ok: Booleano
    }
    guarantees {
      ok existe
    }
    tests {
      caso "ok" {
        given {
          id: "s1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM063"));
});

test("compilador formaliza expressoes compostas e etapas estruturadas de flow", () => {
  const codigo = `
module exemplo.flow.avancado {
  task validar {
    input {
      valor: Decimal required
      token: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      (valor > 0 e token existe) ou token deve_ser interno
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          valor: 10
          token: "abc"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task auditar {
    input {
      protocolo: Id required
    }
    output {
      auditoria_id: Id
    }
    guarantees {
      auditoria_id existe
    }
    tests {
      caso "ok" {
        given {
          protocolo: "p-1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task falhar {
    input {
      valor: Decimal required
    }
    output {
      protocolo_falha: Id
    }
    guarantees {
      protocolo_falha existe
    }
    tests {
      caso "ok" {
        given {
          valor: 10
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  flow pipeline {
    valor: Decimal
    token: Texto
    etapa validar_dados usa validar com valor=valor, token=token quando (sucesso existe ou persistencia concluida) em_sucesso auditar_log em_erro registrar_falha
    etapa auditar_log usa auditar com protocolo=validar_dados.protocolo depende_de validar_dados
    etapa registrar_falha usa falhar com valor=valor depende_de validar_dados
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.tasks[0]?.regrasEstruturadas[0]?.tipo, "composta");
  assert.equal(resultado.ir?.flows[0]?.etapasEstruturadas.length, 3);
  assert.equal(resultado.ir?.flows[0]?.etapasEstruturadas[0]?.task, "validar");
  assert.equal(resultado.ir?.flows[0]?.etapasEstruturadas[0]?.mapeamentos.length, 2);
  assert.equal(resultado.ir?.flows[0]?.etapasEstruturadas[0]?.emSucesso, "auditar_log");
  assert.equal(resultado.ir?.flows[0]?.etapasEstruturadas[0]?.emErro, "registrar_falha");
  assert.deepEqual(resultado.ir?.flows[0]?.etapasEstruturadas[1]?.dependencias, ["validar_dados"]);
});

test("compilador aceita flow com depende_de seguido de em_sucesso e em_erro", () => {
  const codigo = `
module exemplo.flow.ordem {
  task preparar {
    input {
      chave: Texto required
    }
    output {
      contexto: Texto
    }
    guarantees {
      contexto existe
    }
    tests {
      caso "ok" {
        given {
          chave: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task executar {
    input {
      chave: Texto required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          chave: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task concluir {
    input {
      protocolo: Id required
    }
    output {
      sucesso_final: Texto
    }
    guarantees {
      sucesso_final existe
    }
    tests {
      caso "ok" {
        given {
          protocolo: "p-1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task falhar {
    input {
      chave: Texto required
    }
    output {
      falha: Texto
    }
    guarantees {
      falha existe
    }
    tests {
      caso "ok" {
        given {
          chave: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  flow orquestracao {
    chave: Texto
    etapa preparar_contexto usa preparar com chave=chave
    etapa executar_fluxo usa executar com chave=chave depende_de preparar_contexto em_sucesso concluir_fluxo em_erro registrar_falha
    etapa concluir_fluxo usa concluir com protocolo=executar_fluxo.protocolo depende_de executar_fluxo
    etapa registrar_falha usa falhar com chave=chave depende_de executar_fluxo
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  const etapa = resultado.ir?.flows[0]?.etapasEstruturadas.find((item) => item.nome === "executar_fluxo");
  assert.deepEqual(etapa?.dependencias, ["preparar_contexto"]);
  assert.equal(etapa?.emSucesso, "concluir_fluxo");
  assert.equal(etapa?.emErro, "registrar_falha");
});

test("compilador formaliza negacao e agrupamento semantico com parenteses aninhados", () => {
  const codigo = `
module exemplo.expressoes.negacao {
  task validar {
    input {
      ativo: Booleano required
      valor: Decimal required
      token: Texto
    }
    output {
      aprovado: Booleano
    }
    rules {
      nao ativo == falso
      nao (token existe e (valor <= 0 ou ativo == falso))
    }
    guarantees {
      nao (aprovado == falso)
    }
    tests {
      caso "ok" {
        given {
          ativo: verdadeiro
          valor: 10
          token: "abc"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.tasks[0]?.regrasEstruturadas[0]?.tipo, "negacao");
  assert.equal(resultado.ir?.tasks[0]?.regrasEstruturadas[1]?.tipo, "negacao");
  assert.equal(resultado.ir?.tasks[0]?.garantiasEstruturadas[0]?.tipo, "negacao");
});

test("compilador rejeita expressao invalida e transicao fora do enum", () => {
  const codigo = `
module exemplo.invalido.avancado {
  enum StatusPagamento {
    PENDENTE,
    AUTORIZADO
  }

  state ciclo_pagamento {
    fields {
      status: StatusPagamento
    }
    invariants {
      campo_inexistente existe
    }
    transitions {
      PENDENTE => AUTORIZADO
      PENDENTE -> RECUSADO
    }
  }

  task processar {
    input {
      valor: Decimal required
    }
    output {
      status: StatusPagamento
    }
    rules {
      valor ??? 0
    }
    effects {
      coisa gateway
    }
    guarantees {
      resultado existe
    }
    tests {
      caso "processa" {
        given {
          valor: 10
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM021"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM048"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM024" || diagnostico.codigo === "SEM025"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM027"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM028" || diagnostico.codigo === "SEM029"));
});

test("compilador valida route com erros publicos coerentes com a task", () => {
  const codigo = `
module exemplo.route.publica {
  task processar_pagamento {
    input {
      pagamento_id: Id required
      token: Texto required
    }
    output {
      status: Texto
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    error {
      autorizacao_negada: "sem autorizacao"
      timeout_gateway: "tempo esgotado"
    }
    tests {
      caso "ok" {
        given {
          pagamento_id: "1"
          token: "ok"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route pagamento_publico {
    metodo: POST
    caminho: /pagamentos/processar
    task: processar_pagamento
    input {
      pagamento_id: Id
      token: Texto
    }
    output {
      status: Texto
    }
    error {
      autorizacao_negada: "erro exposto"
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.routes[0]?.errosPublicos[0]?.nome, "autorizacao_negada");
});

test("compilador resolve contrato publico da route a partir da task quando blocos nao sao declarados", () => {
  const codigo = `
module exemplo.route.publica.padrao {
  task criar_item {
    input {
      nome: Texto required
      preco: Decimal required
    }
    output {
      item_id: Id
      status: Texto
    }
    guarantees {
      item_id existe
    }
    error {
      entrada_invalida: "dados invalidos"
    }
    tests {
      caso "ok" {
        given {
          nome: "Caneca"
          preco: 10
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route itens_publica {
    metodo: POST
    caminho: /itens
    task: criar_item
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.routes[0]?.inputPublico.length, 2);
  assert.equal(resultado.ir?.routes[0]?.outputPublico.length, 2);
  assert.equal(resultado.ir?.routes[0]?.errosPublicos[0]?.nome, "entrada_invalida");
});

test("compilador rejeita route com erro publico fora do contrato da task", () => {
  const codigo = `
module exemplo.route.publica.invalida {
  task processar_pagamento {
    input {
      pagamento_id: Id required
    }
    output {
      status: Texto
    }
    guarantees {
      status existe
    }
    error {
      autorizacao_negada: "sem autorizacao"
    }
    tests {
      caso "ok" {
        given {
          pagamento_id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route pagamento_publico {
    metodo: POST
    caminho: /pagamentos/processar
    task: processar_pagamento
    error {
      timeout_gateway: "tempo esgotado"
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM051"));
});

test("compilador rejeita efeito malformado com categoria sem alvo", () => {
  const codigo = `
module exemplo.efeito.invalido {
  task auditar {
    input {
      id: Id required
    }
    output {
      protocolo: Id
    }
    effects {
      auditoria
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM023"));
});

test("compilador rejeita etapa de flow malformada e dependencia desconhecida", () => {
  const codigo = `
module exemplo.flow.invalido {
  task validar {
    input {
      valor: Decimal required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          valor: 1
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task auditar {
    input {
      protocolo: Id required
    }
    output {
      auditoria_id: Id
    }
    guarantees {
      auditoria_id existe
    }
    tests {
      caso "ok" {
        given {
          protocolo: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  flow pipeline {
    valor: Decimal
    etapa quebrada usa task_inexistente com entrada=campo_inexistente quando (valor > 0) em_erro ausente
    etapa auditar usa auditar com protocolo=quebrada.saida_inexistente depende_de inexistente
    etapa
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM032" || diagnostico.codigo === "SEM034"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM036"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM042" || diagnostico.codigo === "SEM043" || diagnostico.codigo === "SEM044" || diagnostico.codigo === "SEM045"));
});

test("compilador valida flow com roteamento por tipo de erro", () => {
  const codigo = `
module exemplo.flow.erro {
  task principal {
    input {
      chave: Texto required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    error {
      acesso_negado: "sem permissao"
      recurso_indisponivel: "fora do ar"
    }
    tests {
      caso "falha por acesso" {
        given {
          chave: "negada"
        }
        expect {
          sucesso: falso
        }
        error {
          tipo: "acesso_negado"
        }
      }
    }
  }

  task tratar_acesso {
    input {
      chave: Texto required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          chave: "negada"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task registrar {
    input {
      chave: Texto required
    }
    output {
      auditoria_id: Id
    }
    guarantees {
      auditoria_id existe
    }
    tests {
      caso "ok" {
        given {
          chave: "negada"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task concluir {
    input {
      protocolo: Id required
    }
    output {
      registro_id: Id
    }
    guarantees {
      registro_id existe
    }
    tests {
      caso "ok" {
        given {
          protocolo: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  flow resposta {
    chave: Texto
    etapa tentar usa principal com chave=chave em_sucesso concluir_fluxo em_erro registrar_falha por_erro acesso_negado=tratar_acesso_negado, recurso_indisponivel=registrar_falha
    etapa tratar_acesso_negado usa tratar_acesso com chave=chave depende_de tentar
    etapa registrar_falha usa registrar com chave=chave depende_de tentar
    etapa concluir_fluxo usa concluir com protocolo=tentar.protocolo depende_de tentar
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.flows[0]?.etapasEstruturadas[0]?.porErro.length, 2);
});

test("compilador rejeita flow com roteamento para erro inexistente", () => {
  const codigo = `
module exemplo.flow.erro.invalido {
  task principal {
    input {
      chave: Texto required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    error {
      acesso_negado: "sem permissao"
    }
    tests {
      caso "falha" {
        given {
          chave: "negada"
        }
        expect {
          sucesso: falso
        }
        error {
          tipo: "acesso_negado"
        }
      }
    }
  }

  flow resposta {
    chave: Texto
    etapa tentar usa principal com chave=chave por_erro timeout_gateway=destino_inexistente
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM046"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM047"));
});

test("compilador rejeita negacao incompleta e parenteses quebrados", () => {
  const codigo = `
module exemplo.expressoes.invalidas {
  task validar {
    input {
      valor: Decimal required
    }
    output {
      aprovado: Booleano
    }
    rules {
      nao
      nao (valor > 0
    }
    guarantees {
      aprovado existe
    }
    tests {
      caso "ok" {
        given {
          valor: 1
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.filter((diagnostico) => diagnostico.codigo === "SEM021").length >= 2);
});

test("compilador rejeita task com transicao fora do contrato do state", () => {
  const codigo = `
module exemplo.state.task.invalido {
  enum StatusPedido {
    ABERTO,
    PAGO,
    CANCELADO
  }

  state ciclo_pedido {
    fields {
      status: StatusPedido
    }
    transitions {
      ABERTO -> PAGO
    }
  }

  task cancelar {
    input {
      id: Id required
    }
    output {
      status: StatusPedido
    }
    state ciclo_pedido {
      transitions {
        ABERTO -> CANCELADO
      }
    }
    guarantees {
      status existe
    }
    tests {
      caso "ok" {
        given {
          id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM041"));
});

test("compilador valida effects com criticidade em task, flow e route", () => {
  const codigo = `
module exemplo.efeitos.operacionais {
  task consultar_gateway {
    input {
      pagamento_id: Id required
    }
    output {
      status: Texto
    }
    effects {
      consulta gateway_pagamento criticidade=alta
      auditoria pagamento detalhada criticidade=media
    }
    guarantees {
      status existe
    }
    tests {
      caso "consulta" {
        given {
          pagamento_id: "pag_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  flow operacao {
    pagamento_id: Id
    effects {
      auditoria fluxo_pagamento criticidade=alta
    }
    etapa consultar usa consultar_gateway com pagamento_id=pagamento_id
  }

  route consultar_publico {
    metodo: GET
    caminho: /pagamentos/consultar
    task: consultar_gateway
    effects {
      auditoria borda_pagamento criticidade=baixa
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.tasks[0]?.efeitosEstruturados[0]?.criticidade, "alta");
  assert.equal(resultado.ir?.flows[0]?.efeitosEstruturados[0]?.categoria, "auditoria");
  assert.equal(resultado.ir?.routes[0]?.efeitosPublicos[0]?.criticidade, "baixa");
});

test("compilador rejeita criticidade invalida de efeito", () => {
  const codigo = `
module exemplo.efeitos.criticidade.invalida {
  task processar {
    input {
      id: Id required
    }
    output {
      protocolo: Id
    }
    effects {
      consulta gateway criticidade=urgente
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM052"));
});

test("compilador rejeita route com tipo publico incoerente e assinatura duplicada", () => {
  const codigo = `
module exemplo.route.publica.coerencia {
  task processar {
    input {
      pagamento_id: Id required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    error {
      timeout_gateway: "tempo esgotado"
    }
    tests {
      caso "ok" {
        given {
          pagamento_id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route pagamento_a {
    metodo: post
    caminho: /pagamentos/processar
    task: processar
    input {
      pagamento_id: Texto
    }
  }

  route pagamento_b {
    metodo: POST
    caminho: /pagamentos/processar
    task: processar
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM053"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM055"));
});

test("compilador resolve pagamento modularizado em multiplos arquivos", () => {
  const dominio = `
module exemplos.pagamento.dominio {
  entity Pagamento {
    fields {
      id: Id
      valor: Decimal
      status: StatusPagamento
    }
  }

  enum StatusPagamento {
    PENDENTE,
    AUTORIZADO,
    RECUSADO,
    PROCESSADO
  }

  state ciclo_pagamento {
    fields {
      status: StatusPagamento
      conciliado: Booleano
    }
    transitions {
      PENDENTE -> AUTORIZADO
      AUTORIZADO -> PROCESSADO
      PENDENTE -> RECUSADO
    }
  }
}
`;

  const pagamento = `
module exemplos.pagamento {
  use exemplos.pagamento.dominio

  task processar_pagamento {
    input {
      pagamento_id: Id required
      valor: Decimal required
      token: Texto required
    }
    output {
      pagamento: Pagamento
      status: StatusPagamento
    }
    effects {
      consulta gateway_pagamento criticidade=alta
      persistencia Pagamento criticidade=alta
      auditoria pagamento criticidade=media
    }
    state ciclo_pagamento {
      transitions {
        PENDENTE -> AUTORIZADO
      }
    }
    guarantees {
      pagamento existe
      status existe
    }
    error {
      timeout_gateway: "tempo esgotado"
    }
    tests {
      caso "ok" {
        given {
          pagamento_id: "1"
          valor: 10
          token: "ok"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route processar_pagamento_publico {
    metodo: POST
    caminho: /pagamentos/processar
    task: processar_pagamento
  }
}
`;

  const resultado = compilarProjeto([
    { caminho: "pagamento_dominio.sema", codigo: dominio },
    { caminho: "pagamento.sema", codigo: pagamento },
  ]);

  assert.equal(temErros(resultado.diagnosticos), false);
  const moduloPrincipal = resultado.modulos.find((modulo) => modulo.modulo?.nome === "exemplos.pagamento");
  assert.equal(moduloPrincipal?.ir?.routes[0]?.inputPublico.length, 3);
  assert.equal(moduloPrincipal?.ir?.routes[0]?.publico.errors[0]?.codigo, "timeout_gateway");
});

test("compilador enriquece IR com vinculos, execucao, erros estruturados, tipos compostos e superficies novas", () => {
  const codigo = `
module exemplo.ia.segura {
  vinculos {
    arquivo: "src/modulos/seguro.ts"
  }

  task processar {
    input {
      itens: Lista<Texto> required
      metadata: Mapa<Texto, Numero> optional
    }
    output {
      protocolo: Texto|Id
    }
    vinculos {
      arquivo: "src/processar.ts"
      simbolo: app.processar.executar
    }
    execucao {
      idempotencia: verdadeiro
      timeout: "30s"
      retry: "3x exponencial"
      compensacao: "estornar pedido"
      criticidade_operacional: alta
    }
    error {
      timeout_gateway {
        mensagem: "tempo esgotado"
        categoria: infraestrutura
        recuperabilidade: temporaria
        acao_chamador: retry
        impacta_estado: falso
        requer_compensacao: verdadeiro
      }
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          itens: "a"
          metadata: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route processar_publico {
    metodo: POST
    caminho: /processar
    task: processar
    vinculos {
      rota: /processar
    }
  }

  worker sincronizar_fila {
    task: processar
    vinculos {
      fila: pedidos_processamento
    }
    execucao {
      retry: "fila padrao"
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.vinculos[0]?.tipo, "arquivo");
  assert.equal(resultado.ir?.tasks[0]?.input[0]?.cardinalidade, "lista");
  assert.equal(resultado.ir?.tasks[0]?.input[1]?.cardinalidade, "mapa");
  assert.equal(resultado.ir?.tasks[0]?.output[0]?.cardinalidade, "uniao");
  assert.equal(resultado.ir?.tasks[0]?.execucao.criticidadeOperacional, "alta");
  assert.equal(resultado.ir?.tasks[0]?.vinculos.length, 2);
  assert.equal(resultado.ir?.tasks[0]?.errosDetalhados[0]?.acaoChamador, "retry");
  assert.equal(resultado.ir?.routes[0]?.vinculos[0]?.tipo, "rota");
  assert.equal(resultado.ir?.superficies[0]?.tipo, "worker");
});

test("compilador rejeita superficie sem task, impl ou vinculos rastreaveis", () => {
  const codigo = `
module exemplo.superficie.invalida {
  worker sincronizar {
    input {
      payload: Json
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM069"));
});

test("compilador endurece guardrails de producao para task publica sem execucao nem rastreabilidade", () => {
  const codigo = `
module exemplo.producao.guardrails {
  task processar_pagamento {
    input {
      pedido_id: Id required
    }
    output {
      status: Texto
    }
    guarantees {
      status existe
    }
    tests {
      caso "ok" {
        given {
          pedido_id: "ped_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route processar_pagamento_publico {
    metodo: POST
    caminho: /pagamentos/processar
    task: processar_pagamento
  }

  webhook confirmar_pagamento {
    task: processar_pagamento
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM071" && diagnostico.severidade === "aviso"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM072" && diagnostico.severidade === "aviso"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM073" && diagnostico.severidade === "aviso"));
});

test("compilador valida campos de execucao tambem em superficies", () => {
  const codigo = `
module exemplo.superficie.execucao {
  task processar {
    input {
      payload: Texto required
    }
    output {
      sucesso: Booleano
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          payload: "ok"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  webhook receber_payload {
    task: processar
    execucao {
      janela: "10s"
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM065"));
});

test("compilador enriquece IR com contratos semanticos de seguranca", () => {
  const codigo = `
module exemplo.seguranca.contratos {
  task processar_pagamento {
    input {
      cliente_id: Id required
      token_gateway: Texto required
    }
    output {
      protocolo: Id
      status: Texto
    }
    auth {
      modo: interno
      estrategia: jwt
      principal: servico
      origem: worker
    }
    authz {
      papel: pagamentos_admin
      escopo: pagamentos.processar
      politica: rbac.pagamentos
      tenant: isolado
    }
    dados {
      classificacao_padrao: interno
      redacao_log: obrigatoria
      retencao: "90d"
      input {
        cliente_id: pii
        token_gateway: credencial
      }
      output {
        protocolo: interno
        status: interno
      }
    }
    audit {
      evento: pagamentos.processado
      ator: auth.servico
      correlacao: request_id
      retencao: "180d"
      motivo: obrigatorio
    }
    segredos {
      stripe_api_key {
        origem: vault
        escopo: runtime
        acesso: gateway_pagamento
        rotacao: "30d"
        nao_logar: verdadeiro
        nao_retornar: verdadeiro
        mascarar: verdadeiro
      }
    }
    forbidden {
      shell.exec
      retorno.credencial
    }
    effects {
      db.write Pedido criticidade=alta privilegio=escrita isolamento=tenant
      secret.read stripe_api_key criticidade=media privilegio=leitura isolamento=processo
    }
    guarantees {
      protocolo existe
      status existe
    }
    tests {
      caso "ok" {
        given {
          cliente_id: "cli_1"
          token_gateway: "tok_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route processar_pagamento_publico {
    metodo: POST
    caminho: /pagamentos/processar
    task: processar_pagamento
    auth {
      modo: obrigatorio
      principal: usuario
      origem: publica
    }
    authz {
      escopo: pagamentos.processar.publico
      tenant: obrigatorio
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);

  const task = resultado.ir?.tasks[0];
  assert.equal(task?.auth.explicita, true);
  assert.equal(task?.auth.modo, "interno");
  assert.equal(task?.authz.papeis[0], "pagamentos_admin");
  assert.equal(task?.authz.escopos[0], "pagamentos.processar");
  assert.equal(task?.dados.classificacaoPadrao, "interno");
  assert.equal(task?.dados.campos.find((campo) => campo.origem === "input" && campo.campo === "cliente_id")?.classificacao, "pii");
  assert.equal(task?.dados.redacaoLog, "obrigatoria");
  assert.equal(task?.audit.evento, "pagamentos.processado");
  assert.equal(task?.audit.motivo, "obrigatorio");
  assert.equal(task?.segredos.itens[0]?.nome, "stripe_api_key");
  assert.equal(task?.segredos.itens[0]?.naoLogar, true);
  assert.deepEqual(task?.forbidden.regras, ["retorno.credencial", "shell.exec"]);
  assert.equal(task?.efeitosEstruturados[0]?.categoria, "db.write");
  assert.equal(task?.efeitosEstruturados[0]?.privilegio, "escrita");
  assert.equal(task?.efeitosEstruturados[0]?.isolamento, "tenant");
  assert.equal(task?.efeitosEstruturados[1]?.categoria, "secret.read");
  assert.equal(task?.efeitosEstruturados[1]?.isolamento, "processo");

  const route = resultado.ir?.routes[0];
  assert.equal(route?.auth.explicita, true);
  assert.equal(route?.auth.modo, "obrigatorio");
  assert.equal(route?.authz.escopos[0], "pagamentos.processar.publico");
  assert.equal(route?.authz.tenant, "obrigatorio");
});

test("compilador rejeita contratos semanticos de seguranca invalidos", () => {
  const codigo = `
module exemplo.seguranca.invalida {
  task operar {
    input {
      payload: Texto required
    }
    output {
      sucesso: Booleano
    }
    auth {
      modo: senha
      principal: robo
      origem: externa
      provider: oauth
    }
    authz {
      tenant: global
    }
    dados {
      classificacao_padrao: ultrassecreto
      redacao_log: total
      payload_bruto: criptico
      interno {
        token: segredo
      }
    }
    audit {
      ator: usuario_id
      motivo: sempre
      canal: kafka
    }
    segredos {
      api_key {
        origem: vault
        politica: strict
        nao_logar: talvez
      }
      session_key {
        escopo: runtime
      }
    }
    forbidden {
      shell exec
      secret.read
    }
    effects {
      secret.read api_key criticidade=alta privilegio=root isolamento=cluster
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          payload: "ok"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);

  for (const codigoDiagnostico of [
    "SEM074",
    "SEM075",
    "SEM076",
    "SEM077",
    "SEM079",
    "SEM080",
    "SEM081",
    "SEM082",
    "SEM083",
    "SEM084",
    "SEM085",
    "SEM086",
    "SEM087",
    "SEM088",
    "SEM089",
    "SEM090",
    "SEM091",
    "SEM092",
    "SEM093",
  ]) {
    assert.ok(
      resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === codigoDiagnostico),
      `diagnostico ausente: ${codigoDiagnostico}`,
    );
  }
});

test("compilador cobra contratos semanticos de seguranca em operacao publica e sensivel", () => {
  const codigo = `
module exemplo.seguranca.guardrails {
  task sincronizar_cliente {
    input {
      cliente_id: Id required
      payload: Json required
    }
    output {
      status: Texto
    }
    effects {
      db.write Cliente criticidade=alta privilegio=escrita isolamento=tenant
      secret.read gateway_token criticidade=media privilegio=leitura isolamento=processo
    }
    guarantees {
      status existe
    }
    tests {
      caso "ok" {
        given {
          cliente_id: "cli_1"
          payload: "{}"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route sincronizar_cliente_publico {
    metodo: POST
    caminho: /clientes/sincronizar
    task: sincronizar_cliente
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);

  for (const codigoDiagnostico of ["SEM094", "SEM095", "SEM096", "SEM097", "SEM098", "SEM099"]) {
    assert.ok(
      resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === codigoDiagnostico && diagnostico.severidade === "aviso"),
      `guardrail ausente: ${codigoDiagnostico}`,
    );
  }
});
