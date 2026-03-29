import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
