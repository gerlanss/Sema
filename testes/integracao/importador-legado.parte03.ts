// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  criarProjetoAngularConsumer,
  criarProjetoAngularStandaloneConsumer,
  criarProjetoCppBridge,
  criarProjetoDotnetAspNet,
  criarProjetoFirebaseWorker,
  criarProjetoFlaskEstiloGestech,
  criarProjetoFlutterConsumer,
  criarProjetoGoHttp,
  criarProjetoNextJsAppRouter,
  criarProjetoNextJsConsumer,
  criarProjetoNextJsAppRouterSemantico,
  criarProjetoPhpLaravel,
  criarProjetoReactViteConsumer,
  criarProjetoRustAxum,
  criarProjetoSpringBoot,
} from "./futebot-fixture.ts";
const CLI = path.resolve("pacotes/cli/dist/index.js");
const SEMA_SMOKE_REAL = process.env.SEMA_SMOKE_REAL === "1";
function executarImportacao(args: string[], cwd?: string) {
  return spawnSync("node", [CLI, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
  });
}
function registrarSmokeReal(condicao: boolean, nome: string, corpo: () => Promise<void> | void) {
  if (!condicao) {
    return;
  }

  if (!SEMA_SMOKE_REAL) {
    test(nome, { skip: "Defina SEMA_SMOKE_REAL=1 para rodar smoke real externo e instavel." }, () => {});
    return;
  }

  test(nome, corpo);
}
registrarSmokeReal(existsSync("C:\\GitHub\\Teste2\\backend"), "smoke real: importa backend NestJS do Teste2 com sucesso", async () => {
    const baseSaida = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-nest-"));

    try {
      const execucao = executarImportacao(["importar", "nestjs", "C:\\GitHub\\Teste2\\backend", "--saida", baseSaida, "--json"], path.resolve("."));
      assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

      const json = JSON.parse(execucao.stdout);
      assert.equal(json.resumo.sucesso, true);
      assert.equal(json.resumo.modulos >= 1, true);
      assert.equal(json.resumo.rotas >= 1, true);
      assert.equal(json.resumo.tarefas >= 1, true);
    } finally {
      await rm(baseSaida, { recursive: true, force: true });
    }
});
registrarSmokeReal(existsSync("C:\\GitHub\\Gestech\\Lothar.io\\apps\\dashboard"), "smoke real: importa Next.js do Gestech pela raiz, pelo api root e por subpasta concreta", async () => {
    const baseRaiz = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-next-root-"));
    const baseApi = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-next-api-"));
    const baseSubpasta = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-next-sub-"));

    try {
      const diretorioRaiz = "C:\\GitHub\\Gestech\\Lothar.io\\apps\\dashboard";
      const diretorioApi = path.join(diretorioRaiz, "src", "app", "api");
      const diretorioSubpasta = path.join(diretorioApi, "auth", "login");

      const execucaoRaiz = executarImportacao(["importar", "nextjs", diretorioRaiz, "--saida", baseRaiz, "--json"], path.resolve("."));
      assert.equal(execucaoRaiz.status, 0, execucaoRaiz.stderr || execucaoRaiz.stdout);
      const jsonRaiz = JSON.parse(execucaoRaiz.stdout);
      assert.equal(jsonRaiz.resumo.sucesso, true);
      assert.equal(jsonRaiz.resumo.modulos >= 1, true);
      assert.equal(jsonRaiz.resumo.rotas >= 1, true);
      const arquivoQuery = path.join(baseRaiz, "api", "local_firestore", "query.sema");
      if (existsSync(arquivoQuery)) {
        const conteudoQuery = await readFile(arquivoQuery, "utf8");
        assert.match(conteudoQuery, /collection: Texto/);
      }

      const execucaoApi = executarImportacao(["importar", "nextjs", diretorioApi, "--saida", baseApi, "--json"], path.resolve("."));
      assert.equal(execucaoApi.status, 0, execucaoApi.stderr || execucaoApi.stdout);
      const jsonApi = JSON.parse(execucaoApi.stdout);
      assert.equal(jsonApi.resumo.sucesso, true);
      assert.equal(jsonApi.resumo.modulos >= 1, true);
      assert.equal(jsonApi.resumo.rotas >= 1, true);

      const execucaoSubpasta = executarImportacao(["importar", "nextjs", diretorioSubpasta, "--saida", baseSubpasta, "--json"], path.resolve("."));
      assert.equal(execucaoSubpasta.status, 0, execucaoSubpasta.stderr || execucaoSubpasta.stdout);
      const jsonSubpasta = JSON.parse(execucaoSubpasta.stdout);
      assert.equal(jsonSubpasta.resumo.sucesso, true);
      assert.equal(jsonSubpasta.resumo.modulos, 1);
      assert.equal(jsonSubpasta.resumo.rotas >= 1, true);

      const arquivoLogin = path.join(baseSubpasta, "api", "auth", "login.sema");
      assert.equal(existsSync(arquivoLogin), true);
      const conteudoLogin = await readFile(arquivoLogin, "utf8");
      assert.match(conteudoLogin, /email: Texto/);
      assert.match(conteudoLogin, /password: Texto/);

      const validacaoSubpasta = executarImportacao(["validar", baseSubpasta, "--json"], path.resolve("."));
      assert.equal(validacaoSubpasta.status, 0, validacaoSubpasta.stderr || validacaoSubpasta.stdout);
      const jsonValidacao = JSON.parse(validacaoSubpasta.stdout);
      assert.equal(jsonValidacao.sucesso, true);
    } finally {
      await rm(baseRaiz, { recursive: true, force: true });
      await rm(baseApi, { recursive: true, force: true });
      await rm(baseSubpasta, { recursive: true, force: true });
    }
});
for (const projetoPython of ["C:\\GitHub\\BotSauro", "C:\\GitHub\\FuteBot"]) {
  registrarSmokeReal(existsSync(projetoPython), `smoke real: importa projeto Python legado ${path.basename(projetoPython)} com sucesso`, async () => {
      const baseSaida = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-python-"));

      try {
        const execucao = executarImportacao(["importar", "python", projetoPython, "--saida", baseSaida, "--json"], path.resolve("."));
        assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

        const json = JSON.parse(execucao.stdout);
        assert.equal(json.resumo.sucesso, true);
        assert.equal(json.resumo.modulos >= 1, true);
        assert.equal(json.resumo.tarefas >= 1, true);
      } finally {
        await rm(baseSaida, { recursive: true, force: true });
      }
    });
}

