// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";

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
