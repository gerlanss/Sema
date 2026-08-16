// SEMA-GOVERNED: sema.produto.cli_init_templates, sema.produto.escrita_segura_workspace, sema.produto.governanca_ia.contexto.entrypoints
// Descrição: prova que o bootstrap preserva arquivos existentes e falha fechado diante de junctions ou marcadores Codex malformados.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { planejarExemplosOficiais } from "../../pacotes/cli/src/exemplosOficiais.js";

const CLI = path.resolve("pacotes/cli/dist/bin.js");
const MARCADOR_INICIO = "<!-- sema:agent-entrypoint:start -->";
const MARCADOR_FIM = "<!-- sema:agent-entrypoint:end -->";

const README_EXISTENTE = Buffer.from(
  "# README existente\r\n\r\nEste conteúdo deve permanecer byte a byte.\r\n",
  "utf8",
);

const CONFIG_EXISTENTE = Buffer.from(`${JSON.stringify({
  origens: ["./contratos"],
  saida: "./generated-existente",
  alvos: ["typescript", "javascript", "python", "php", "dart", "lua", "html", "css"],
  alvoPadrao: "typescript",
  estruturaSaida: "modulos",
  framework: "base",
  modoEstrito: true,
  diretoriosSaidaPorAlvo: {
    typescript: "./generated-existente/typescript",
    javascript: "./generated-existente/javascript",
    python: "./generated-existente/python",
    php: "./generated-existente/php",
    dart: "./generated-existente/dart",
    lua: "./generated-existente/lua",
    html: "./generated-existente/html",
    css: "./generated-existente/css",
  },
  convencoesGeracaoPorProjeto: "base",
}, null, 4)}\r\n`, "utf8");

const CONTRATO_EXISTENTE = Buffer.from(`module existente.pedidos {
  entity Pedido {
    fields {
      id: Id
      status: Texto
      total: Decimal
    }
  }

  task criar_pedido {
    input {
      cliente_id: Id required
      total: Decimal required
    }
    output {
      pedido_id: Id
      status: Texto
    }
    rules {
      total > 0
    }
    effects {
      persistencia Pedido criticidade=alta
      auditoria pedidos
    }
    guarantees {
      pedido_id existe
      status existe
    }
    tests {
      caso "pedido existente" {
        given {
          cliente_id: "existente-1"
          total: 10
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`, "utf8");

interface Sandbox {
  base: string;
  repo: string;
  outside: string;
}

interface AmbienteCliIsolado {
  home: string;
  localAppData: string;
  xdgCacheHome: string;
  raizCacheEsperada: string;
}

async function criarSandbox(prefixo: string): Promise<Sandbox> {
  const base = await mkdtemp(path.join(os.tmpdir(), prefixo));
  const repo = path.join(base, "repo");
  const outside = path.join(base, "outside");
  await Promise.all([
    mkdir(repo, { recursive: true }),
    mkdir(outside, { recursive: true }),
  ]);
  return { base, repo, outside };
}

async function limparSandbox(base: string): Promise<void> {
  await rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}

async function prepararArquivosExistentes(repo: string): Promise<void> {
  await mkdir(path.join(repo, "contratos"), { recursive: true });
  await Promise.all([
    writeFile(path.join(repo, "README.md"), README_EXISTENTE),
    writeFile(path.join(repo, "sema.config.json"), CONFIG_EXISTENTE),
    writeFile(path.join(repo, "contratos", "pedidos.sema"), CONTRATO_EXISTENTE),
  ]);
}

function resolverAmbienteCliIsolado(baseSandbox: string): AmbienteCliIsolado {
  const raizAmbiente = path.join(path.resolve(baseSandbox), ".sema-cli-env");
  const home = path.join(raizAmbiente, "home");
  const localAppData = path.join(raizAmbiente, "local-app-data");
  const xdgCacheHome = path.join(raizAmbiente, "xdg-cache");
  const raizCacheEsperada = process.platform === "win32"
    ? path.join(localAppData, "Sema", "Cache")
    : process.platform === "darwin"
      ? path.join(home, "Library", "Caches", "Sema")
      : path.join(xdgCacheHome, "sema");
  return { home, localAppData, xdgCacheHome, raizCacheEsperada };
}

