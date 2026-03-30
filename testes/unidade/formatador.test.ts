import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, formatarCodigo, temErros } from "../../pacotes/nucleo/dist/index.js";

test("formatador canoniza task e route com ordenacao e espacos estaveis", () => {
  const codigo = `
module exemplo.formatacao {
  route produto_publico {
    task: criar_produto
    caminho: /produtos / criar
    metodo: POST
    output {
      produto: Produto
    }
    input {
      nome: Texto
    }
  }

  entity Produto {
    fields {
      id: Id
      nome: Texto
    }
  }

  task criar_produto {
    guarantees {
      produto existe
    }
    output {
      produto: Produto
    }
    input {
      nome: Texto required
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
        given {
          nome: "Caneca"
        }
      }
    }
  }
}
`;

  const resultado = formatarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.codigoFormatado?.includes("entity Produto"));
  assert.ok(resultado.codigoFormatado?.includes("task criar_produto"));
  assert.ok(resultado.codigoFormatado?.includes("caminho: /produtos/criar"));
  assert.match(resultado.codigoFormatado ?? "", /input \{\n\s+nome: Texto required\n\s+\}\n\s+output \{/);
});

test("formatador e idempotente", () => {
  const codigo = `
module exemplo.idempotente {
  task eco {
    output {
      mensagem: Texto
    }
    input {
      mensagem: Texto required
    }
    guarantees {
      mensagem existe
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
        given {
          mensagem: "oi"
        }
      }
    }
  }
}
`;

  const primeira = formatarCodigo(codigo, "memoria.sema");
  const segunda = formatarCodigo(primeira.codigoFormatado ?? "", "memoria.sema");

  assert.equal(primeira.codigoFormatado, segunda.codigoFormatado);
});

test("formatador preserva IR observavel do modulo", () => {
  const codigo = `
module exemplo.ir.preservada {
  task validar {
    effects {
      auditoria validacao
      notificacao cliente retorno
    }
    rules {
      valor > 0
    }
    output {
      status: Texto
    }
    input {
      valor: Decimal required
    }
    guarantees {
      status existe
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
        given {
          valor: 10
        }
      }
    }
  }
}
`;

  const antes = compilarCodigo(codigo, "antes.sema");
  const formatado = formatarCodigo(codigo, "formatado.sema");
  const depois = compilarCodigo(formatado.codigoFormatado ?? "", "depois.sema");

  assert.equal(temErros(antes.diagnosticos), false);
  assert.equal(temErros(formatado.diagnosticos), false);
  assert.equal(temErros(depois.diagnosticos), false);
  assert.deepEqual(depois.ir, antes.ir);
});

test("formatador preserva origem explicita de use externo", () => {
  const codigo = `
module exemplo.interop.formatado {
use ts app.gateway.pagamentos
use py servicos.conciliacao
  task eco {
    output {
      mensagem: Texto
    }
    input {
      mensagem: Texto required
    }
    guarantees {
      mensagem existe
    }
    tests {
      caso "ok" {
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

  const resultado = formatarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.match(resultado.codigoFormatado ?? "", /use ts app\.gateway\.pagamentos/);
  assert.match(resultado.codigoFormatado ?? "", /use py servicos\.conciliacao/);
});

test("formatador ordena bloco impl dentro da task", () => {
  const codigo = `
module exemplo.impl.formatado {
  task processar {
    guarantees {
      protocolo existe
    }
    impl {
      py: servicos.pagamentos.processar
      ts: app.gateway.pagamentos.processar
    }
    effects {
      consulta gateway_pagamento
    }
    output {
      protocolo: Id
    }
    input {
      pagamento_id: Id required
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

  const resultado = formatarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.match(resultado.codigoFormatado ?? "", /effects \{\n\s+consulta gateway_pagamento\n\s+\}\n\s+impl \{/);
});
