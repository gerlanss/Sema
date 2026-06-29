// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

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

test("compilador aceita atalho de comparacao multi-valor em rules", () => {
  const codigo = `
module exemplo.rules.multi_valor {
  task notificar {
    input {
      canal: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      canal == "sms" ou "email"
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          canal: "sms"
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
  const regra = resultado.ir?.tasks[0]?.regrasEstruturadas[0];
  assert.equal(regra?.tipo, "composta");
  if (regra?.tipo === "composta") {
    assert.equal(regra.termos.length, 2);
    assert.equal(regra.termos[0]?.tipo, "comparacao");
    assert.equal(regra.termos[1]?.tipo, "comparacao");
  }
});

test("compilador orienta mover validacao de input para rules quando ela aparece em guarantees", () => {
  const codigo = `
module exemplo.guarantees.input {
  task autenticar {
    input {
      metodo: Texto required
    }
    output {
      token: Texto
    }
    guarantees {
      metodo existe
    }
    tests {
      caso "ok" {
        given {
          metodo: "sms"
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
  const diagnostico = resultado.diagnosticos.find((item) => item.codigo === "SEM031");
  assert.ok(diagnostico);
  assert.match(diagnostico.dica ?? "", /mova isso para rules/);
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
    input {
      nome: Texto
    }
    output {
      item_id: Id
    }
  }
}
`;
  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.flows[0]?.tasksReferenciadas[0], "criar_item");
  assert.equal(resultado.ir?.routes[0]?.metodo, "POST");
  assert.equal(resultado.ir?.routes[0]?.inputPublico[0]?.nome, "nome");
  assert.equal(resultado.ir?.routes[0]?.outputPublico[0]?.nome, "item_id");
  assert.equal(resultado.ir?.states[0]?.nome, "status_execucao");
});

test("compilador separa campos inline em blocos declarativos e casos de teste", () => {
  const codigo = `
module exemplo.inline.campos {
  task salvar {
    input { cod: Id required numero: Texto required ativo: Booleano required }
    output { item: Texto status: Texto }
    guarantees {
      item existe
    }
    tests {
      caso "ok" {
        given { cod: "1" numero: "abc" ativo: verdadeiro }
        expect { sucesso: verdadeiro }
      }
    }
  }

  route salvar_publico {
    metodo: POST
    caminho: /salvar
    task: salvar
    input { cod: Id numero: Texto ativo: Booleano }
    output { item: Texto status: Texto }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.equal(resultado.ir?.tasks[0]?.input.length, 3);
  assert.deepEqual(
    resultado.ir?.tasks[0]?.tests[0]?.given.campos.map((campo) => campo.nome),
    ["cod", "numero", "ativo"],
  );
  assert.deepEqual(
    resultado.ir?.tasks[0]?.tests[0]?.given.campos.map((campo) => campo.tipo),
    ["1", "abc", "verdadeiro"],
  );
  assert.deepEqual(
    resultado.ir?.routes[0]?.outputPublico.map((campo) => campo.nome),
    ["item", "status"],
  );
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

test("compilador resolve use relativo ao namespace atual", () => {
  const dominio = `
module app.ingressos.dominio {
  entity Ingresso {
    fields {
      id: Id
      codigo: Texto
    }
  }
}
`;

  const api = `
module app.ingressos.api {
  use dominio

  task consultar {
    input {
      ingresso: Ingresso required
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
          ingresso: "ing-1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarProjeto([
    { caminho: "dominio.sema", codigo: dominio },
    { caminho: "api.sema", codigo: api },
  ]);

  assert.equal(temErros(resultado.diagnosticos), false);
  const moduloApi = resultado.modulos.find((modulo) => modulo.modulo?.nome === "app.ingressos.api");
  assert.deepEqual(moduloApi?.ir?.uses, ["app.ingressos.dominio"]);
});