function executarCli(cwd: string, args: string[], baseSandbox: string) {
  const ambiente = resolverAmbienteCliIsolado(baseSandbox);
  const resultado = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    env: {
      ...process.env,
      HOME: ambiente.home,
      USERPROFILE: ambiente.home,
      LOCALAPPDATA: ambiente.localAppData,
      XDG_CACHE_HOME: ambiente.xdgCacheHome,
    },
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(resultado.error, undefined, resultado.error?.message);
  return resultado;
}

function diagnosticoCli(resultado: ReturnType<typeof executarCli>): string {
  return `status=${resultado.status}\nstdout:\n${resultado.stdout}\nstderr:\n${resultado.stderr}`;
}

function exigirFalhaFatalTexto(resultado: ReturnType<typeof executarCli>): void {
  assert.notEqual(resultado.status, 0, diagnosticoCli(resultado));
  assert.equal(resultado.stdout, "");
  assert.equal(resultado.stderr.trim(), "Falha ao executar a CLI da Sema.");
}

function exigirFalhaFatalJson(resultado: ReturnType<typeof executarCli>): void {
  assert.notEqual(resultado.status, 0, diagnosticoCli(resultado));
  assert.equal(resultado.stderr, "");
  assert.deepEqual(JSON.parse(resultado.stdout), {
    schemaVersion: "sema.cli.control/v1",
    ok: false,
    kind: "FATAL_ERROR",
    code: "CLI_FATAL_ERROR",
    message: "Falha ao executar a CLI da Sema.",
    exitCode: 1,
  });
}

async function criarJunction(alvo: string, caminhoJunction: string): Promise<void> {
  await symlink(alvo, caminhoJunction, process.platform === "win32" ? "junction" : "dir");
}

async function provarSyncCodexFalhaFechado(conteudoOriginal: Buffer): Promise<void> {
  const { base, repo } = await criarSandbox("sema-sync-codex-fail-closed-");
  const agents = path.join(repo, "AGENTS.md");
  const ambiente = resolverAmbienteCliIsolado(base);
  const sentinelaCache = path.join(ambiente.raizCacheEsperada, "sentinela-bootstrap-seguro.txt");
  const conteudoSentinela = Buffer.from("cache isolado do bootstrap seguro\n", "utf8");

  try {
    const relativoCache = path.relative(base, ambiente.raizCacheEsperada);
    assert.equal(path.isAbsolute(relativoCache), false);
    assert.equal(relativoCache === ".." || relativoCache.startsWith(`..${path.sep}`), false);
    await mkdir(ambiente.raizCacheEsperada, { recursive: true });
    await writeFile(sentinelaCache, conteudoSentinela);
    await writeFile(agents, conteudoOriginal);
    const resultado = executarCli(repo, ["sync-codex", "--json"], base);

    assert.notEqual(resultado.status, 0, diagnosticoCli(resultado));
    const payload = JSON.parse(resultado.stdout) as {
      sucesso: boolean;
      resultadosCodex: {
        arquivos: Array<{ caminho: string; status: string }>;
        entrypointsLegadosPendentes: string[];
        entrypointsLegadosLimpos: boolean;
      };
    };
    assert.equal(payload.sucesso, false);
    assert.equal(payload.resultadosCodex.entrypointsLegadosLimpos, false);
    assert.ok(payload.resultadosCodex.entrypointsLegadosPendentes.includes("AGENTS.md"));
    assert.equal(
      payload.resultadosCodex.arquivos.find((arquivo) => arquivo.caminho === "AGENTS.md")?.status,
      "pendente",
    );
    assert.deepEqual(await readFile(agents), conteudoOriginal);
    assert.deepEqual(await readFile(sentinelaCache), conteudoSentinela);
    assert.equal(
      existsSync(path.join(ambiente.raizCacheEsperada, "drift", "v3", "workspaces")),
      true,
    );
  } finally {
    await limparSandbox(base);
  }
}

test("sema iniciar preserva README, configuração e contrato existentes por padrão", async () => {
  const { base, repo } = await criarSandbox("sema-iniciar-preserva-");

  try {
    await prepararArquivosExistentes(repo);
    const resultado = executarCli(repo, ["iniciar", "--template", "base"], base);

    assert.equal(resultado.status, 0, diagnosticoCli(resultado));
    assert.deepEqual(await readFile(path.join(repo, "README.md")), README_EXISTENTE);
    assert.deepEqual(await readFile(path.join(repo, "sema.config.json")), CONFIG_EXISTENTE);
    assert.deepEqual(await readFile(path.join(repo, "contratos", "pedidos.sema")), CONTRATO_EXISTENTE);
  } finally {
    await limparSandbox(base);
  }
});

