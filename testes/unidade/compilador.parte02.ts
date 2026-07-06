// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";

test("compilador aceita interop externo com origens suportadas sem exigir modulo sema local", () => {
  const codigo = `
module app.interop {
  use ts app.gateway.pagamentos
  use javascript app.web.despesas
  use py servicos.conciliacao
  use dart app.mobile.pagamentos
  use lua app.social.handlers
  use cs src.Controllers.HealthController
  use java com.acme.health.HealthController
  use go internal.health
  use rust src.handlers.health
  use cpp src.runtime.RuntimeBridge
  use php app.Http.Controllers.HealthController

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
    "js:app.web.despesas",
    "py:servicos.conciliacao",
    "dart:app.mobile.pagamentos",
    "lua:app.social.handlers",
    "cs:src.Controllers.HealthController",
    "java:com.acme.health.HealthController",
    "go:internal.health",
    "rust:src.handlers.health",
    "cpp:src.runtime.RuntimeBridge",
    "php:app.Http.Controllers.HealthController",
  ]);
  assert.deepEqual(resultado.ir?.interoperabilidades.map((item) => `${item.origem}:${item.caminho}`), [
    "ts:app.gateway.pagamentos",
    "js:app.web.despesas",
    "py:servicos.conciliacao",
    "dart:app.mobile.pagamentos",
    "lua:app.social.handlers",
    "cs:src.Controllers.HealthController",
    "java:com.acme.health.HealthController",
    "go:internal.health",
    "rust:src.handlers.health",
    "cpp:src.runtime.RuntimeBridge",
    "php:app.Http.Controllers.HealthController",
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
      js: app.web.pagamentos.processar
      py: servicos.pagamentos.processar
      dart: app.mobile.pagamentos.processar
      lua: app.social.pagamentos.processar
      php: app.Http.Controllers.PaymentController.processar
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
    "js:app.web.pagamentos.processar",
    "py:servicos.pagamentos.processar",
    "dart:app.mobile.pagamentos.processar",
    "lua:app.social.pagamentos.processar",
    "php:app.Http.Controllers.PaymentController.processar",
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
