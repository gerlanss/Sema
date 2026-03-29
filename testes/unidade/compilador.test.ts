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
  assert.equal(resultado.ir?.states[0]?.invariantes.length, 2);
  assert.equal(resultado.ir?.states[0]?.transicoes.length, 3);
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
