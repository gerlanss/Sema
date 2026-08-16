// SEMA-GOVERNED: sema.produto.cli_runtime_local, sema.produto.governanca_ia.contexto.entrypoints
// Descrição: prova que a CLI local executa sem porteiro de produto e sincroniza somente o entrypoint oficial do Codex.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { criarAgentContextPack, criarGuiaCapacidadeIa } from "../../pacotes/cli/src/agentContextPack.ts";
import {
  renderizarDocumentoAgentesPorCapacidade,
  renderizarSemaBoot,
  renderizarSemaSmallModel,
  sincronizarEntrypointCodex,
} from "../../pacotes/cli/src/agentEntryPoints.ts";
import { avaliarDependenciasVerificacao } from "../../pacotes/cli/src/doctorCommand.ts";

const CLI = path.resolve("pacotes/cli/dist/index.js");

const ENTRYPOINTS_LEGADOS = [
  ".github/copilot-instructions.md",
  ".clinerules/00-sema.md",
  ".roo/rules/00-sema.md",
  ".opencode/instructions.md",
  ".cursor/rules/sema.mdc",
  ".claude/CLAUDE.md",
  ".windsurf/rules.md",
] as const;

const BLOCO_SEMA_LEGADO = `<!-- sema:agent-entrypoint:start -->
# Sema para cliente antigo

Execute sema preflight resumo --json.
<!-- sema:agent-entrypoint:end -->
`;

function assertPoliticaModosDrift(conteudo: string, referencia: string): void {
  assert.match(conteudo, /--drift none/u, `${referencia} não ensina consulta contratual sem drift`);
  assert.match(conteudo, /--cache fresh/u, `${referencia} não ensina drift fresh para fechamento`);
  assert.match(
    conteudo,
    /(?:cache[^\n.]{0,180}(?:n[aã]o|not)[^\n.]{0,80}(?:prova|evidence|proof)|cache hit[^\n.]{0,180}(?:do not|does not|never)[^\n.]{0,80}(?:replace|prove)|hit is acceleration, not evidence)/iu,
    `${referencia} não deixa explícito que cache não é prova final`,
  );
}

test("Agent Context Pack declara Codex nativo e CLI local direta", () => {
  const pack = criarAgentContextPack(criarGuiaCapacidadeIa());

  assert.equal(pack.entrypointCodex, "AGENTS.md");
  assert.equal(pack.versao, 7);
  assert.equal(pack.descoberta.schemaVersion, "sema.discovery/v1");
  assert.equal(pack.descoberta.commands.catalogo, "sema descobrir catalogo --json");
  assert.equal(pack.codexNativo, true);
  assert.equal(pack.cliLocalSemAutorizacao, true);
  assert.deepEqual(Object.keys(pack).sort(), [
    "aliasesCapacidade",
    "cliLocalSemAutorizacao",
    "codexNativo",
    "descoberta",
    "entrypointCodex",
    "exemplosOficiais",
    "failClosed",
    "fontes",
    "guiaPorCapacidade",
    "nome",
    "objetivo",
    "ordemLeitura",
    "politicaCodigoGovernado",
    "politicaDesignVisual",
    "politicaIdioma",
    "politicaPlataforma",
    "politicaTimeoutResumo",
    "prioridades",
    "proibicoes",
    "regrasObrigatorias",
    "textoBrutoSobDemanda",
    "versao",
  ].sort());
});

