// SEMA-GOVERNED: sema.produto.fronteira_repositorios, sema.produto.fronteira_repositorios.empacotamento, sema.produto.fronteira_repositorios.empacotamento.smoke
// Consulte contratos/sema/fronteira_repositorios_empacotamento_smoke.sema antes de editar.
// Descricao: orquestra uma unica instalacao isolada do pacote publico e delega as validacoes por responsabilidade.
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { validarBootstrapCodexInstalado } from "./cli-publico/bootstrap-codex.mjs";
import {
  validarArtefatosDistribuicaoContraFonte,
  validarManifestSemDependenciasFile,
  validarReadmePublico,
  validarRuntimeLocalDireto,
} from "./cli-publico/fronteira-publica.mjs";
import { validarPipelineConteudoInstalado } from "./cli-publico/pipeline-conteudo.mjs";
import {
  EXEMPLOS_INTERATIVOS_PUBLICOS,
  validarSistemasInterativosInstalados,
} from "./cli-publico/sistemas-interativos.mjs";
import { validarGeradoresInstalados } from "./cli-publico/toolchains-geradas.mjs";
import {
  ambienteInstalacaoIsolada,
  caminhosCachePluginIsolado,
  caminhosEstadoSemaReal,
  executarFallbackPowerShellAbsoluto,
  executarLauncherAbsoluto,
  fingerprintCaminhos,
  payloadContemCaminhoSensivel,
  validarInstalacaoGlobalIsolada,
} from "./cli-publico/distribuicao-global.mjs";

export {
  executarFallbackPowerShellAbsoluto,
  executarLauncherAbsoluto,
  payloadContemCaminhoSensivel,
};

const raiz = process.cwd();
const pastaPacotes = path.join(raiz, ".tmp", "pacotes-instalador-npm");
const cacheNpm = path.join(raiz, ".tmp", "npm-cache");

