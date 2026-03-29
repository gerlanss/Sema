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
  }
}
`;
  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.flows[0]?.tasksReferenciadas[0], "criar_item");
  assert.equal(resultado.ir?.routes[0]?.metodo, "POST");
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
      registra auditoria
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
  assert.equal(resultado.ir?.tasks[0]?.garantiasEstruturadas.length, 1);
  assert.equal(resultado.ir?.tasks[0]?.stateContract?.nomeEstado, "ciclo_pagamento");
  assert.equal(resultado.ir?.tasks[0]?.stateContract?.transicoes.length, 2);
  assert.equal(resultado.ir?.states[0]?.invariantes.length, 2);
  assert.equal(resultado.ir?.states[0]?.transicoes.length, 3);
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
      notifica
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
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM023"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM024" || diagnostico.codigo === "SEM025"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM027"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM028" || diagnostico.codigo === "SEM029"));
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