test("resumo de modulo emite exatamente o payload contratado", () => {
  const execucao = spawnSync(process.execPath, [
    CLI,
    "resumo",
    "exemplos/calculadora.sema",
    "--micro",
    "--json",
  ], {
    cwd: path.resolve("."),
    encoding: "utf8",
    stdio: "pipe",
  });

  assert.equal(execucao.status, 0, execucao.stderr);
  const payload = JSON.parse(execucao.stdout);
  assert.deepEqual(Object.keys(payload), [
    "comando",
    "modo",
    "tamanho",
    "geradoEm",
    "arquivo",
    "modulo",
    "pastaSaida",
    "artefatosCompactos",
    "analiseDrift",
    "guiaPorCapacidade",
    "resumo",
    "texto",
  ]);
  assert.equal(payload.comando, "resumo");
  assert.equal(payload.modo, "resumo");
  assert.equal(payload.tamanho, "micro");
  assert.equal(payload.arquivo, path.resolve("exemplos/calculadora.sema"));
  assert.equal(payload.modulo, "exemplos.calculadora");
  assert.equal(payload.pastaSaida, null);
  assert.deepEqual(payload.artefatosCompactos, []);
  assert.equal(payload.analiseDrift.modo, "none");
  assert.equal(payload.analiseDrift.executada, false);
  assert.equal(payload.analiseDrift.sucesso, null);
  assert.equal(payload.analiseDrift.cache, null);
  assert.equal(typeof payload.guiaPorCapacidade, "object");
  assert.equal(typeof payload.resumo, "object");
  assert.equal(payload.resumo.modoVerificacaoCodigo, "contratos_apenas");
  assert.equal(payload.resumo.scoreSemantico, null);
  assert.equal(payload.resumo.confiancaGeral, null);
  assert.equal(payload.resumo.consumerFramework, null);
  assert.equal(payload.resumo.appRoutes, null);
  assert.equal(payload.resumo.consumerSurfaces, null);
  assert.equal(payload.resumo.consumerBridges, null);
  assert.equal(payload.resumo.ancoragensVinculo, null);
  assert.equal(typeof payload.texto, "string");
});

test("resumo de projeto emite exatamente o payload contratado", () => {
  const execucao = spawnSync(process.execPath, [
    CLI,
    "resumo",
    ".",
    "--micro",
    "--json",
  ], {
    cwd: path.resolve("."),
    encoding: "utf8",
    stdio: "pipe",
  });

  assert.equal(execucao.status, 0, execucao.stderr);
  const payload = JSON.parse(execucao.stdout);
  assert.deepEqual(Object.keys(payload), [
    "comando",
    "modo",
    "tamanho",
    "geradoEm",
    "baseProjeto",
    "pastaSaida",
    "artefatos",
    "analiseDrift",
    "guiaPorCapacidade",
    "modulos",
    "texto",
  ]);
  assert.equal(payload.comando, "resumo");
  assert.equal(payload.modo, "resumo");
  assert.equal(payload.tamanho, "micro");
  assert.equal(payload.baseProjeto, path.resolve("."));
  assert.equal(typeof payload.pastaSaida, "string");
  assert.ok(payload.pastaSaida.startsWith(path.resolve(".")));
  assert.ok(Array.isArray(payload.artefatos));
  assert.ok(payload.artefatos.length > 0);
  assert.equal(payload.analiseDrift.modo, "none");
  assert.equal(payload.analiseDrift.executada, false);
  assert.equal(payload.analiseDrift.sucesso, null);
  assert.equal(payload.analiseDrift.cache, null);
  assert.equal(typeof payload.guiaPorCapacidade, "object");
  assert.ok(Array.isArray(payload.modulos));
  assert.ok(payload.modulos.length > 0);
  assert.equal(payload.modulos.every((modulo: Record<string, unknown>) =>
    modulo.modoVerificacaoCodigo === "contratos_apenas" &&
    modulo.scoreSemantico === null &&
    modulo.confiancaGeral === null &&
    modulo.consumerFramework === null &&
    modulo.appRoutes === null &&
    modulo.consumerSurfaces === null &&
    modulo.consumerBridges === null &&
    modulo.ancoragensVinculo === null), true);
  assert.equal(typeof payload.texto, "string");
});

test("inspecionar não fabrica evidência de código por padrão", () => {
  const execucao = spawnSync(process.execPath, [
    CLI,
    "inspecionar",
    "exemplos/calculadora.sema",
    "--json",
  ], {
    cwd: path.resolve("."),
    encoding: "utf8",
    stdio: "pipe",
  });

  assert.equal(execucao.status, 0, execucao.stderr);
  const payload = JSON.parse(execucao.stdout);
  assert.equal(payload.configuracao.analiseDrift.modo, "none");
  assert.equal(payload.configuracao.analiseDrift.executada, false);
  assert.equal(payload.configuracao.analiseDrift.sucesso, null);
  assert.equal(payload.configuracao.analiseDrift.cache, null);
  assert.equal(payload.configuracao.scoreDrift, null);
  assert.equal(payload.configuracao.confiancaGeral, null);
  assert.equal(payload.configuracao.consumerFramework, null);
  assert.equal(payload.configuracao.appRoutes, null);
  assert.equal(payload.configuracao.consumerSurfaces, null);
  assert.equal(payload.configuracao.consumerBridges, null);
  assert.ok(payload.projeto.modulos.length > 0);
  assert.equal(payload.projeto.modulos.every((modulo: { implementacao: unknown }) =>
    modulo.implementacao === null), true);
});

