// SEMA-GOVERNED: sema.produto.gerador_python_verificacao
// Contrato: contratos/sema/gerador_python_verificacao.sema
// Descrição: executa Python gerado e prova falhas reais para tipos e expectativas divergentes.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compilarCodigo, temErros } from "../../pacotes/nucleo/dist/index.js";
import { gerarPython } from "../../pacotes/gerador-python/dist/index.js";

test("CLI Python expõe SEM125 como falha de domínio antes de escrever artefatos", async () => {
  const temporario = await mkdtemp(path.join(os.tmpdir(), "sema-python-tipo-"));
  try {
    const contrato = path.join(temporario, "formulario.sema");
    await writeFile(contrato, `module teste.entrada_invalida {
      entity Formulario { fields { tipo: Texto } }
      task entregar {
        input { formulario: Formulario required }
        output { ok: Booleano }
        guarantees { ok existe }
        tests { caso "texto" {
          given { formulario: "formulario descritivo" }
          expect { sucesso: verdadeiro }
        } }
      }
    }`, "utf8");
    const execucao = spawnSync(process.execPath, ["pacotes/cli/dist/bin.js", "verificar", contrato, "--alvo", "python", "--sem-cache", "--saida", path.join(temporario, "saida"), "--json"], { encoding: "utf8" });
    assert.equal(execucao.status, 1, execucao.stderr);
    const resultado = JSON.parse(execucao.stdout);
    assert.equal(resultado.kind, "DOMAIN_ERROR");
    assert.equal(resultado.payload.sucesso, false);
    assert.ok(resultado.payload.diagnosticos.some((item: { codigo: string }) => item.codigo === "SEM125"));
    assert.match(resultado.payload.erro, /entidades estruturadas/u);
    assert.equal(resultado.payload.totais.arquivos, 0);
    await assert.rejects(stat(path.join(temporario, "saida")), { code: "ENOENT" });
  } finally {
    await rm(temporario, { recursive: true, force: true });
  }
});

