// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";

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

test("compilador formaliza databases vendor-first no IR", () => {
  const codigo = `
module exemplo.persistencia.vendor_first {
  database principal_postgres {
    engine: postgres
    schema: public
    consistency: forte
    durability: alta
    transaction_model: mvcc
    query_model: sql
    capabilities {
      joins
      views
    }
    table pedidos {
      entity: Pedido
    }
    query buscar_pedidos {
      mode: sql
    }
    relationship pedido_cliente {
      from: Pedido
      to: Cliente
    }
  }

  database principal_mysql {
    engine: mysql
    query_model: sql
    transaction_model: bloqueio
    table faturamento {
      table: faturamento
    }
  }

  database principal_sqlite {
    engine: sqlite
    query_model: sql
    transaction_model: single_thread
    table cache_local {
      table: cache_local
    }
  }

  database principal_mongodb {
    engine: mongodb
    query_model: documento
    transaction_model: documento
    collection pedidos {
      collection: pedidos
    }
    document pedido_snapshot {
      mode: pipeline
    }
  }

  database principal_redis {
    engine: redis
    query_model: chave_valor
    transaction_model: single_thread
    keyspace pedidos_cache {
      ttl: "300s"
    }
    stream eventos_pedido {
      surface: fila
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.deepEqual(resultado.ir?.databases.map((database) => database.engine), [
    "postgres",
    "mysql",
    "sqlite",
    "mongodb",
    "redis",
  ]);
  assert.equal(resultado.ir?.databases[0]?.resources[0]?.resourceKind, "table");
  assert.equal(resultado.ir?.databases[0]?.resources[0]?.compatibilidade.find((item) => item.engine === "postgres")?.status, "nativo");
  assert.equal(resultado.ir?.databases[3]?.resources[0]?.resourceKind, "collection");
  assert.equal(resultado.ir?.databases[3]?.resources[1]?.compatibilidade.find((item) => item.engine === "mongodb")?.status, "nativo");
  assert.equal(resultado.ir?.databases[4]?.resources[0]?.resourceKind, "keyspace");
  assert.equal(resultado.ir?.databases[4]?.resources[1]?.resourceKind, "stream");
});

test("compilador rejeita recursos de banco incompativeis e avisa sobre portabilidade falsa", () => {
  const codigo = `
module exemplo.persistencia.invalida {
  database cache_redis {
    engine: redis
    table pedidos_cache {
      portavel: verdadeiro
    }
    query relatorio_operacional {
      mode: sql
      portavel: verdadeiro
    }
  }

  database docs_mongo {
    engine: mongodb
    transaction lote {
      isolation: serializable
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), true);
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM112"));
  assert.ok(resultado.diagnosticos.some((diagnostico) => diagnostico.codigo === "SEM114" && diagnostico.severidade === "aviso"));
});

test("compilador aceita aliases primitivos Timestamp e Objeto preservando IR", () => {
  const codigo = `
module exemplo.aliases {
  entity Evento {
    fields {
      payload: Objeto
      recebido_em: Timestamp
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.deepEqual(resultado.ir?.entities[0]?.campos.map((campo) => campo.tipo), ["Objeto", "Timestamp"]);
});

test("compilador expoe predicado canonico sem apagar texto original", () => {
  const codigo = `
module exemplo.predicado.canonico {
  task validar_nome {
    input {
      nome: Texto required
    }
    output {
      nome_normalizado: Texto
    }
    rules {
      nome deve_ser preenchida
    }
    guarantees {
      nome_normalizado existe
    }
    tests {
      caso "nome valido" {
        given { nome: "Ana" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  const regra = resultado.ir?.tasks[0]?.regrasEstruturadas[0];
  assert.equal(regra?.tipo, "predicado");
  if (regra?.tipo === "predicado") {
    assert.equal(regra.predicado, "preenchida");
    assert.equal(regra.predicadoCanonico, "preenchido");
  }
});