function executar(comando, argumentos, cwd, opcoes = {}) {
  const cacheExecucao = opcoes.cacheNpm ?? cacheNpm;
  const ambiente = opcoes.env ?? process.env;
  if (comando === "npm") {
    const npmExecpath = ambiente.npm_execpath?.trim();
    if (!npmExecpath || !path.isAbsolute(npmExecpath)) {
      throw new Error("npm_execpath absoluto é obrigatório para o smoke público isolado.");
    }
    const argumentosIsolados = [...argumentos, "--cache", cacheExecucao];
    execFileSync(process.execPath, [npmExecpath, ...argumentosIsolados], {
      cwd,
      env: ambiente,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(comando, argumentos, {
    cwd,
    env: ambiente,
    stdio: "inherit",
  });
}

function executarComSaida(comando, argumentos, cwd, opcoes = {}) {
  const resultado = spawnSync(comando, argumentos, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...opcoes,
  });
  if (resultado.error) {
    throw resultado.error;
  }
  if (resultado.status !== 0) {
    throw new Error(
      `Command failed (${[comando, ...argumentos].join(" ")}): ${resultado.stderr || resultado.stdout}`,
    );
  }
  return resultado.stdout;
}

function executarJsonCliInstalada(semaBin, argumentos, cwd, opcoes = {}) {
  return JSON.parse(executarComSaida(
    process.execPath,
    [semaBin, ...argumentos, "--json"],
    cwd,
    opcoes,
  ));
}

function ambienteCacheIsolado(raizCache) {
  return {
    ...process.env,
    HOME: raizCache,
    USERPROFILE: raizCache,
    LOCALAPPDATA: raizCache,
    XDG_CACHE_HOME: raizCache,
  };
}

function validarConsultaSemDrift(payload, comando) {
  const configuracao = comando === "resumo" ? payload : payload.configuracao;
  if (
    configuracao.analiseDrift?.modo !== "none" ||
    configuracao.analiseDrift.executada !== false ||
    configuracao.analiseDrift.sucesso !== null ||
    configuracao.analiseDrift.cache !== null
  ) {
    throw new Error(`The installed public CLI executed drift implicitly during ${comando}.`);
  }

  if (comando === "resumo") {
    if (
      payload.resumo?.modoVerificacaoCodigo !== "contratos_apenas" ||
      payload.resumo.scoreSemantico !== null ||
      payload.resumo.confiancaGeral !== null ||
      payload.resumo.consumerFramework !== null ||
      payload.resumo.appRoutes !== null ||
      payload.resumo.consumerSurfaces !== null ||
      payload.resumo.consumerBridges !== null ||
      payload.resumo.ancoragensVinculo !== null
    ) {
      throw new Error("The installed public CLI fabricated code evidence in the default resumo response.");
    }
    return;
  }

  if (
    configuracao.scoreDrift !== null ||
    configuracao.confiancaGeral !== null ||
    configuracao.consumerFramework !== null ||
    configuracao.appRoutes !== null ||
    configuracao.consumerSurfaces !== null ||
    configuracao.consumerBridges !== null ||
    !payload.projeto?.modulos?.every((modulo) => modulo.implementacao === null)
  ) {
    throw new Error("The installed public CLI fabricated code evidence in the default inspecionar response.");
  }
}

function validarDriftComCache(payload, modo, origem) {
  const cache = payload.escopo_aplicado?.cache;
  if (
    payload.sucesso !== true ||
    cache?.modo !== modo ||
    cache.origem !== origem ||
    cache.schema !== "sema.drift-cache/v3"
  ) {
    throw new Error(`The installed public CLI did not execute drift --cache ${modo} with ${origem} extraction data.`);
  }
  const metricaEsperada = origem === "cache" ? cache.metricas?.hits : cache.metricas?.gravacoes;
  if (typeof metricaEsperada !== "number" || metricaEsperada < 1) {
    throw new Error(`The installed public CLI did not report the expected ${origem} cache metric.`);
  }
}

async function prepararFixtureDriftPublico(projetoCodex) {
  const configPath = path.join(projetoCodex, "sema.config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  await mkdir(path.join(projetoCodex, "src"), { recursive: true });
  await writeFile(path.join(projetoCodex, "contratos", "cache-smoke.sema"), `module app.cache_smoke {
  vinculos { arquivo: "src/service.ts" }
  task executar {
    input { valor: Texto required }
    output { ok: Booleano }
    impl { ts: service.executar }
    guarantees { ok existe }
  }
}
`, "utf8");
  await writeFile(path.join(projetoCodex, "src", "service.ts"), [
    "// SEMA-GOVERNED: app.cache_smoke",
    "// Descrição: implementação mínima para o smoke do cache público instalado.",
    "export function executar(valor: string) { return { ok: valor.length > 0 }; }",
    "",
  ].join("\n"), "utf8");
  await writeFile(configPath, `${JSON.stringify({
    ...config,
    diretoriosCodigo: ["./src"],
    fontesLegado: ["typescript"],
    pontuacaoSemanticaMinimaOperacional: 0,
    pontuacaoSemanticaAlvo: 0,
    pontuacaoSemanticaAlvoFinal: 0,
  }, null, 2)}\n`, "utf8");
  return "contratos/cache-smoke.sema";
}

function validarFronteiraDescoberta(payload, comando) {
  if (
    payload.schemaVersion !== "sema.discovery/v1" ||
    payload.success !== true ||
    payload.executed !== false ||
    payload.workspaceMutated !== false ||
    payload.externalCalls !== false ||
    payload.requiresExplicitRun !== true
  ) {
    throw new Error(`The installed public CLI broke the read-only discovery boundary for ${comando}.`);
  }
}

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

async function localizarTarball(versaoEsperada) {
  const nomeEsperado = `semacode-cli-${versaoEsperada}.tgz`;
  return await existe(path.join(pastaPacotes, nomeEsperado)) ? nomeEsperado : undefined;
}

async function main() {
  const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
  const versaoEsperada = manifestCli.version;
  const tarball = await localizarTarball(versaoEsperada);
  if (!tarball) {
    throw new Error(`The exact npm package semacode-cli-${versaoEsperada}.tgz is missing. Run \`npm run cli:empacotar-publica\` first.`);
  }

  const caminhoTarball = path.join(pastaPacotes, tarball);
  await validarManifestSemDependenciasFile(caminhoTarball, versaoEsperada, raiz);
  await validarArtefatosDistribuicaoContraFonte(caminhoTarball, raiz);
  validarRuntimeLocalDireto(caminhoTarball, raiz);

  const sandbox = await mkdtemp(path.join(os.tmpdir(), "sema-cli-npm-"));

  try {
    const diretorioUsuarioLocalIsolado = path.join(sandbox, "home-local-isolada");
    const cacheNpmLocalIsolado = path.join(sandbox, "npm-cache-local-isolado");
    await mkdir(diretorioUsuarioLocalIsolado, { recursive: true });
    const ambienteLocal = {
      ...ambienteInstalacaoIsolada(diretorioUsuarioLocalIsolado, cacheNpmLocalIsolado),
      npm_config_global: "false",
      NPM_CONFIG_GLOBAL: "false",
    };
    await writeFile(
      path.join(sandbox, "package.json"),
      `${JSON.stringify({
        name: "sema-cli-npm-smoke",
        private: true,
        version: "0.0.0-smoke",
      }, null, 2)}\n`,
      "utf8",
    );

    const caminhosReaisAntesInstallLocal = caminhosEstadoSemaReal();
    const estadoRealAntesInstallLocal = await fingerprintCaminhos(caminhosReaisAntesInstallLocal);
    const caminhosPluginsLocal = caminhosCachePluginIsolado(
      diretorioUsuarioLocalIsolado,
      ambienteLocal,
    );
    const estadoPluginsAntesInstallLocal = await fingerprintCaminhos(caminhosPluginsLocal);
    executar("npm", ["install", caminhoTarball, "--no-audit", "--no-fund"], sandbox, {
      env: ambienteLocal,
      cacheNpm: cacheNpmLocalIsolado,
    });
    if (await existe(path.join(diretorioUsuarioLocalIsolado, ".agents"))
      || await existe(path.join(diretorioUsuarioLocalIsolado, ".sema"))) {
      throw new Error("A workspace-local npm install executed the global Sema distribution lifecycle.");
    }
    if (await fingerprintCaminhos(caminhosReaisAntesInstallLocal) !== estadoRealAntesInstallLocal) {
      throw new Error("The workspace-local npm install mutated a real HOME, workspace, or Sema cache target.");
    }
    if (await fingerprintCaminhos(caminhosPluginsLocal) !== estadoPluginsAntesInstallLocal ||
        (await Promise.all(caminhosPluginsLocal.map(existe))).some(Boolean)) {
      throw new Error("The workspace-local npm install created or mutated an AI plugin cache.");
    }
    const basePacote = path.join(sandbox, "node_modules", "@semacode", "cli");
    const semaBin = path.join(basePacote, "dist", "index.js");
    const deepImport = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", "await import('@semacode/cli/dist/pipelineConteudo/trust.js')"],
      { cwd: sandbox, encoding: "utf8" },
    );
    if (deepImport.status === 0 || !/ERR_PACKAGE_PATH_NOT_EXPORTED/u.test(deepImport.stderr)) {
      throw new Error(`The installed public CLI did not block the internal pipeline deep import: ${deepImport.stderr}`);
    }
    const ajuda = executarComSaida(process.execPath, [semaBin, "--help"], sandbox);
    if (/\bpreflight\b/i.test(ajuda)) {
      throw new Error("The installed public CLI help still exposes the removed preflight command.");
    }
    for (const comando of ["sema descobrir", "sema pipeline", "sema capabilities", "sema interativo"]) {
      if (!ajuda.includes(comando)) {
        throw new Error(`The installed public CLI help is missing ${comando}.`);
      }
    }
    if (!ajuda.includes("sema conteudo capabilities --json") || !ajuda.includes("sema conteudo status")) {
      throw new Error("The installed public CLI help does not expose the AI-native content pipeline.");
    }

    validarPipelineConteudoInstalado({ semaBin, sandbox, executarComSaida });

    const importRaiz = spawnSync(process.execPath, [
      "--input-type=module",
      "--eval",
      "const api = await import('@semacode/cli'); process.stdout.write(JSON.stringify({ exemplos: typeof api.materializarExemplosOficiais, descoberta: typeof api.montarCatalogoCapacidades, interativo: typeof api.validarDefinicaoSistemaInterativo, ir: typeof api.validarExperienceIr, operacao: typeof api.validarSnapshotEngine, temporal: typeof api.validarContratoTemporalInterativo, autonomia: typeof api.validarCicloReparoAutonomo, portabilidade: typeof api.analisarPlanoPortabilidadeInterativa, extensaoCli: typeof api.executarExtensaoCliInterativa, controlRun: typeof api.validarControlRunInterativo }));",
    ], {
      cwd: sandbox,
      encoding: "utf8",
    });
    if (importRaiz.status !== 0) {
      throw new Error(`The installed public CLI root import failed: ${importRaiz.stderr}`);
    }
    const apiPublica = JSON.parse(importRaiz.stdout);
    if (
      importRaiz.stderr !== "" ||
      apiPublica.exemplos !== "function" ||
      apiPublica.descoberta !== "function" ||
      apiPublica.interativo !== "function" ||
      apiPublica.ir !== "function" ||
      apiPublica.operacao !== "function" ||
      apiPublica.temporal !== "function" ||
      apiPublica.autonomia !== "function" ||
      apiPublica.portabilidade !== "function" ||
      apiPublica.extensaoCli !== "function" ||
      apiPublica.controlRun !== "function"
    ) {
      throw new Error("The installed public CLI root import executed the bin or omitted a public API.");
    }

    const catalogoDescoberta = executarJsonCliInstalada(semaBin, ["descobrir", "catalogo"], sandbox);
    validarFronteiraDescoberta(catalogoDescoberta, "descobrir catalogo");
    if (
      catalogoDescoberta.mode !== "catalog" ||
      !catalogoDescoberta.entries?.some((item) => item.id === "simulation.calibrate")
    ) {
      throw new Error("The installed public CLI discovery catalog omitted simulation.calibrate.");
    }

    const recomendacaoDescoberta = executarJsonCliInstalada(
      semaBin,
      ["descobrir", "recomendar", "--intencao", "simulador 3D autônomo calibrado"],
      sandbox,
    );
    validarFronteiraDescoberta(recomendacaoDescoberta, "descobrir recomendar");
    if (
      recomendacaoDescoberta.mode !== "ranking" ||
      recomendacaoDescoberta.noMatch !== false ||
      recomendacaoDescoberta.recommendations?.[0]?.id !== "simulation.calibrate"
    ) {
      throw new Error("The installed public CLI did not recommend the calibrated simulation pipeline.");
    }

    const pipelinesDescoberta = executarJsonCliInstalada(semaBin, ["pipeline", "listar"], sandbox);
    validarFronteiraDescoberta(pipelinesDescoberta, "pipeline listar");
    if (
      !pipelinesDescoberta.entries?.some((item) => item.id === "simulation.calibrate") ||
      !pipelinesDescoberta.entries?.every((item) => item.kind === "ORCHESTRATION_PIPELINE")
    ) {
      throw new Error("The installed public CLI pipeline alias returned an invalid catalog.");
    }

    const capabilitiesDescoberta = executarJsonCliInstalada(semaBin, ["capabilities"], sandbox);
    validarFronteiraDescoberta(capabilitiesDescoberta, "capabilities");
    if (
      capabilitiesDescoberta.mode !== "catalog" ||
      capabilitiesDescoberta.entries?.map((item) => item.id).join("\n") !==
        catalogoDescoberta.entries?.map((item) => item.id).join("\n")
    ) {
      throw new Error("The installed public CLI capabilities alias diverged from the discovery catalog.");
    }

    const versao = executarComSaida(process.execPath, [semaBin, "--version"], sandbox).trim();
    if (versao !== versaoEsperada) {
      throw new Error(`The installed public CLI returned ${versao}; expected ${versaoEsperada}.`);
    }
    await validarInstalacaoGlobalIsolada({
      caminhoTarball,
      sandbox,
      versaoEsperada,
      executar,
      existe,
      raizWorkspace: raiz,
    });

    const preflightRemovido = spawnSync(process.execPath, [semaBin, "preflight", "resumo", "--json"], {
      cwd: sandbox,
      encoding: "utf8",
    });
    if (preflightRemovido.status === 0) {
      throw new Error("The installed public CLI still executes the removed preflight command.");
    }

    const raizCacheBootstrap = path.join(sandbox, "cache-bootstrap-isolado");
    const projetoCodex = await validarBootstrapCodexInstalado({
      semaBin,
      sandbox,
      executarComSaida,
      existe,
      exemplosInterativosPublicos: EXEMPLOS_INTERATIVOS_PUBLICOS,
      opcoesExecucao: { env: ambienteCacheIsolado(raizCacheBootstrap) },
    });
    const cacheBootstrapEsperado = process.platform === "win32"
      ? path.join(raizCacheBootstrap, "Sema", "Cache")
      : process.platform === "darwin"
        ? path.join(raizCacheBootstrap, "Library", "Caches", "Sema")
        : path.join(raizCacheBootstrap, "sema");
    if (!(await existe(cacheBootstrapEsperado))) {
      throw new Error("Installed sync-codex did not publish fresh drift into the isolated bootstrap cache.");
    }

    const contratoCache = await prepararFixtureDriftPublico(projetoCodex);
    const raizCacheDrift = path.join(sandbox, "cache-drift-isolado");
    const opcoesCache = { env: ambienteCacheIsolado(raizCacheDrift) };
    const resumoSemDrift = executarJsonCliInstalada(
      semaBin,
      ["resumo", contratoCache, "--micro"],
      projetoCodex,
      opcoesCache,
    );
    validarConsultaSemDrift(resumoSemDrift, "resumo");
    const inspecaoSemDrift = executarJsonCliInstalada(
      semaBin,
      ["inspecionar", contratoCache],
      projetoCodex,
      opcoesCache,
    );
    validarConsultaSemDrift(inspecaoSemDrift, "inspecionar");
    if (await existe(raizCacheDrift)) {
      throw new Error("Default resumo/inspecionar created persistent cache despite --drift none semantics.");
    }

    const driftFresh = executarJsonCliInstalada(
      semaBin,
      ["drift", contratoCache, "--escopo", "modulo", "--cache", "fresh"],
      projetoCodex,
      opcoesCache,
    );
    validarDriftComCache(driftFresh, "fresh", "calculado");
    const driftCache = executarJsonCliInstalada(
      semaBin,
      ["drift", contratoCache, "--escopo", "modulo", "--cache", "cache"],
      projetoCodex,
      opcoesCache,
    );
    validarDriftComCache(driftCache, "cache", "cache");

    const resumoSaida = executarComSaida(
      process.execPath,
      [semaBin, "resumo", path.join(raiz, "exemplos", "calculadora.sema"), "--micro", "--json"],
      sandbox,
    );
    const resumo = JSON.parse(resumoSaida);
    if (
      resumo.comando !== "resumo" ||
      resumo.modulo !== "exemplos.calculadora" ||
      resumo.analiseDrift?.modo !== "none" ||
      resumo.analiseDrift.executada !== false
    ) {
      throw new Error("The installed public CLI did not execute resumo directly against a local contract.");
    }

    executar(process.execPath, [semaBin, "validar", path.join(raiz, "exemplos", "calculadora.sema"), "--json"], sandbox);
    validarReadmePublico(await readFile(path.join(basePacote, "README.md"), "utf8"));
    await validarGeradoresInstalados({ semaBin, basePacote, sandbox, executarComSaida });

    for (const arquivoDoc of [
      "docs/cli.md",
      "docs/commands.md",
      "docs/descoberta-capacidades.md",
      "docs/documentation.md",
      "docs/drift-cache.md",
      "docs/pipeline-conteudo.md",
      "docs/security.md",
      "docs/sistemas-interativos.md",
      "docs/support.md",
    ]) {
      if (!(await existe(path.join(basePacote, arquivoDoc)))) {
        throw new Error(`The public package did not include ${arquivoDoc}.`);
      }
    }

    for (const arquivoExemplo of [
      "exemplos/profile_simulation.sema",
      ...EXEMPLOS_INTERATIVOS_PUBLICOS,
    ]) {
      if (!(await existe(path.join(basePacote, arquivoExemplo)))) {
        throw new Error(`The public package did not include ${arquivoExemplo}.`);
      }
    }

    await validarSistemasInterativosInstalados({
      semaBin,
      sandbox,
      projetoCodex,
      executarJsonCliInstalada,
    });

    for (const arquivoPrivado of [
      "AGENTS.md",
      "llms.txt",
      "llms-full.txt",
      "AGENT_CONTEXT_PACK.json",
      "SEMA_BRIEF.md",
      "SEMA_BRIEF.micro.txt",
      "SEMA_BRIEF.curto.txt",
      "SEMA_INDEX.json",
    ]) {
      if (await existe(path.join(basePacote, arquivoPrivado))) {
        throw new Error(`The public package still includes private workspace artifact ${arquivoPrivado}.`);
      }
    }

    for (const [profile, arquivo] of [
      ["software", "profile_software.sema"],
      ["workflow", "profile_workflow_n8n.sema"],
      ["ops", "profile_ops.sema"],
      ["game", "profile_game.sema"],
      ["simulation", "profile_simulation.sema"],
      ["legal", "profile_legal.sema"],
      ["research", "profile_research.sema"],
    ]) {
      const resultadoProfile = spawnSync(
        process.execPath,
        [semaBin, "profile", "validar", profile, path.join(basePacote, "exemplos", arquivo), "--json"],
        {
          cwd: sandbox,
          encoding: "utf8",
        },
      );
      if (resultadoProfile.status !== 0) {
        throw new Error(`The npm package failed profile ${profile}: ${resultadoProfile.stderr || resultadoProfile.stdout}`);
      }
      const jsonProfile = JSON.parse(resultadoProfile.stdout);
      if (!jsonProfile.aprovado || jsonProfile.bloqueado) {
        throw new Error(`The npm package did not approve the ${profile} example.`);
      }
    }

    const pacotesInternosAninhados = path.join(sandbox, "node_modules", "@semacode", "cli", "node_modules", "@sema");
    const pacotesInternosHoistados = path.join(sandbox, "node_modules", "@sema");
    if (!(await existe(pacotesInternosAninhados)) && !(await existe(pacotesInternosHoistados))) {
      throw new Error("The npm install did not load the expected bundled @sema packages.");
    }

    const geradorLuaAninhado = path.join(pacotesInternosAninhados, "gerador-lua", "package.json");
    const geradorLuaHoistado = path.join(pacotesInternosHoistados, "gerador-lua", "package.json");
    if (!(await existe(geradorLuaAninhado)) && !(await existe(geradorLuaHoistado))) {
      throw new Error("The npm install did not include @sema/gerador-lua.");
    }

    const manifestInstalado = JSON.parse(await readFile(path.join(basePacote, "package.json"), "utf8"));
    if (
      manifestInstalado.scripts?.postinstall !== "node scripts/postinstall.mjs" ||
      !(await existe(path.join(basePacote, "scripts", "postinstall.mjs"))) ||
      !(await existe(path.join(basePacote, "skills", "sema", "SKILL.md"))) ||
      !(await existe(path.join(basePacote, "skills", "sema", "agents", "openai.yaml")))
    ) {
      throw new Error("The installed public package omitted the global distribution lifecycle or bundled Sema skill.");
    }
    for (const [nome, versaoDeclarada] of Object.entries(manifestInstalado.dependencies ?? {}).filter(([nome]) => nome.startsWith("@sema/"))) {
      const relativo = nome.slice("@sema/".length);
      const aninhado = path.join(pacotesInternosAninhados, relativo, "package.json");
      const hoistado = path.join(pacotesInternosHoistados, relativo, "package.json");
      const caminhoManifesto = await existe(aninhado) ? aninhado : hoistado;
      const bundled = JSON.parse(await readFile(caminhoManifesto, "utf8"));
      if (bundled.version !== versaoDeclarada) {
        throw new Error(`Installed bundled dependency ${nome} is ${bundled.version}; manifest declares ${versaoDeclarada}.`);
      }
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
}

function executadoDiretamente() {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (executadoDiretamente()) {
  main().catch((erro) => {
    console.error("Failed to validate the public local-only Sema CLI package.");
    console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
    process.exit(1);
  });
}
