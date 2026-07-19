// SEMA-GOVERNED
// Módulo: sema.produto.geradores_nativos
// Contrato: contratos/sema/geradores_nativos.sema
// Descrição: prova geração, compilação e execução reais dos alvos C#/.NET e C++.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compilarCodigo, temErros } from "../../pacotes/nucleo/dist/index.js";
import { gerarDotNet } from "../../pacotes/gerador-dotnet/dist/index.js";
import { gerarCpp } from "../../pacotes/gerador-cpp/dist/index.js";
import { executarTestesGerados } from "../../pacotes/cli/dist/geracaoCore.js";
import { normalizarAlvo } from "../../pacotes/cli/dist/projetoConfig.js";
import { resolverToolchainCpp } from "../../pacotes/cli/dist/nativeToolchains.js";
import { avaliarDependenciasVerificacao } from "../../pacotes/cli/dist/doctorCommand.js";

type Arquivo = { caminhoRelativo: string; conteudo: string };

async function carregarIrNativo(caminhoRelativo = "exemplos/crud_simples.sema") {
  const caminho = path.resolve(caminhoRelativo);
  const codigo = await readFile(caminho, "utf8");
  const resultado = compilarCodigo(codigo, caminho);
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);
  return resultado.ir;
}

async function materializar(base: string, arquivos: Arquivo[]): Promise<void> {
  for (const arquivo of arquivos) {
    const destino = path.join(base, arquivo.caminhoRelativo);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, arquivo.conteudo, "utf8");
  }
}

test("aliases públicos normalizam para os alvos nativos canônicos", () => {
  assert.equal(normalizarAlvo("dotnet"), "dotnet");
  assert.equal(normalizarAlvo("cs"), "dotnet");
  assert.equal(normalizarAlvo("csharp"), "dotnet");
  assert.equal(normalizarAlvo("cpp"), "cpp");
  assert.equal(normalizarAlvo("c++"), "cpp");
  assert.equal(normalizarAlvo("cxx"), "cpp");
  assert.equal(normalizarAlvo("cc"), "cpp");
});

test("doctor bloqueia os alvos nativos antes de gerar quando as toolchains faltam", { concurrency: false }, () => {
  const pathOriginal = process.env.PATH;
  const programFilesX86Original = process.env["ProgramFiles(x86)"];
  process.env.PATH = path.dirname(process.execPath);
  delete process.env["ProgramFiles(x86)"];
  try {
    const verificacao = avaliarDependenciasVerificacao([
      { alvo: "dotnet", framework: "base" },
      { alvo: "cpp", framework: "base" },
    ]);
    assert.equal(verificacao.ok, false);
    assert.ok(verificacao.faltando.some((item) => item.comando === "verificar/dotnet" && item.nome === "dotnet"));
    assert.ok(verificacao.faltando.some((item) => item.comando === "verificar/cpp" && item.nome === "compilador_cpp"));
  } finally {
    process.env.PATH = pathOriginal;
    if (programFilesX86Original === undefined) {
      delete process.env["ProgramFiles(x86)"];
    } else {
      process.env["ProgramFiles(x86)"] = programFilesX86Original;
    }
  }
});

test("sema testar falha antes de materializar saída quando a toolchain nativa falta", { concurrency: false }, async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-native-missing-toolchain-"));
  const saida = path.join(base, "saida-nao-criada");
  const cli = path.resolve("pacotes/cli/dist/index.js");
  const contrato = path.resolve("exemplos/crud_simples.sema");
  const env = { ...process.env, PATH: path.dirname(process.execPath) };
  delete env["ProgramFiles(x86)"];
  try {
    const execucao = spawnSync(process.execPath, [cli, "testar", contrato, "--alvo", "dotnet", "--saida", saida], {
      cwd: base,
      env,
      encoding: "utf8",
    });
    assert.equal(execucao.status, 1, `${execucao.stdout ?? ""}\n${execucao.stderr ?? ""}`);
    assert.match(`${execucao.stdout ?? ""}\n${execucao.stderr ?? ""}`, /dotnet/u);
    await assert.rejects(() => stat(saida));
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
});

test("gerador .NET emite projeto governado, compila e executa casos Sema", { concurrency: false }, async () => {
  const ir = await carregarIrNativo();
  const arquivos = gerarDotNet(ir);
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo.endsWith(".csproj")));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo.endsWith(".Tests.csproj")));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo.endsWith(".cs") && arquivo.conteudo.includes("SEMA-GOVERNED")));
  assert.ok(arquivos.reduce((total, arquivo) => total + (arquivo.conteudo.match(/SEMA-TEST:/g) ?? []).length, 0) >= 2);

  const base = await mkdtemp(path.join(os.tmpdir(), "sema-native-dotnet-"));
  try {
    await materializar(base, arquivos);
    const execucao = executarTestesGerados("dotnet", base, arquivos, true);
    assert.equal(execucao.codigoSaida, 0, `${execucao.saidaPadrao}\n${execucao.saidaErro}`);
    assert.ok(execucao.quantidadeTestes >= 2);
    assert.match(execucao.saidaPadrao, /ok \d+ testes/);
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
});

