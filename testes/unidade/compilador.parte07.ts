// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";

test("compilador avisa quando state convive com status textual solto", () => {
  const codigo = `
module exemplo.status.texto {
  enum StatusPedido {
    RASCUNHO
    APROVADO
  }

  state ciclo_pedido {
    fields {
      status: StatusPedido
    }
    transitions {
      RASCUNHO -> APROVADO
    }
  }

  entity Pedido {
    fields {
      id: Id
      status: Texto
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM100" && diagnostico.severidade === "aviso"));
});

test("compilador avisa sobre execucao critica sem idempotencia explicita", () => {
  const codigo = `
module exemplo.execucao.critica {
  task publicar_evento {
    input {
      pedido_id: Id required
    }
    output {
      protocolo: Id
    }
    effects {
      queue.publish pedidos criticidade=alta
    }
    execucao {
      timeout: "10s"
      retry: "2x exponencial"
      criticidade_operacional: alta
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "publica" {
        given { pedido_id: "ped_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM101" && diagnostico.severidade === "aviso"));
});

test("compilador avisa sobre teste fraco em task sensivel", () => {
  const codigo = `
module exemplo.teste.fraco {
  task processar_pagamento {
    input {
      pagamento_id: Id required
    }
    output {
      status: Texto
    }
    effects {
      db.write Pagamento criticidade=alta
    }
    guarantees {
      status existe
    }
    tests {
      caso "pagamento feliz demais" {
        given { pagamento_id: "pag_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM102" && diagnostico.severidade === "aviso"));
});

test("compilador aceita state local declarado dentro da task", () => {
  const codigo = `
module exemplo.state.local {
  task confirmar {
    input {
      pedido_id: Id required
    }
    output {
      status: Texto
    }
    state ciclo_local {
      transitions {
        PENDENTE -> CONFIRMADO
      }
    }
    guarantees {
      status existe
    }
    tests {
      caso "confirma" {
        given { pedido_id: "ped_1" }
        expect { sucesso: verdadeiro  status: "CONFIRMADO" }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM038"), false);
});

test("compilador nao marca teste de erro tipado como teste fraco", () => {
  const codigo = `
module exemplo.teste.erro_forte {
  task processar_pagamento {
    input {
      pagamento_id: Id required
    }
    output {
      status: Texto
    }
    effects {
      db.write Pagamento criticidade=alta
    }
    guarantees {
      status existe
    }
    error {
      autorizacao_negada: "Recusado."
    }
    tests {
      caso "pagamento recusado" {
        given { pagamento_id: "pag_1" }
        expect { sucesso: falso }
        error { tipo: "autorizacao_negada" }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM102"), false);
});