test("sema iniciar --force sobrescreve explicitamente os destinos do template", async () => {
  const { base, repo } = await criarSandbox("sema-iniciar-force-");

  try {
    await prepararArquivosExistentes(repo);
    const resultado = executarCli(repo, ["iniciar", "--template", "base", "--force"], base);

    assert.equal(resultado.status, 0, diagnosticoCli(resultado));
    const readme = await readFile(path.join(repo, "README.md"), "utf8");
    const config = await readFile(path.join(repo, "sema.config.json"), "utf8");
    const contrato = await readFile(path.join(repo, "contratos", "pedidos.sema"), "utf8");
    assert.match(readme, /^# Projeto Sema/m);
    assert.doesNotMatch(readme, /conteúdo deve permanecer/);
    assert.equal((JSON.parse(config) as { saida: string }).saida, "./generated");
    assert.match(contrato, /module app\.pedidos/);
    assert.doesNotMatch(contrato, /module existente\.pedidos/);
  } finally {
    await limparSandbox(base);
  }
});

test("sema iniciar recusa junction em contratos sem criar pedidos.sema fora do repositório", async () => {
  const { base, repo, outside } = await criarSandbox("sema-iniciar-junction-contratos-");

  try {
    await criarJunction(outside, path.join(repo, "contratos"));
    const resultado = executarCli(repo, ["iniciar", "--template", "base"], base);

    exigirFalhaFatalTexto(resultado);
    assert.equal(existsSync(path.join(outside, "pedidos.sema")), false);
    assert.equal(existsSync(path.join(repo, "README.md")), false);
    assert.equal(existsSync(path.join(repo, "sema.config.json")), false);
  } finally {
    await limparSandbox(base);
  }
});

test("sema iniciar prevalida exemplos e docs antes de criar qualquer arquivo", async () => {
  for (const diretorio of ["exemplos", "docs"]) {
    const { base, repo, outside } = await criarSandbox(`sema-iniciar-junction-${diretorio}-`);

    try {
      await criarJunction(outside, path.join(repo, diretorio));
      const resultado = executarCli(repo, ["iniciar", "--template", "base"], base);

      exigirFalhaFatalTexto(resultado);
      assert.equal(existsSync(path.join(repo, "README.md")), false);
      assert.equal(existsSync(path.join(repo, "sema.config.json")), false);
      assert.equal(existsSync(path.join(repo, "contratos")), false);
      assert.deepEqual(await readdir(outside), []);
    } finally {
      await limparSandbox(base);
    }
  }
});

test("planejamento de exemplos oficiais inclui arvore segura e deterministica", async () => {
  const plano = await planejarExemplosOficiais();
  const caminhos = plano.arquivos.map((arquivo) => arquivo.caminhoRelativo);

  assert.ok(plano.origem);
  assert.ok(caminhos.includes(path.join(
    "exemplos",
    "sistemas-interativos",
    "simulation-3d-calibrated-autonomous.json",
  )));
  assert.ok(caminhos.includes(path.join("exemplos", "sistemas-interativos", "README.md")));
  assert.ok(caminhos.includes(path.join("exemplos", "pipeline-conteudo", "definicao.json")));
  assert.ok(plano.arquivos.every((arquivo) => [".sema", ".json", ".md"].includes(
    path.extname(arquivo.nome).toLowerCase(),
  )));
  assert.deepEqual(
    caminhos,
    [...caminhos].sort((a, b) => a.localeCompare(b, "pt-BR")),
  );
});

test("sema iniciar materializa e preserva exemplos oficiais aninhados", async () => {
  const { base, repo } = await criarSandbox("sema-iniciar-exemplos-aninhados-");
  const preservado = path.join(repo, "exemplos", "sistemas-interativos", "game-pixel-16-bit.json");
  const sentinela = Buffer.from('{"manual":true}\n', "utf8");

  try {
    await mkdir(path.dirname(preservado), { recursive: true });
    await writeFile(preservado, sentinela);
    const resultado = executarCli(repo, ["iniciar", "--template", "base"], base);

    assert.equal(resultado.status, 0, diagnosticoCli(resultado));
    assert.deepEqual(await readFile(preservado), sentinela);
    assert.equal(
      existsSync(path.join(
        repo,
        "exemplos",
        "sistemas-interativos",
        "simulation-3d-calibrated-autonomous.json",
      )),
      true,
    );
    assert.equal(
      existsSync(path.join(repo, "exemplos", "pipeline-conteudo", "README.md")),
      true,
    );
  } finally {
    await limparSandbox(base);
  }
});

test("sema iniciar recusa junction aninhada em exemplos sem escrita externa", async () => {
  const { base, repo, outside } = await criarSandbox("sema-iniciar-junction-exemplo-aninhado-");

  try {
    await mkdir(path.join(repo, "exemplos"), { recursive: true });
    await criarJunction(outside, path.join(repo, "exemplos", "sistemas-interativos"));
    const resultado = executarCli(repo, ["iniciar", "--template", "base"], base);

    exigirFalhaFatalTexto(resultado);
    assert.deepEqual(await readdir(outside), []);
    assert.equal(existsSync(path.join(repo, "README.md")), false);
    assert.equal(existsSync(path.join(repo, "sema.config.json")), false);
    assert.equal(existsSync(path.join(repo, "contratos")), false);
  } finally {
    await limparSandbox(base);
  }
});

test("sync-codex preserva byte a byte AGENTS.md com marcador START aninhado", async () => {
  await provarSyncCodexFalhaFechado(Buffer.from(
    `\uFEFF# Configuração manual\r\n${MARCADOR_INICIO}\r\nbloco antigo\r\n${MARCADOR_INICIO}\r\nbloco aninhado\r\n${MARCADOR_FIM}\r\nrodapé manual\r\n`,
    "utf8",
  ));
});

test("sync-codex preserva byte a byte AGENTS.md com marcador órfão", async () => {
  await provarSyncCodexFalhaFechado(Buffer.from(
    `# Configuração manual\ntexto antes\n${MARCADOR_FIM}\ntexto depois\n`,
    "utf8",
  ));
});

test("sync-codex recusa junction em docs sem escrever fora do repositório", async () => {
  const { base, repo, outside } = await criarSandbox("sema-sync-codex-junction-docs-");

  try {
    await criarJunction(outside, path.join(repo, "docs"));
    const resultado = executarCli(repo, ["sync-codex", "--json"], base);

    exigirFalhaFatalJson(resultado);
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await limparSandbox(base);
  }
});

test("resumo e contexto-ia substituem hardlink local sem alterar o arquivo externo", async () => {
  const { base, repo, outside } = await criarSandbox("sema-contexto-hardlink-");
  const contrato = path.resolve("contratos/sema/cli_runtime_local.sema");
  const sentinela = Buffer.from("conteudo externo intocavel\r\n", "utf8");

  try {
    for (const caso of [
      { comando: "resumo", arquivo: "resumo.curto.txt" },
      { comando: "contexto-ia", arquivo: "agent-context-pack.json" },
    ]) {
      const pastaSaida = path.join(repo, caso.comando);
      const externo = path.join(outside, `${caso.comando}.txt`);
      const destino = path.join(pastaSaida, caso.arquivo);
      await mkdir(pastaSaida, { recursive: true });
      await writeFile(externo, sentinela);
      await link(externo, destino);

      const resultado = executarCli(process.cwd(), [
        caso.comando,
        contrato,
        "--saida",
        pastaSaida,
        "--json",
      ], base);

      assert.equal(resultado.status, 0, diagnosticoCli(resultado));
      assert.deepEqual(await readFile(externo), sentinela);
      assert.notDeepEqual(await readFile(destino), sentinela);
    }
  } finally {
    await limparSandbox(base);
  }
});

test("contexto-ia recusa junction tardia antes de escrever qualquer artefato", async () => {
  const { base, repo, outside } = await criarSandbox("sema-contexto-junction-");
  const contrato = path.resolve("contratos/sema/cli_runtime_local.sema");
  const pastaSaida = path.join(repo, "contexto");

  try {
    await mkdir(pastaSaida, { recursive: true });
    await criarJunction(outside, path.join(pastaSaida, "agent-context-pack.json"));
    const resultado = executarCli(process.cwd(), [
      "contexto-ia",
      contrato,
      "--saida",
      pastaSaida,
      "--json",
    ], base);

    exigirFalhaFatalJson(resultado);
    assert.deepEqual(await readdir(pastaSaida), ["agent-context-pack.json"]);
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await limparSandbox(base);
  }
});