test("gerador .NET materializa guarantees e valida campos expect reais", { concurrency: false }, async () => {
  const ir = await carregarIrNativo("contratos/sema/geradores_nativos.sema");
  const arquivos = gerarDotNet(ir);
  const testes = arquivos.find((arquivo) => arquivo.caminhoRelativo.endsWith(".Tests.cs"));
  assert.ok(testes);
  assert.match(testes.conteudo, /SemaAssert\.Equal\(true, output\./u);

  const base = await mkdtemp(path.join(os.tmpdir(), "sema-native-dotnet-expect-"));
  try {
    await materializar(base, arquivos);
    const execucao = executarTestesGerados("dotnet", base, arquivos, true);
    assert.equal(execucao.codigoSaida, 0, `${execucao.saidaPadrao}\n${execucao.saidaErro}`);
    assert.equal(execucao.quantidadeTestes, 4);
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
});

test("gerador C++ emite CMake e C++20 governado, compila e executa casos Sema", { concurrency: false }, async () => {
  const toolchain = resolverToolchainCpp();
  assert.ok(toolchain, "GCC, Clang ou MSVC deve estar disponível para o smoke C++.");

  const ir = await carregarIrNativo();
  const arquivos = gerarCpp(ir);
  assert.ok(arquivos.some((arquivo) => path.basename(arquivo.caminhoRelativo) === "CMakeLists.txt"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo.endsWith(".hpp") && arquivo.conteudo.includes("SEMA-GOVERNED")));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo.endsWith(".cpp") && arquivo.conteudo.includes("SEMA-TEST:")));

  const base = await mkdtemp(path.join(os.tmpdir(), "sema-native-cpp-"));
  try {
    await materializar(base, arquivos);
    const execucao = executarTestesGerados("cpp", base, arquivos, true);
    assert.equal(execucao.codigoSaida, 0, `${execucao.saidaPadrao}\n${execucao.saidaErro}`);
    assert.ok(execucao.quantidadeTestes >= 2);
    assert.match(execucao.saidaPadrao, /ok \d+ testes/);
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
});

test("gerador C++ materializa Timestamp e guarantee aninhada no MSVC", { concurrency: false }, async () => {
  const ir = await carregarIrNativo("exemplos/multi_tenant.sema");
  const arquivos = gerarCpp(ir);
  assert.doesNotMatch(arquivos.map((arquivo) => arquivo.conteudo).join("\n"), /\{\{\}\}/u);

  const base = await mkdtemp(path.join(os.tmpdir(), "sema-native-cpp-multitenant-"));
  try {
    await materializar(base, arquivos);
    const execucao = executarTestesGerados("cpp", base, arquivos, true);
    assert.equal(execucao.codigoSaida, 0, `${execucao.saidaPadrao}\n${execucao.saidaErro}`);
    assert.equal(execucao.quantidadeTestes, 3);
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
});

test("verificação de projeto executa os dois alvos nativos quando configurados", { concurrency: false }, async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-native-verify-"));
  const contratos = path.join(base, "contratos");
  const saida = path.join(base, ".tmp", "verificacao");
  const cli = path.resolve("pacotes/cli/dist/index.js");
  try {
    await mkdir(contratos, { recursive: true });
    await writeFile(
      path.join(contratos, "crud_simples.sema"),
      await readFile(path.resolve("exemplos/crud_simples.sema"), "utf8"),
      "utf8",
    );
    await writeFile(
      path.join(base, "sema.config.json"),
      `${JSON.stringify({
        origens: ["./contratos"],
        saida: "./generated",
        alvos: ["cs", "c++"],
        alvoPadrao: "cs",
        estruturaSaida: "modulos",
        framework: "base",
        modoEstrito: true,
      }, null, 2)}\n`,
      "utf8",
    );

    const execucao = spawnSync(process.execPath, [cli, "verificar", ".", "--saida", saida], {
      cwd: base,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(execucao.status, 0, `${execucao.stdout ?? ""}\n${execucao.stderr ?? ""}`);
    assert.match(execucao.stdout, /alvo=dotnet .*status=ok/u);
    assert.match(execucao.stdout, /alvo=cpp .*status=ok/u);
    assert.match(execucao.stdout, /Totais: modulos=1 alvos=2/u);
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
});