function executar(codigo: string, probe = "", executarCasos = false) {
  const compilacao = compilarCodigo(codigo);
  assert.equal(temErros(compilacao.diagnosticos), false, JSON.stringify(compilacao.diagnosticos));
  assert.ok(compilacao.ir);
  const arquivos = gerarPython(compilacao.ir);
  const modulo = arquivos.find(arquivo => !arquivo.caminhoRelativo.startsWith("test_"))!.conteudo;
  const teste = arquivos.find(arquivo => arquivo.caminhoRelativo.startsWith("test_"))!.conteudo;
  const testesInline = teste.split("\n").filter(linha => !linha.startsWith("from ") && !linha.startsWith("import pytest")).join("\n");
  const chamadas = [...teste.matchAll(/^def (test_\w+)\(/gmu)].map(match => `${match[1]}()`).join("\n");
  const execucao = spawnSync("python", ["-X", "utf8", "-c", `${modulo}\n${executarCasos ? `${testesInline}\n${chamadas}` : probe}`], { encoding: "utf8" });
  assert.ifError(execucao.error);
  return { ...execucao, modulo, teste };
}

test("Python resolve limites positivos, negativos, intervalos e desigualdade sem remover garantias", () => {
  const resultado = executar(`module teste.numeros {
    task medir {
      input { id: Texto required }
      output {
        poolSize: Inteiro
        workersAplicados: Inteiro
        negativo: Inteiro
        intervalo: Decimal
        diferente: Inteiro
      }
      guarantees {
        poolSize > 0
        workersAplicados >= 2
        negativo < -2
        intervalo > 0.1
        intervalo < 0.2
        diferente != 1
      }
    }
  }`, `r = executar_medir(medirEntrada(id="teste"))
assert r.poolSize > 0 and r.workersAplicados >= 2 and r.negativo < -2
assert 0.1 < r.intervalo < 0.2 and r.diferente != 1`);
  assert.equal(resultado.status, 0, resultado.stderr);
});

for (const tipo of ["Json", "Template"]) test(`Python preserva caminho completo de quatro níveis em ${tipo}`, () => {
  const resultado = executar(`module teste.aninhado {
    entity Origem { fields { original_campaign_id: Texto } }
    entity Meta { fields { origem: Origem } }
    entity Template { fields { _template_meta: Meta } }
    task exportar {
      input { id: Texto required }
      output { template: ${tipo} }
      guarantees {
        template._template_meta existe
        template._template_meta.origem existe
        template._template_meta.origem.original_campaign_id existe
      }
    }
  }`, `r = executar_exportar(exportarEntrada(id="teste"))
assert sema_get(r, ["template", "_template_meta", "origem", "original_campaign_id"]) is not None`);
  assert.equal(resultado.status, 0, resultado.stderr);
});

test("Python inicializa pertencimento aninhado e confere expectativa estruturada", () => {
  const resultado = executar(`module teste.worker_status {
    entity Status { fields { desired_action: Texto } }
    task consultar {
      input { id: Texto required }
      output { status: Status }
      guarantees { status.desired_action em ["iniciar", "parar"] }
      tests {
        caso "acao" {
          given { id: "teste" }
          expect { status { desired_action: "iniciar" } }
        }
      }
    }
  }`, "", true);
  assert.equal(resultado.status, 0, resultado.stderr);
});

test("Sema rejeita texto em entidade antes de gerar ou executar Python", () => {
  const resultado = compilarCodigo(`module teste.formulario {
    entity FormularioEntrega { fields { tipo: Texto } }
    task entregar {
      input { formulario: FormularioEntrega required }
      output { sucesso: Booleano }
      tests {
        caso "texto" {
          given { formulario: "formulario com tipo entrega" }
          expect { sucesso: verdadeiro }
        }
      }
    }
  }`);
  assert.ok(resultado.diagnosticos.some(diagnostico => diagnostico.codigo === "SEM125"));
  assert.throws(() => gerarPython(resultado.ir!), /SEM125/u);
});

test("Python aceita given estruturado e verifica propriedade da entidade", () => {
  const resultado = executar(`module teste.formulario_valido {
    entity FormularioEntrega { fields { tipo: Texto } }
    task entregar {
      input { formulario: FormularioEntrega required }
      output { sucesso: Booleano }
      rules { formulario.tipo existe }
      guarantees { sucesso == verdadeiro }
      tests {
        caso "objeto" {
          given { formulario { tipo: "entrega" } }
          expect { sucesso: verdadeiro }
        }
      }
    }
  }`, "", true);
  assert.equal(resultado.status, 0, resultado.stderr);
});

test("Python reprova expect divergente sem copiar expectativa para a saída", () => {
  const resultado = executar(`module teste.expect_divergente {
    task medir {
      input { id: Texto required }
      output { total: Inteiro }
      guarantees { total == 1 }
      tests {
        caso "divergente" {
          given { id: "teste" }
          expect { total: 9 }
        }
      }
    }
  }`, "", true);
  assert.notEqual(resultado.status, 0);
  assert.match(resultado.stderr, /AssertionError: Expectativa divergente: total/u);
  assert.doesNotMatch(resultado.modulo, /sema_set\([^\n]*9/u);
});

test("Python falha explicitamente quando garantias numéricas são contraditórias", () => {
  const resultado = executar(`module teste.contradicao {
    task medir {
      input { id: Texto required }
      output { total: Inteiro }
      guarantees {
        total > 5
        total < 3
      }
    }
  }`, 'executar_medir(medirEntrada(id="teste"))');
  assert.notEqual(resultado.status, 0);
  assert.match(resultado.stderr, /Não foi possível sintetizar/u);
});

test("Python não transforma resultado demonstrativo em evidência de implementação externa", () => {
  const resultado = executar(`module teste.andaime {
    task medir {
      input { id: Texto required }
      output { total: Inteiro }
      impl { py: app.banco.medir }
      guarantees { total existe }
    }
  }`);
  assert.match(resultado.modulo, /Andaime demonstrativo/u);
  assert.match(resultado.modulo, /não executa a implementação externa vinculada/u);
});

test("exemplo público Python executa os quatro casos e exige os expect declarados", () => {
  const codigo = readFileSync("exemplos/python_verificacao.sema", "utf8");
  const resultado = executar(codigo, "", true);
  assert.equal(resultado.status, 0, resultado.stderr);
  const divergente = executar(codigo.replace("poolSize: 1", "poolSize: 9"), "", true);
  assert.notEqual(divergente.status, 0);
  assert.match(divergente.stderr, /Expectativa divergente: poolSize/u);
});