test("sincronização mantém somente o entrypoint oficial do Codex", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-codex-entrypoint-"));

  try {
    for (const entrypoint of ENTRYPOINTS_LEGADOS) {
      await mkdir(path.dirname(path.join(base, entrypoint)), { recursive: true });
      const conteudo = entrypoint === ".github/copilot-instructions.md"
        ? `${BLOCO_SEMA_LEGADO}\n# Configuração manual preservada\n`
        : BLOCO_SEMA_LEGADO;
      await writeFile(path.join(base, entrypoint), conteudo, "utf8");
    }

    const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
    const resultado = await sincronizarEntrypointCodex(base, pack);
    const agents = await readFile(path.join(base, "AGENTS.md"), "utf8");
    const boot = renderizarSemaBoot(pack);
    const smallModel = renderizarSemaSmallModel(pack);
    const aiIntegration = renderizarDocumentoAgentesPorCapacidade(pack);
    const commands = await readFile(path.join(base, "docs", "commands.md"), "utf8");
    const workflow = await readFile(path.join(base, "docs", "ai-workflow.md"), "utf8");

    assert.equal(resultado.entrypointCodex, "AGENTS.md");
    assert.equal(resultado.codexNativo, true);
    assert.equal(resultado.cliLocalSemAutorizacao, true);
    assert.equal(resultado.skillBootstrapCodexDocumentada, true);
    assert.equal(resultado.idiomaHumanoPreservado, true);
    assert.equal(resultado.retryTimeoutProgressivo, true);
    assert.equal(resultado.politicaPlataformaExplicita, true);
    assert.equal(resultado.politicaSinalVsRitualExplicita, true);
    assert.equal(resultado.politicaModosDriftExplicita, true);
    assert.equal(resultado.docsComandos, true);
    assert.equal(resultado.divisaoPorResponsabilidadeExplicita, true);
    assert.equal(resultado.contextoLocalSemEspelho, true);
    assert.equal(resultado.entrypointsLegadosLimpos, true);
    assert.match(agents, /Codex/);
    assert.match(agents, /Use diretamente a CLI local/);
    assert.doesNotMatch(agents, /preflight/i);
    assert.match(aiIntegration, /Generated Lua tests preserve the contract's failure shape/);
    assert.equal(aiIntegration.endsWith("\n"), true);
    for (const [referencia, conteudo] of [
      ["AGENTS.md", agents],
      ["SEMA_BOOT.md", boot],
      ["SEMA_SMALL_MODEL.md", smallModel],
      ["docs/ai-integration.md", aiIntegration],
      ["docs/commands.md", commands],
      ["docs/ai-workflow.md", workflow],
    ] as const) {
      assertPoliticaModosDrift(conteudo, referencia);
    }
    assert.match(commands, /targetSetDigest/);
    assert.match(commands, /sema interativo validar-control-run/);
    assert.match(commands, /validar-evidencia-temporal --bundle-arquivo <file>/);
    assert.match(commands, /outputTargets/);
    assert.match(commands, /Validation-result shapes describe `payload\.resultado`/);
    assert.match(commands, /jobOrchestrationPlan/);
    assert.match(commands, /ordered `queue` is the assignment list/);
    assert.match(commands, /local evidence bundle is never presented as authoritative trust/);
    assert.match(commands, /plans a safe physical scope/);
    assert.match(commands, /only `--escopo projeto` may walk every configured code root/);
    assert.match(commands, /Configured contract origins and code roots are confined before enumeration/);

    const copilotManual = await readFile(path.join(base, ".github/copilot-instructions.md"), "utf8");
    assert.equal(copilotManual, "# Configuração manual preservada\n");

    for (const entrypoint of ENTRYPOINTS_LEGADOS.filter((item) => item !== ".github/copilot-instructions.md")) {
      assert.equal(existsSync(path.join(base, entrypoint)), false, entrypoint);
    }
    assert.equal(existsSync(path.join(base, ".clinerules")), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("sincronização remove o antigo arquivo único .clinerules", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-codex-clinerules-"));

  try {
    await writeFile(path.join(base, ".clinerules"), BLOCO_SEMA_LEGADO, "utf8");
    const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
    const resultado = await sincronizarEntrypointCodex(base, pack);

    assert.equal(resultado.entrypointsLegadosLimpos, true);
    assert.equal(existsSync(path.join(base, ".clinerules")), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("sincronização não declara limpo um entrypoint legado com bloco Sema incompleto", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-codex-entrypoint-pendente-"));
  const legado = path.join(base, ".roo", "rules", "00-sema.md");

  try {
    await mkdir(path.dirname(legado), { recursive: true });
    await writeFile(
      legado,
      "<!-- sema:agent-entrypoint:start -->\n# Sema para cliente antigo\nExecute sema preflight resumo --json.\n",
      "utf8",
    );
    const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
    const resultado = await sincronizarEntrypointCodex(base, pack);

    assert.equal(resultado.entrypointsLegadosLimpos, false);
    assert.deepEqual(resultado.entrypointsLegadosPendentes, [".roo/rules/00-sema.md"]);
    assert.equal(await readFile(legado, "utf8"), "<!-- sema:agent-entrypoint:start -->\n# Sema para cliente antigo\nExecute sema preflight resumo --json.\n");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("sincronização preserva AGENTS manual sem marcadores e sinaliza revisão", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-codex-agents-manual-"));
  const agentsPath = path.join(base, "AGENTS.md");
  const manual = "# Sema\n\n## Regras obrigatorias para IA\n\nRegra antiga.\n\n## Customização manual\n\nNão apagar.\n";

  try {
    await writeFile(agentsPath, manual, "utf8");
    const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
    const resultado = await sincronizarEntrypointCodex(base, pack);
    const atualizado = await readFile(agentsPath, "utf8");

    assert.equal(resultado.entrypointsLegadosLimpos, false);
    assert.deepEqual(resultado.entrypointsLegadosPendentes, ["AGENTS.md"]);
    assert.match(atualizado, /Customização manual/);
    assert.match(atualizado, /Não apagar\./);
    assert.equal((atualizado.match(/sema:agent-entrypoint:start/g) ?? []).length, 1);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("sincronização consolida blocos gerenciados duplicados sem perder texto manual", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-codex-agents-duplicado-"));
  const agentsPath = path.join(base, "AGENTS.md");

  try {
    await writeFile(agentsPath, `${BLOCO_SEMA_LEGADO}\n## Manual\n\nPreservar.\n\n${BLOCO_SEMA_LEGADO}`, "utf8");
    const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
    const resultado = await sincronizarEntrypointCodex(base, pack);
    const atualizado = await readFile(agentsPath, "utf8");

    assert.equal(resultado.entrypointsLegadosLimpos, true);
    assert.equal((atualizado.match(/sema:agent-entrypoint:start/g) ?? []).length, 1);
    assert.match(atualizado, /## Manual\n\nPreservar\./);
    assert.doesNotMatch(atualizado, /preflight/i);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("sincronização preserva AGENTS com marcador incompleto e falha fechada", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-codex-agents-incompleto-"));
  const agentsPath = path.join(base, "AGENTS.md");
  const incompleto = "<!-- sema:agent-entrypoint:start -->\n# Sema\n\nTexto manual sem fechamento.\n";

  try {
    await writeFile(agentsPath, incompleto, "utf8");
    const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
    const resultado = await sincronizarEntrypointCodex(base, pack);

    assert.equal(resultado.entrypointsLegadosLimpos, false);
    assert.deepEqual(resultado.entrypointsLegadosPendentes, ["AGENTS.md"]);
    assert.equal(await readFile(agentsPath, "utf8"), incompleto);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("sema iniciar propaga pendência de AGENTS e retorna falha", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-codex-iniciar-pendente-"));
  const cacheUsuario = `${base}-cache`;
  const agentsPath = path.join(base, "AGENTS.md");
  const manual = "# Sema\n\n## Regras obrigatorias para IA\n\nNão apagar esta configuração manual.\n";

  try {
    await writeFile(agentsPath, manual, "utf8");
    const iniciar = spawnSync(process.execPath, [CLI, "iniciar", "--template", "base"], {
      cwd: base,
      encoding: "utf8",
      stdio: "pipe",
      env: {
        ...process.env,
        HOME: cacheUsuario,
        USERPROFILE: cacheUsuario,
        LOCALAPPDATA: cacheUsuario,
        XDG_CACHE_HOME: cacheUsuario,
      },
    });

    assert.notEqual(iniciar.status, 0);
    assert.match(iniciar.stderr, /AGENTS\.md/);
    assert.match(await readFile(agentsPath, "utf8"), /Não apagar esta configuração manual\./);
    const raizCacheEsperada = process.platform === "win32"
      ? path.join(cacheUsuario, "Sema", "Cache")
      : process.platform === "darwin"
        ? path.join(cacheUsuario, "Library", "Caches", "Sema")
        : path.join(cacheUsuario, "sema");
    assert.equal(existsSync(raizCacheEsperada), true);
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cacheUsuario, { recursive: true, force: true });
  }
});

test("verificação normal exige somente Node na base, não npm", () => {
  const verificacao = avaliarDependenciasVerificacao([
    { alvo: "javascript", framework: "base" },
  ]);
  const base = verificacao.dependencias.find((item) => item.comando === "base");

  assert.ok(base);
  assert.deepEqual(
    base.itens.filter((item) => item.obrigatoria).map((item) => item.nome),
    ["node"],
  );
  assert.equal(base.itens.some((item) => item.nome === "npm"), false);
});

test("verificação de PHP detecta o runner ausente antes da geração", { concurrency: false }, () => {
  const pathOriginal = process.env.PATH;
  process.env.PATH = path.dirname(process.execPath);

  try {
    const verificacao = avaliarDependenciasVerificacao([
      { alvo: "php", framework: "base" },
    ]);

    assert.equal(verificacao.ok, false);
    assert.ok(verificacao.faltando.some((item) =>
      item.comando === "verificar/php" && item.nome === "php"));
  } finally {
    process.env.PATH = pathOriginal;
  }
});

test("superfície pública não oferece o antigo porteiro preflight", () => {
  const ajuda = spawnSync(process.execPath, [CLI, "--help"], {
    encoding: "utf8",
    stdio: "pipe",
  });
  const preflight = spawnSync(process.execPath, [CLI, "preflight", "resumo", "--json"], {
    encoding: "utf8",
    stdio: "pipe",
  });

  assert.equal(ajuda.status, 0, ajuda.stderr);
  assert.match(ajuda.stdout, /sync-codex/);
  assert.doesNotMatch(ajuda.stdout, /sync-ai-entrypoints/);
  assert.doesNotMatch(ajuda.stdout, /preflight/i);
  assert.notEqual(preflight.status, 0);
});

test("import programático da raiz não executa a CLI e preserva APIs públicas", () => {
  const modulo = pathToFileURL(CLI).href;
  const resultado = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    `const api = await import(${JSON.stringify(modulo)}); console.log(JSON.stringify({ exemplos: typeof api.materializarExemplosOficiais, descoberta: typeof api.montarCatalogoCapacidades, interativo: typeof api.validarDefinicaoSistemaInterativo }));`,
  ], {
    encoding: "utf8",
    stdio: "pipe",
  });

  assert.equal(resultado.status, 0, resultado.stderr);
  assert.equal(resultado.stderr, "");
  assert.deepEqual(JSON.parse(resultado.stdout), {
    exemplos: "function",
    descoberta: "function",
    interativo: "function",
  });
});

test("prepack tradicional inclui todas as dependências internas empacotadas", async () => {
  const [manifestoTexto, prepack] = await Promise.all([
    readFile(path.resolve("pacotes/cli/package.json"), "utf8"),
    readFile(path.resolve("pacotes/cli/scripts/prepack-exemplos.mjs"), "utf8"),
  ]);
  const manifesto = JSON.parse(manifestoTexto) as { bundleDependencies: string[] };
  const bloco = prepack.match(/const dependenciasInternas = \[([\s\S]*?)\];/u)?.[1];

  assert.ok(bloco, "lista dependenciasInternas ausente no prepack");
  const dependenciasPrepack = [...bloco.matchAll(/"([^"]+)"/gu)].map((match) => match[1]).sort();
  const dependenciasManifesto = manifesto.bundleDependencies
    .map((nome) => nome.replace(/^@sema\//u, ""))
    .sort();
  assert.deepEqual(dependenciasPrepack, dependenciasManifesto);
  assert.ok(dependenciasPrepack.includes("gerador-dotnet"));
  assert.ok(dependenciasPrepack.includes("gerador-cpp"));
});
