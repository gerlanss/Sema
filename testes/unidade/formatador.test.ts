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

test("formatador preserva strings com pontuacao e aspas escapadas em campos textuais", () => {
  const codigo = String.raw`
module exemplo.texto.literal {
  docs {
    resumo: "Contrato com virgula, parenteses (ok) e seta -> normal."
  }

  task eco {
    input {
      payload: Texto required
    }
    output {
      payload: Texto
    }
    guarantees {
      payload existe
    }
    tests {
      caso "ok" {
        given {
          payload: "given { documento { texto: \"ok\" } }"
        }
        expect {
          payload: "given { documento { texto: \"ok\" } }"
        }
      }
    }
  }
}
`;

  const primeira = formatarCodigo(codigo, "memoria.sema");
  const segunda = formatarCodigo(primeira.codigoFormatado ?? "", "memoria.sema");

  assert.equal(temErros(primeira.diagnosticos), false);
  assert.equal(primeira.codigoFormatado, segunda.codigoFormatado);
  assert.ok(primeira.codigoFormatado?.includes('resumo: "Contrato com virgula, parenteses (ok) e seta -> normal."'));
  assert.ok(primeira.codigoFormatado?.includes(String.raw`payload: "given { documento { texto: \"ok\" } }"`));
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

test("formatador preserva bloco nomeado livre dentro de given", () => {
  const codigo = `
module exemplo.formatado.aninhado {
  task extrair {
    input {
      documento: Json required
    }
    output {
      itens: Json
    }
    guarantees {
      itens existe
    }
    tests {
      caso "prazo ausente" {
        given {
          documento {
            texto_extraido: "sem prazo"
          }
        }
        expect {
          itens: "parciais"
        }
        error {
          tipo: "prazo_ausente"
        }
      }
    }
  }
}
`;

  const resultado = formatarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.match(resultado.codigoFormatado ?? "", /given \{\n\s+documento \{/);
  assert.doesNotMatch(resultado.codigoFormatado ?? "", /desconhecido documento \{/);
});

test("formatador canoniza vinculos, execucao e superficie worker", () => {
  const codigo = `
module exemplo.formatado.ia {
  worker sincronizar {
    execucao {
      retry: "fila"
    }
    vinculos {
      fila: pedidos_sync
    }
    task: processar
  }

  task processar {
    guarantees {
      protocolo existe
    }
    execucao {
      criticidade_operacional: alta
      timeout: "30s"
    }
    vinculos {
      simbolo: app.processar.executar
      arquivo: "src/processar.ts"
    }
    output {
      protocolo: Id
    }
    input {
      itens: Lista<Texto> required
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
        given {
          itens: "a"
        }
      }
    }
  }
}
`;

  const resultado = formatarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.match(resultado.codigoFormatado ?? "", /vinculos \{\n\s+arquivo: "src\/processar\.ts"\n\s+simbolo: app\.processar\.executar\n\s+\}/);
  assert.match(resultado.codigoFormatado ?? "", /execucao \{\n\s+timeout: "30s"\n\s+criticidade_operacional: alta\n\s+\}/);
  assert.match(resultado.codigoFormatado ?? "", /worker sincronizar \{/);
});

test("formatador canoniza database vendor-first e preserva IR de persistencia", () => {
  const codigo = `
module exemplo.database.formatado {
  task eco {
    output {
      ok: Booleano
    }
    input {
      payload: Texto required
    }
    guarantees {
      ok existe
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
        given {
          payload: "ok"
        }
      }
    }
  }

  database principal {
    adapter: prisma
    query_model: sql
    transaction_model: mvcc
    schema: public
    engine: postgres
    durability: alta
    consistency: forte
    database: app
    portavel: falso
    table pedidos {
      table: pedidos
    }
    query buscar_pedidos {
      mode: sql
    }
  }
}
`;

  const antes = compilarCodigo(codigo, "antes.sema");
  const formatado = formatarCodigo(codigo, "formatado.sema");
  const depois = compilarCodigo(formatado.codigoFormatado ?? "", "depois.sema");
  const projetarPersistencia = (databases = []) => databases.map((database: any) => ({
    nome: database.nome,
    engine: database.engine,
    schema: database.schema,
    database: database.database,
    consistency: database.consistency,
    durability: database.durability,
    transactionModel: database.transactionModel,
    queryModel: database.queryModel,
    portavel: database.portavel,
    adapter: database.adapter,
    resources: database.resources.map((resource: any) => ({
      nome: resource.nome,
      resourceKind: resource.resourceKind,
      mode: resource.mode,
      table: resource.table,
      compatibilidade: resource.compatibilidade.map((item: any) => `${item.engine}:${item.status}`),
    })),
  }));

  assert.equal(temErros(antes.diagnosticos), false);
  assert.equal(temErros(formatado.diagnosticos), false);
  assert.equal(temErros(depois.diagnosticos), false);
  assert.match(
    formatado.codigoFormatado ?? "",
    /database principal \{\n\s+engine: postgres\n\s+schema: public\n\s+database: app\n\s+consistency: forte\n\s+durability: alta\n\s+transaction_model: mvcc\n\s+query_model: sql\n\s+portavel: falso\n\s+adapter: prisma/,
  );
  assert.ok((formatado.codigoFormatado ?? "").indexOf("database principal") < (formatado.codigoFormatado ?? "").indexOf("task eco"));
  assert.deepEqual(projetarPersistencia(depois.ir?.databases), projetarPersistencia(antes.ir?.databases));
});