test("cli importa projeto Spring Boot legado e gera route + task com impl java", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-java-"));

  try {
    await criarProjetoSpringBoot(base);

    const execucao = executarImportacao(["importar", "java", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "java");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 2, true);

    const arquivo = await readFile(path.join(base, "sema", "main", "java", "com", "acme", "health", "health_controller.sema"), "utf8");
    assert.match(arquivo, /route show_publico/);
    assert.match(arquivo, /java: src\.main\.java\.com\.acme\.health\.health_controller\.HealthController\.show/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Go legado e gera route + task com impl go", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-go-"));

  try {
    await criarProjetoGoHttp(base);

    const execucao = executarImportacao(["importar", "go", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "go");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 2, true);

    const arquivo = await readFile(path.join(base, "sema", "internal", "routes.sema"), "utf8");
    assert.match(arquivo, /route get_health_publico/);
    assert.match(arquivo, /go: internal\.routes\.getHealth/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Rust Axum legado e gera route + task com impl rust", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-rust-"));

  try {
    await criarProjetoRustAxum(base);

    const execucao = executarImportacao(["importar", "rust", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "rust");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 2, true);

    const arquivo = await readFile(path.join(base, "sema", "handlers.sema"), "utf8");
    assert.match(arquivo, /route health_publico/);
    assert.match(arquivo, /rust: src\.handlers\.health/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto C++ bridge legado e gera task com impl cpp", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-cpp-"));

  try {
    await criarProjetoCppBridge(base);

    const execucao = executarImportacao(["importar", "cpp", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "cpp");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.tarefas >= 2, true);
    assert.equal(json.resumo.rotas, 0);

    const arquivo = await readFile(path.join(base, "sema", "runtime.sema"), "utf8");
    assert.match(arquivo, /task process_snapshot/);
    assert.match(arquivo, /cpp: src\.runtime\.RuntimeBridge\.processSnapshot/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto PHP Laravel legado e gera route + task com impl php", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-php-"));

  try {
    await criarProjetoPhpLaravel(base);

    const execucao = executarImportacao(["importar", "php", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "php");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 2, true);

    const arquivo = await readFile(path.join(base, "sema", "http", "controllers", "health_controller.sema"), "utf8");
    assert.match(arquivo, /route show_publico/);
    assert.match(arquivo, /php: app\.http\.controllers\.health_controller\.HealthController\.show/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
