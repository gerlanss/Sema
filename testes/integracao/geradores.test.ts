import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { compilarCodigo, temErros } from "../../pacotes/nucleo/dist/index.js";
import { gerarTypeScript } from "../../pacotes/gerador-typescript/dist/index.js";
import { gerarPython } from "../../pacotes/gerador-python/dist/index.js";

test("geradores produzem artefatos para o exemplo de calculadora", async () => {
  const caminho = path.resolve("exemplos/calculadora.sema");
  const codigo = await readFile(caminho, "utf8");
  const resultado = compilarCodigo(codigo, caminho);

  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);

  assert.ok(arquivosTs.some((arquivo) => arquivo.caminhoRelativo.endsWith(".ts")));
  assert.ok(arquivosPy.some((arquivo) => arquivo.caminhoRelativo.endsWith(".py")));
  assert.ok(arquivosTs[0]?.conteudo.includes("executar_somar"));
  assert.ok(arquivosPy[0]?.conteudo.includes("def executar_somar"));
});

test("geradores refletem estruturas semanticas mais ricas no exemplo de pagamento", async () => {
  const caminho = path.resolve("exemplos/pagamento.sema");
  const codigo = await readFile(caminho, "utf8");
  const resultado = compilarCodigo(codigo, caminho);

  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);

  assert.ok(arquivosTs[0]?.conteudo.includes("Regra violada"));
  assert.ok(arquivosTs[0]?.conteudo.includes("Garantia violada"));
  assert.ok(arquivosTs[0]?.conteudo.includes("Vinculo de estado: ciclo_pagamento"));
  assert.ok(arquivosTs[0]?.conteudo.includes("transicoes=3"));
  assert.ok(arquivosPy[0]?.conteudo.includes("Efeito estruturado"));
  assert.ok(arquivosPy[0]?.conteudo.includes("Vinculo de estado: ciclo_pagamento"));
  assert.ok(arquivosPy[0]?.conteudo.includes("Garantia violada"));
});

test("geradores refletem contrato executavel de erro e fluxo estruturado", async () => {
  const caminhoErro = path.resolve("exemplos/tratamento_erro.sema");
  const codigoErro = await readFile(caminhoErro, "utf8");
  const resultadoErro = compilarCodigo(codigoErro, caminhoErro);

  assert.equal(temErros(resultadoErro.diagnosticos), false);
  const arquivosTsErro = gerarTypeScript(resultadoErro.ir!);
  const arquivosPyErro = gerarPython(resultadoErro.ir!);
  assert.ok(arquivosTsErro[0]?.conteudo.includes("acesso_negadoErro"));
  assert.ok(arquivosPyErro[0]?.conteudo.includes("acesso_negadoErro"));
  assert.ok(arquivosTsErro[1]?.conteudo.includes("assert.rejects"));
  assert.ok(arquivosPyErro[1]?.conteudo.includes("pytest.raises"));
  assert.ok(arquivosTsErro[0]?.conteudo.includes("rotas_erro=2"));
  assert.ok(arquivosPyErro[0]?.conteudo.includes("rotas_erro=2"));

  const caminhoFlow = path.resolve("exemplos/automacao.sema");
  const codigoFlow = await readFile(caminhoFlow, "utf8");
  const resultadoFlow = compilarCodigo(codigoFlow, caminhoFlow);
  assert.equal(temErros(resultadoFlow.diagnosticos), false);
  const arquivosTsFlow = gerarTypeScript(resultadoFlow.ir!);
  const arquivosPyFlow = gerarPython(resultadoFlow.ir!);
  assert.ok(arquivosTsFlow[0]?.conteudo.includes("estruturadas=3"));
  assert.ok(arquivosTsFlow[0]?.conteudo.includes("ramificacoes=1"));
  assert.ok(arquivosTsFlow[0]?.conteudo.includes("mapeamentos=4"));
  assert.ok(arquivosPyFlow[0]?.conteudo.includes("ramificacoes=1"));
});

test("geradores refletem negacao semantica em TypeScript e Python", () => {
  const codigo = `
module exemplo.geracao.negacao {
  task validar {
    input {
      ativo: Booleano required
      valor: Decimal required
    }
    output {
      aprovado: Booleano
    }
    rules {
      nao (ativo == falso ou valor <= 0)
    }
    guarantees {
      nao (aprovado == falso)
    }
    tests {
      caso "ok" {
        given {
          ativo: verdadeiro
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
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);

  assert.ok(arquivosTs[0]?.conteudo.includes("!("));
  assert.ok(arquivosPy[0]?.conteudo.includes("not ("));
});

test("cli verifica todos os exemplos em lote", () => {
  const execucao = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "verificar", "exemplos", "--saida", "./.tmp/verificacao-integracao"],
    { stdio: "pipe", encoding: "utf8" },
  );

  assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
  assert.match(execucao.stdout, /Resumo da verificacao:/);
  assert.match(execucao.stdout, /Totais: modulos=\d+ alvos=\d+ arquivos=\d+ testes=\d+/);
  assert.match(execucao.stdout, /Verificacao completa concluida com sucesso\./);
});

test("cli compila arquivo com use usando modulos vizinhos como contexto do projeto", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-use-"));
  const pastaProjeto = path.join(baseTemporaria, "projeto");
  const pastaSaida = path.join(baseTemporaria, "saida");
  await mkdir(pastaProjeto, { recursive: true });
  await writeFile(
    path.join(pastaProjeto, "base.sema"),
    `module base.tipos {
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
      caso "busca" {
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
`,
    "utf8",
  );
  await writeFile(
    path.join(pastaProjeto, "app.sema"),
    `module app.cadastro {
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
      caso "registra" {
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
`,
    "utf8",
  );

  const execucao = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "compilar", path.join(pastaProjeto, "app.sema"), "--alvo", "typescript", "--saida", pastaSaida],
    { stdio: "pipe", encoding: "utf8" },
  );

  try {
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    assert.match(execucao.stdout, /Compilacao concluida para o alvo typescript\./);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});
