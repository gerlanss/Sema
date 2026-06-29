// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";

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
