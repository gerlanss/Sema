// SEMA-GOVERNED: sema.produto.cli_init_templates
// Descricao: prova que linguagens e tecnologias suportadas estao explicitas em docs, help e gramatica.

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compilarCodigo } from "../../pacotes/nucleo/dist/index.js";

const ORIGENS_CANONICAS = [
  "ts", "typescript", "js", "javascript", "py", "python", "dart", "lua",
  "cs", "csharp", "dotnet", "java", "go", "golang", "rust", "rs",
  "cpp", "cxx", "cc", "c++", "php",
] as const;

const CONTRATO_IMPL = (campo: string) => `module exemplo.origens {
  entity Item {
    fields {
      id: Id
    }
  }
  task criar_item {
    input {
      nome: Texto required
    }
    output {
      item: Item
    }
    guarantees {
      item existe
    }
    impl {
      ${campo}: exemplo.origens.criarItem
    }
  }
}
`;

test("toda origem canonica de impl valida no nucleo, incluindo php", () => {
  for (const origem of ORIGENS_CANONICAS) {
    const resultado = compilarCodigo(CONTRATO_IMPL(origem), `contrato-${origem}.sema`);
    const erros = resultado.diagnosticos.filter((diagnostico) => diagnostico.severidade === "erro");
    assert.equal(erros.length, 0, `origem ${origem} deveria validar: ${JSON.stringify(erros)}`);
  }
});

test("papel de impl combina com qualquer origem, nao so typescript", () => {
  for (const campo of ["php_rota", "php_servico", "py_persistencia", "cs_repositorio", "go_rota", "rust_servico"]) {
    const resultado = compilarCodigo(CONTRATO_IMPL(campo), `contrato-papel-${campo}.sema`);
    const erros = resultado.diagnosticos.filter((diagnostico) => diagnostico.severidade === "erro");
    assert.equal(erros.length, 0, `campo ${campo} deveria validar: ${JSON.stringify(erros)}`);
  }
});

test("template de commands.md lista as onze origens com aliases e php", async () => {
  const template = await readFile(new URL("../../pacotes/cli/src/agentEntryPoints.ts", import.meta.url), "utf8");
  const linhaOrigens = template.split("\n").find((linha) => linha.includes("Origins for \\`use\\` and \\`impl\\`"));
  assert.ok(linhaOrigens, "commands.md template deveria ter a linha de origens");
  for (const token of ["php", "golang", "rs", "cxx", "csharp"]) {
    assert.ok(linhaOrigens.includes(token), `linha de origens deveria citar ${token}`);
  }
});

test("help do iniciar lista todos os quatorze templates", async () => {
  const help = await readFile(new URL("../../pacotes/cli/src/cliHelpTexto.ts", import.meta.url), "utf8");
  const linhaIniciar = help.split("\n").find((linha) => linha.includes("sema iniciar --template"));
  assert.ok(linhaIniciar, "help deveria ter a linha do iniciar");
  for (const template of [
    "node-firebase-worker", "aspnet-api", "springboot-api",
    "go-http-api", "rust-axum-api", "cpp-service-bridge",
  ]) {
    assert.ok(linhaIniciar.includes(template), `help do iniciar deveria citar ${template}`);
  }
});

test("exemplo oficial php_crud valida com papeis php em camadas", async () => {
  const exemplo = await readFile(new URL("../../exemplos/php_crud.sema", import.meta.url), "utf8");
  const resultado = compilarCodigo(exemplo, "php_crud.sema");
  const erros = resultado.diagnosticos.filter((diagnostico) => diagnostico.severidade === "erro");
  assert.equal(erros.length, 0);
  const criarParams = resultado.ir!.tasks[0]!.implementacoesExternas;
  assert.equal(criarParams.length, 3);
  assert.deepEqual(
    criarParams.map((impl) => `${impl.origem}:${impl.papel ?? "-"}`),
    ["php:rota", "php:servico", "php:persistencia"],
  );
});
