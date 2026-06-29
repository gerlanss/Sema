// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";

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
