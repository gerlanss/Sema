// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: testa o pacote publico local-only da CLI antes de publicacao npm.
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const raiz = process.cwd();
const pastaPacotes = path.join(raiz, ".tmp", "pacotes-instalador-npm");
const cacheNpm = path.join(raiz, ".tmp", "npm-cache");
const EXEMPLOS_INTERATIVOS_PUBLICOS = [
  "exemplos/sistemas-interativos/README.md",
  "exemplos/sistemas-interativos/game-pixel-16-bit.json",
  "exemplos/sistemas-interativos/simulation-3d-calibrated-autonomous.json",
  "exemplos/sistemas-interativos/simulation-headless-autonomous-batch.json",
  "exemplos/sistemas-interativos/protocol-read-only-valid.json",
  "exemplos/sistemas-interativos/experience-ir-valid.json",
  "exemplos/sistemas-interativos/advanced/acceptance-context-evaluate-valid.json",
  "exemplos/sistemas-interativos/advanced/acceptance-lock-valid.json",
  "exemplos/sistemas-interativos/advanced/asset-provenance-valid.json",
  "exemplos/sistemas-interativos/advanced/autonomy-repair-valid.json",
  "exemplos/sistemas-interativos/advanced/control-run-definition-valid.json",
  "exemplos/sistemas-interativos/advanced/control-run-valid.json",
  "exemplos/sistemas-interativos/advanced/distributed-workers-valid.json",
  "exemplos/sistemas-interativos/advanced/editor-state-valid.json",
  "exemplos/sistemas-interativos/advanced/engine-snapshot-after-valid.json",
  "exemplos/sistemas-interativos/advanced/engine-snapshot-before-valid.json",
  "exemplos/sistemas-interativos/advanced/job-orchestration-valid.json",
  "exemplos/sistemas-interativos/advanced/multimodal-evidence-valid.json",
  "exemplos/sistemas-interativos/advanced/multiplayer-authority-valid.json",
  "exemplos/sistemas-interativos/advanced/playtest-fuzz-valid.json",
  "exemplos/sistemas-interativos/advanced/portability-valid.json",
  "exemplos/sistemas-interativos/advanced/temporal-evidence-valid.json",
  "exemplos/sistemas-interativos/advanced/temporal-valid.json",
];

const MARCADORES_PORTEIRO_LEGADO = [
  { regex: /\bpreflight\b/i, motivo: "legacy preflight terminology" },
  { regex: /\bsema\s+preflight\b/i, motivo: "removed authorization command" },
  { regex: /\b(?:comando|executar)PreflightCli\b/, motivo: "legacy authorization handler" },
  { regex: /\buse_cli_local\b/, motivo: "legacy authorization decision" },
  { regex: /\borigemCobranca\b/, motivo: "legacy billing marker" },
  { regex: /\boperationCode\b/, motivo: "legacy authorization operation code" },
];

const MARCADORES_CONTEUDO_PRIVADO = [
  { regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, motivo: "private key" },
  { regex: /\b(?:DATABASE_URL|DB_PASSWORD)\b/i, motivo: "database credential marker" },
  { regex: /\b(?:api[_-]?key|secret|token|password|senha|credential)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i, motivo: "apparent secret" },
  { regex: /\b(?:AUTH_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|PRIVATE_KEY)\b\s*[:=]\s*["'][A-Za-z0-9_./+=-]{16,}["']/i, motivo: "apparent secret" },
  { regex: /\bSEMA_MCP_AUTH_TOKEN\b|https:\/\/sema\.otimitare\.online\/mcp|\bmcp_servers\.sema\b/i, motivo: "removed Sema MCP surface" },
];

const MARCADOR_NOME_TOOL_MCP_LEGADO = /\bsema_(?:docs_impacto|finalizar_mudanca|inspecionar|drift|impacto|exemplos)\b/i;
const MARCADOR_MOJIBAKE_VISIVEL = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|âš|ï¸/u;
const ARQUIVO_RUNTIME_VISIVEL = /^package\/dist\/(?:(?:discovery|sistemasInterativos)\/[^/]+|(?:agentContext|agentContextPack|agentContextTipos|agentEntryPoints|doctorCommand|docs\.part01|exemplosOficiais|fsGovernado|index\.part0[1-8]|initCommand|initTemplatesBase|workspaceWrite))\.(?:js|d\.ts|json)$/i;

function removerDetectorMigracaoLegada(arquivo, conteudo) {
  if (!/^package\/dist\/agentEntryPoints\.js$/i.test(arquivo)) {
    return conteudo;
  }
  return conteudo.replace(
    /function contemVestigioSemaLegado\([^)]*\) \{[\s\S]*?\n\}/u,
    "",
  );
}

function executar(comando, argumentos, cwd) {
  if (process.platform === "win32" && (comando === "npm" || comando === "npx")) {
    const argumentosIsolados = [...argumentos, "--cache", cacheNpm];
    const cliLocal = path.join(
      path.dirname(process.execPath),
      "node_modules",
      "npm",
      "bin",
      `${comando}-cli.js`,
    );
    if (existsSync(cliLocal)) {
      execFileSync(process.execPath, [cliLocal, ...argumentosIsolados], { cwd, stdio: "inherit" });
      return;
    }
    execFileSync("powershell", ["-NoProfile", "-Command", [comando, ...argumentosIsolados].join(" ")], {
      cwd,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(comando, argumentos, {
    cwd,
    stdio: "inherit",
  });
}

function executarComSaida(comando, argumentos, cwd) {
  const resultado = spawnSync(comando, argumentos, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
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

function executarJsonCliInstalada(semaBin, argumentos, cwd) {
  return JSON.parse(executarComSaida(
    process.execPath,
    [semaBin, ...argumentos, "--json"],
    cwd,
  ));
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

function validarFronteiraInterativa(payload, comando) {
  if (
    payload.sucesso !== true ||
    payload.readOnly !== true ||
    payload.executed !== false ||
    payload.workspaceMutated !== false ||
    payload.authoritative !== false ||
    payload.externalExecutionRequired !== true
  ) {
    throw new Error(`The installed public CLI broke the declarative interactive boundary for ${comando}.`);
  }
}

async function localizarTarball(versaoEsperada) {
  const nomeEsperado = `semacode-cli-${versaoEsperada}.tgz`;
  return await existe(path.join(pastaPacotes, nomeEsperado)) ? nomeEsperado : undefined;
}

async function validarManifestSemDependenciasFile(caminhoTarball, versaoEsperada) {
  const manifest = execFileSync("tar", ["-xOf", caminhoTarball, "package/package.json"], {
    cwd: raiz,
    encoding: "utf8",
  });
  const json = JSON.parse(manifest);
  if (json.version !== versaoEsperada) {
    throw new Error(`The npm package version is ${json.version}; expected ${versaoEsperada}.`);
  }
  const dependencias = Object.values(json.dependencies ?? {});
  if (dependencias.some((valor) => typeof valor === "string" && valor.startsWith("file:"))) {
    throw new Error("The npm package still contains file: dependencies.");
  }
  for (const artifact of ["AGENTS.md", "AGENT_CONTEXT_PACK.json", "SEMA_INDEX.json", "SEMA_BRIEF.md"]) {
    if ((json.files ?? []).includes(artifact)) {
      throw new Error(`The public package manifest must not include private workspace artifact ${artifact}.`);
    }
  }
  if (!String(json.description ?? "").includes("Codex-native")) {
    throw new Error("The public package manifest must describe Sema as Codex-native.");
  }
  const exportRaiz = json.exports?.["."];
  if (
    Object.keys(json.exports ?? {}).length !== 1 ||
    exportRaiz?.types !== "./dist/index.d.ts" ||
    exportRaiz?.import !== "./dist/index.js" ||
    exportRaiz?.default !== "./dist/index.js"
  ) {
    throw new Error("The public package must preserve the root-only exports map from the CLI manifest.");
  }
  for (const keyword of ["codex", "ai-agents", "semantic-governance"]) {
    if (!(json.keywords ?? []).includes(keyword)) {
      throw new Error(`The public package manifest is missing keyword ${keyword}.`);
    }
  }

  const arquivos = execFileSync("tar", ["-tf", caminhoTarball], {
    cwd: raiz,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).split(/\r?\n/u).filter(Boolean);
  for (const [nome, versao] of Object.entries(json.dependencies ?? {}).filter(([nome]) => nome.startsWith("@sema/"))) {
    const manifestoBundled = `package/node_modules/${nome}/package.json`;
    if (!arquivos.includes(manifestoBundled)) {
      throw new Error(`The npm package is missing bundled dependency metadata for ${nome}.`);
    }
    const bundled = JSON.parse(execFileSync("tar", ["-xOf", caminhoTarball, manifestoBundled], {
      cwd: raiz,
      encoding: "utf8",
    }));
    if (bundled.version !== versao) {
      throw new Error(`Bundled dependency ${nome} is ${bundled.version}; manifest declares ${versao}.`);
    }
  }
}

function validarRuntimeLocalDireto(caminhoTarball) {
  const arquivos = execFileSync("tar", ["-tf", caminhoTarball], {
    cwd: raiz,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).split(/\r?\n/u).filter(Boolean);

  const billing = arquivos.find((arquivo) => /(?:^|\/)billing(?:\/|\.|$)/i.test(arquivo));
  if (billing) {
    throw new Error(`The public package still contains removed billing artifact ${billing}.`);
  }

  for (const arquivo of arquivos.filter((item) => /^package\/dist\/.+\.(?:js|d\.ts|json)$/i.test(item))) {
    const conteudo = execFileSync("tar", ["-xOf", caminhoTarball, arquivo], {
      cwd: raiz,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const conteudoAuditavel = removerDetectorMigracaoLegada(arquivo, conteudo);
    const marcador = MARCADORES_PORTEIRO_LEGADO.find(({ regex }) => regex.test(conteudoAuditavel));
    if (marcador) {
      throw new Error(`The public package contains ${marcador.motivo} in ${arquivo}.`);
    }
    if (MARCADOR_NOME_TOOL_MCP_LEGADO.test(conteudoAuditavel)) {
      throw new Error(`The public package contains a legacy Sema MCP tool name in ${arquivo}.`);
    }
    if (ARQUIVO_RUNTIME_VISIVEL.test(arquivo) && MARCADOR_MOJIBAKE_VISIVEL.test(conteudoAuditavel)) {
      throw new Error(`The public package contains visible mojibake in ${arquivo}.`);
    }
  }

  const arquivosPublicosTexto = arquivos.filter((arquivo) =>
    arquivo === "package/README.md" ||
    arquivo === "package/LICENSE" ||
    /^package\/docs\/.+\.(?:md|txt|json|ya?ml)$/i.test(arquivo),
  );
  for (const arquivo of arquivosPublicosTexto) {
    const conteudo = execFileSync("tar", ["-xOf", caminhoTarball, arquivo], {
      cwd: raiz,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const marcadorPrivado = MARCADORES_CONTEUDO_PRIVADO.find(({ regex }) => regex.test(conteudo));
    if (marcadorPrivado) {
      throw new Error(`The public package contains ${marcadorPrivado.motivo} in ${arquivo}.`);
    }
    if (/[\u00c3\u00c2\uFFFD]/u.test(conteudo)) {
      throw new Error(`The public package contains broken encoding markers in ${arquivo}.`);
    }
  }
}

function validarReadmePublico(conteudo) {
  const secoesObrigatorias = [
    "## Install",
    "## Codex Setup",
    "## Local Workflow",
    "## Code Generation",
    "## Public Boundary",
    "## Support",
  ];
  const secoesAusentes = secoesObrigatorias.filter((secao) => !conteudo.includes(secao));
  if (secoesAusentes.length > 0) {
    throw new Error(`The published README is missing required sections: ${secoesAusentes.join(", ")}.`);
  }
  if (!conteudo.includes("suporte@otimitare.online")) {
    throw new Error("The published README must use suporte@otimitare.online for support.");
  }
  if (!conteudo.includes("Codex-native")) {
    throw new Error("The published README must position Sema as Codex-native.");
  }
  if (!conteudo.includes("codex plugin marketplace add gerlanss/Sema") || !conteudo.includes("codex plugin add sema@sema")) {
    throw new Error("The published README must include the explicit Sema Codex skill installation commands.");
  }
  if (!/Sema skill is required for Codex to bootstrap/iu.test(conteudo)) {
    throw new Error("The published README must declare the Sema skill as the required first-contact bootstrap.");
  }
  if (!/not affiliated with or endorsed by\s+OpenAI/iu.test(conteudo)) {
    throw new Error("The published README must include the independent-product disclaimer.");
  }
  if (/\bsema\s+preflight\b/i.test(conteudo)) {
    throw new Error("The published README still exposes the removed authorization command.");
  }
  const padroesPrivados = [
    String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----`,
    String.raw`\bDATABASE_URL\b|\bDB_PASSWORD\b`,
    String.raw`\b(?:api[_-]?key|secret|token|password|senha|credential)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}`,
    String.raw`\b(?:AUTH_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|PRIVATE_KEY)\b\s*[:=]\s*["'][A-Za-z0-9_./+=-]{16,}["']`,
  ].join("|");
  if (new RegExp(padroesPrivados, "i").test(conteudo)) {
    throw new Error("The published README still mentions private operational material or credentials.");
  }
  if (/[\u00c3\u00c2\uFFFD]/u.test(conteudo)) {
    throw new Error("The published README contains broken encoding markers.");
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

async function listarArquivosRecursivos(pasta) {
  const saida = [];
  for (const entrada of await readdir(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...await listarArquivosRecursivos(caminho));
    } else if (entrada.isFile()) {
      saida.push(caminho);
    }
  }
  return saida;
}

async function validarHandshakeCodexMaterializado(projetoCodex, agents, packCodex) {
  const referencias = [...new Set([
    ...(packCodex.ordemLeitura ?? []),
    ...Object.values(packCodex.guiaPorCapacidade ?? {}).flat(),
  ])];
  const ordemAgents = agents.match(/^Ordem de leitura: (.+)\.$/mu)?.[1]
    ?.split(" -> ")
    .map((item) => item.trim()) ?? [];
  referencias.push(...ordemAgents);

  for (const referencia of new Set(referencias)) {
    if (typeof referencia !== "string" || !(await existe(path.join(projetoCodex, referencia)))) {
      throw new Error(`The Codex handshake references missing bootstrap artifact ${String(referencia)}.`);
    }
  }

  for (const referencia of [
    "AGENTS.md",
    "SEMA_BOOT.md",
    "SEMA_SMALL_MODEL.md",
    "AGENT_CONTEXT_PACK.json",
    "SEMA_INDEX.json",
    "docs/commands.md",
    "docs/ai-workflow.md",
  ]) {
    const conteudo = await readFile(path.join(projetoCodex, referencia), "utf8");
    if (MARCADOR_NOME_TOOL_MCP_LEGADO.test(conteudo)) {
      throw new Error(`The generated Codex handshake still teaches a legacy MCP tool name in ${referencia}.`);
    }
    if (MARCADOR_MOJIBAKE_VISIVEL.test(conteudo)) {
      throw new Error(`The generated Codex handshake contains mojibake in ${referencia}.`);
    }
  }
}

async function validarGeradoresInstalados(semaBin, basePacote, sandbox) {
  const contrato = path.join(basePacote, "exemplos", "calculadora.sema");
  const alvos = [
    { alvo: "typescript", argumento: "typescript" },
    { alvo: "php", argumento: "php" },
    { alvo: "dotnet", argumento: "cs" },
    { alvo: "cpp", argumento: "c++" },
  ];
  for (const { alvo, argumento } of alvos) {
    const saida = path.join(sandbox, `gerado-${alvo}`);
    executarComSaida(
      process.execPath,
      [semaBin, "compilar", contrato, "--alvo", argumento, "--saida", saida, "--estrutura", "modulos"],
      sandbox,
    );
    const arquivos = await listarArquivosRecursivos(saida);
    const extensao = alvo === "php" ? ".php" : alvo === "dotnet" ? ".cs" : alvo === "cpp" ? ".cpp" : ".ts";
    const gerados = arquivos.filter((arquivo) => arquivo.endsWith(extensao));
    if (gerados.length === 0) {
      throw new Error(`The installed CLI did not generate any ${extensao} file for ${alvo}.`);
    }
    const governado = await Promise.all(gerados.map((arquivo) => readFile(arquivo, "utf8")));
    if (!governado.some((conteudo) => conteudo.includes("SEMA-GOVERNED"))) {
      throw new Error(`The installed ${alvo} generator omitted the SEMA-GOVERNED marker.`);
    }

    if (alvo === "php") {
      const testePhp = gerados.find((arquivo) => /^test_.*\.php$/i.test(path.basename(arquivo)));
      if (!testePhp) {
        throw new Error("The installed PHP generator did not emit its executable test artifact.");
      }
      executarComSaida("php", [testePhp], path.dirname(testePhp));
    }

    if (alvo === "dotnet" || alvo === "cpp") {
      const saidaTeste = path.join(sandbox, `testado-${alvo}`);
      executarComSaida(
        process.execPath,
        [semaBin, "testar", contrato, "--alvo", argumento, "--saida", saidaTeste, "--estrutura", "modulos"],
        sandbox,
      );
    }
  }
}

async function main() {
  const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
  const versaoEsperada = manifestCli.version;
  const tarball = await localizarTarball(versaoEsperada);
  if (!tarball) {
    throw new Error(`The exact npm package semacode-cli-${versaoEsperada}.tgz is missing. Run \`npm run cli:empacotar-publica\` first.`);
  }

  const caminhoTarball = path.join(pastaPacotes, tarball);
  await validarManifestSemDependenciasFile(caminhoTarball, versaoEsperada);
  validarRuntimeLocalDireto(caminhoTarball);

  const sandbox = await mkdtemp(path.join(os.tmpdir(), "sema-cli-npm-"));

  try {
    await writeFile(
      path.join(sandbox, "package.json"),
      `${JSON.stringify({
        name: "sema-cli-npm-smoke",
        private: true,
        version: "0.0.0-smoke",
      }, null, 2)}\n`,
      "utf8",
    );

    executar("npm", ["install", caminhoTarball], sandbox);
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

    const ajudaConteudo = executarComSaida(process.execPath, [semaBin, "conteudo", "--help"], sandbox);
    for (const uso of ["sema conteudo validar", "sema conteudo validar-envelope", "sema conteudo registrar", "sema conteudo projetar"]) {
      if (!ajudaConteudo.includes(uso)) {
        throw new Error(`The installed content pipeline help is missing ${uso}.`);
      }
    }
    if (!ajudaConteudo.includes("Não existe revisão humana nativa") || !ajudaConteudo.includes("nextActions")) {
      throw new Error("The installed content pipeline help does not state its AI-native runner boundary.");
    }

    const capabilitiesConteudo = JSON.parse(
      executarComSaida(process.execPath, [semaBin, "conteudo", "capabilities", "--json"], sandbox),
    );
    if (
      capabilitiesConteudo.sucesso !== true ||
      capabilitiesConteudo.nativeHumanReview !== false ||
      capabilitiesConteudo.runner !== "external" ||
      capabilitiesConteudo.canonicalState !== "signed_hash_chained_ledger"
    ) {
      throw new Error("The installed content pipeline capabilities do not preserve the contracted AI-native boundary.");
    }

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

    const preflightRemovido = spawnSync(process.execPath, [semaBin, "preflight", "resumo", "--json"], {
      cwd: sandbox,
      encoding: "utf8",
    });
    if (preflightRemovido.status === 0) {
      throw new Error("The installed public CLI still executes the removed preflight command.");
    }

    const projetoCodex = path.join(sandbox, "projeto-codex");
    await mkdir(projetoCodex, { recursive: true });
    const readmeOriginal = "# README original do projeto\n\nNao sobrescrever.\n";
    await writeFile(path.join(projetoCodex, "README.md"), readmeOriginal, "utf8");
    executarComSaida(process.execPath, [semaBin, "iniciar", "--template", "base"], projetoCodex);
    if (await readFile(path.join(projetoCodex, "README.md"), "utf8") !== readmeOriginal) {
      throw new Error("The installed CLI overwrote an existing README during Codex bootstrap.");
    }
    for (const arquivoExemplo of EXEMPLOS_INTERATIVOS_PUBLICOS) {
      if (!(await existe(path.join(projetoCodex, arquivoExemplo)))) {
        throw new Error(`The installed CLI did not materialize nested official example ${arquivoExemplo}.`);
      }
    }
    await mkdir(path.join(projetoCodex, ".github"), { recursive: true });
    await writeFile(
      path.join(projetoCodex, ".github", "copilot-instructions.md"),
      "<!-- sema:agent-entrypoint:start -->\nsema preflight resumo --json\n<!-- sema:agent-entrypoint:end -->\n",
      "utf8",
    );
    const syncCodex = JSON.parse(executarComSaida(process.execPath, [semaBin, "sync-codex", "--json"], projetoCodex));
    if (syncCodex.comando !== "sync-codex" || !syncCodex.sucesso || !syncCodex.resultadosCodex?.entrypointsLegadosLimpos) {
      throw new Error("The installed public CLI did not complete the Codex-native synchronization flow.");
    }
    const agents = await readFile(path.join(projetoCodex, "AGENTS.md"), "utf8");
    if (!agents.includes("Sema para Codex") || /\bsema\s+preflight\b|\buse_cli_local\b/i.test(agents)) {
      throw new Error("The installed public CLI generated an invalid Codex AGENTS.md handshake.");
    }
    if (await existe(path.join(projetoCodex, ".github", "copilot-instructions.md"))) {
      throw new Error("The installed public CLI did not remove the managed legacy Copilot entrypoint.");
    }

    const legadoMalformado = [
      "MANUAL-BEFORE",
      "<!-- sema:agent-entrypoint:start -->",
      "ORPHAN-CONTENT-MUST-SURVIVE",
      "<!-- sema:agent-entrypoint:start -->",
      "OLD",
      "<!-- sema:agent-entrypoint:end -->",
      "MANUAL-AFTER",
      "",
    ].join("\n");
    await mkdir(path.join(projetoCodex, ".github"), { recursive: true });
    const legadoMalformadoPath = path.join(projetoCodex, ".github", "copilot-instructions.md");
    await writeFile(legadoMalformadoPath, legadoMalformado, "utf8");
    const syncMalformado = spawnSync(process.execPath, [semaBin, "sync-codex", "--json"], {
      cwd: projetoCodex,
      encoding: "utf8",
    });
    if (syncMalformado.status === 0 || await readFile(legadoMalformadoPath, "utf8") !== legadoMalformado) {
      throw new Error("The installed CLI did not fail closed while preserving a malformed managed block.");
    }

    const projetoJunction = path.join(sandbox, "projeto-junction");
    const foraJunction = path.join(sandbox, "fora-junction");
    await mkdir(projetoJunction, { recursive: true });
    await mkdir(foraJunction, { recursive: true });
    await symlink(foraJunction, path.join(projetoJunction, "contratos"), process.platform === "win32" ? "junction" : "dir");
    const iniciarJunction = spawnSync(process.execPath, [semaBin, "iniciar", "--template", "base"], {
      cwd: projetoJunction,
      encoding: "utf8",
    });
    if (iniciarJunction.status === 0 || await existe(path.join(foraJunction, "pedidos.sema"))) {
      throw new Error("The installed CLI followed a junction outside the bootstrap workspace.");
    }
    const packCodex = JSON.parse(await readFile(path.join(projetoCodex, "AGENT_CONTEXT_PACK.json"), "utf8"));
    if (packCodex.versao !== 7 || packCodex.descoberta?.schemaVersion !== "sema.discovery/v1" || packCodex.entrypointCodex !== "AGENTS.md" || !packCodex.codexNativo || !packCodex.cliLocalSemAutorizacao) {
      throw new Error("The installed public CLI generated an outdated Agent Context Pack schema.");
    }
    await validarHandshakeCodexMaterializado(projetoCodex, agents, packCodex);
    const workflowCodex = await readFile(path.join(projetoCodex, "docs", "ai-workflow.md"), "utf8");
    if (!workflowCodex.startsWith("<!-- sema:agent-entrypoint:start -->\n# Practical Codex + Sema Workflow") || /\b(?:Leia|Rode)\b/u.test(workflowCodex)) {
      throw new Error("The installed public CLI regenerated generic or mixed-language Codex workflow docs.");
    }

    const resumoSaida = executarComSaida(
      process.execPath,
      [semaBin, "resumo", path.join(raiz, "exemplos", "calculadora.sema"), "--micro", "--json"],
      sandbox,
    );
    const resumo = JSON.parse(resumoSaida);
    if (resumo.comando !== "resumo" || resumo.modulo !== "exemplos.calculadora") {
      throw new Error("The installed public CLI did not execute resumo directly against a local contract.");
    }

    executar(process.execPath, [semaBin, "validar", path.join(raiz, "exemplos", "calculadora.sema"), "--json"], sandbox);
    validarReadmePublico(await readFile(path.join(basePacote, "README.md"), "utf8"));
    await validarGeradoresInstalados(semaBin, basePacote, sandbox);

    for (const arquivoDoc of [
      "docs/cli.md",
      "docs/commands.md",
      "docs/descoberta-capacidades.md",
      "docs/documentation.md",
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

    const schemaInterativo = executarJsonCliInstalada(semaBin, ["interativo", "schema"], sandbox);
    validarFronteiraInterativa(schemaInterativo, "interativo schema");
    if (
      schemaInterativo.readOnly !== true ||
      schemaInterativo.schemaVersion !== "sema.interativo.schema/v1" ||
      schemaInterativo.definitionSchema?.schemaVersion !== "1.0" ||
      !schemaInterativo.definitionSchema?.requiredFields?.includes("spatialModel") ||
      !schemaInterativo.definitionSchema?.requiredFields?.includes("renderMode") ||
      !schemaInterativo.definitionSchema?.fields?.spatialModel ||
      !schemaInterativo.definitionSchema?.fields?.renderMode ||
      !schemaInterativo.matrix?.spatialModels?.includes("THREE_D") ||
      !schemaInterativo.matrix?.renderModes?.includes("VISUAL") ||
      !schemaInterativo.examplePaths?.includes("exemplos/sistemas-interativos/simulation-3d-calibrated-autonomous.json") ||
      schemaInterativo.interactiveExtensions?.schemaVersion !== "sema.interactive.cli-extensions/v1" ||
      Object.keys(schemaInterativo.interactiveExtensions?.commands ?? {}).length !== 20 ||
      Object.keys(schemaInterativo.interactiveExtensions?.dataSchemaShapes ?? {}).length !== Object.keys(schemaInterativo.interactiveExtensions?.dataSchemas ?? {}).length ||
      !Object.values(schemaInterativo.interactiveExtensions?.commands ?? {}).every((command) => (
        Array.isArray(command.inputSchemaKeys) &&
        Array.isArray(command.outputSchemaKeys) &&
        command.outputTargets && typeof command.outputTargets === "object" &&
        command.outputSchemaKeys.every((key) => Array.isArray(command.outputTargets[key]) && command.outputTargets[key][0] === "resultado") &&
        Array.isArray(command.officialFixturePaths)
      )) ||
      !Object.values(schemaInterativo.interactiveExtensions?.dataSchemaShapes ?? {}).every((shape) => (
        shape.type === "object" &&
        typeof shape.schemaVersion === "string" &&
        Array.isArray(shape.requiredTopLevelFields) &&
        shape.requiredTopLevelFields.length > 0
      )) ||
      schemaInterativo.interactiveExtensions?.dataSchemas?.experienceIr !== "sema.experience-ir/v1" ||
      schemaInterativo.interactiveExtensions?.dataSchemas?.multiplayerAuthority !== "sema.interactive.multiplayer-authority/v1" ||
      schemaInterativo.interactiveExtensions?.dataSchemas?.distributedWorkers !== "sema.interactive.distributed-jobs/v1"
    ) {
      throw new Error("The installed public CLI exposed an incomplete interactive definition schema.");
    }

    const capabilitiesInterativas = executarJsonCliInstalada(
      semaBin,
      ["interativo", "capabilities"],
      sandbox,
    );
    validarFronteiraInterativa(capabilitiesInterativas, "interativo capabilities");
    if (
      !capabilitiesInterativas.capabilities?.length ||
      !capabilitiesInterativas.pipelineIds?.includes("simulation.calibrate") ||
      !capabilitiesInterativas.pipelineIds?.includes("interactive.portability") ||
      capabilitiesInterativas.extensionCommands?.length !== 20 ||
      !capabilitiesInterativas.extensionCommands?.includes("validar-ir") ||
      !capabilitiesInterativas.extensionCommands?.includes("validar-workers")
    ) {
      throw new Error("The installed public CLI exposed an incomplete interactive capability catalog.");
    }

    const pipelinesInterativas = executarJsonCliInstalada(
      semaBin,
      ["interativo", "pipelines"],
      sandbox,
    );
    validarFronteiraInterativa(pipelinesInterativas, "interativo pipelines");
    if (
      !pipelinesInterativas.pipelines?.some((item) => item.pipelineId === "simulation.safety") ||
      !pipelinesInterativas.pipelines?.some((item) => item.pipelineId === "interactive.experience_ir") ||
      !pipelinesInterativas.pipelines?.some((item) => item.pipelineId === "interactive.distributed_jobs") ||
      !pipelinesInterativas.pipelines?.every((item) => (
        Array.isArray(item.spatialModels) &&
        Array.isArray(item.renderModes) &&
        !("representations" in item)
      ))
    ) {
      throw new Error("The installed public CLI exposed an outdated interactive pipeline catalog.");
    }

    const adaptersInterativos = executarJsonCliInstalada(
      semaBin,
      [
        "interativo",
        "adapters",
        "--spatial-model",
        "THREE_D",
        "--render-mode",
        "VISUAL",
        "--role",
        "ENGINE",
      ],
      sandbox,
    );
    validarFronteiraInterativa(adaptersInterativos, "interativo adapters");
    if (
      !adaptersInterativos.adapters?.length ||
      !adaptersInterativos.adapters?.every((item) => (
        item.role === "ENGINE" &&
        item.spatialModels?.includes("THREE_D") &&
        item.renderModes?.includes("VISUAL") &&
        !("representations" in item)
      ))
    ) {
      throw new Error("The installed public CLI did not apply the spatial/render adapter filters.");
    }

    const definicaoInterativa = path.join(
      projetoCodex,
      "exemplos",
      "sistemas-interativos",
      "simulation-3d-calibrated-autonomous.json",
    );
    const protocoloInterativo = path.join(
      projetoCodex,
      "exemplos",
      "sistemas-interativos",
      "protocol-read-only-valid.json",
    );
    const experienceIrInterativa = path.join(
      projetoCodex,
      "exemplos",
      "sistemas-interativos",
      "experience-ir-valid.json",
    );
    const validacaoInterativa = executarJsonCliInstalada(
      semaBin,
      ["interativo", "validar", definicaoInterativa],
      sandbox,
    );
    validarFronteiraInterativa(validacaoInterativa, "interativo validar");
    if (validacaoInterativa.valida !== true || validacaoInterativa.bloqueios?.length !== 0) {
      throw new Error("The installed public CLI rejected its official calibrated 3D simulation example.");
    }

    const planoInterativo = executarJsonCliInstalada(
      semaBin,
      ["interativo", "planejar", definicaoInterativa],
      sandbox,
    );
    validarFronteiraInterativa(planoInterativo, "interativo planejar");
    if (
      planoInterativo.bloqueios?.length !== 0 ||
      planoInterativo.plano?.executed !== false ||
      !Array.isArray(planoInterativo.plano?.adaptersSelecionados) ||
      planoInterativo.plano?.adapterSelectionExplicit !== true ||
      planoInterativo.plano?.adapterCoverageComplete !== true ||
      planoInterativo.plano?.capabilitiesSemAdapter?.length !== 0 ||
      !planoInterativo.plano?.stageProviderMap?.length ||
      !planoInterativo.plano.stageProviderMap.every((item) => item.coveredBySelection === true)
    ) {
      throw new Error("The installed public CLI emitted an incomplete declarative interactive plan.");
    }

    const protocoloValidado = executarJsonCliInstalada(
      semaBin,
      ["interativo", "validar-protocolo", protocoloInterativo],
      sandbox,
    );
    validarFronteiraInterativa(protocoloValidado, "interativo validar-protocolo");
    if (
      protocoloValidado.valido !== true ||
      protocoloValidado.faseAtual !== "EVIDENCE" ||
      protocoloValidado.exigeRollback !== false ||
      protocoloValidado.bloqueios?.length !== 0
    ) {
      throw new Error("The installed public CLI rejected its official read-only adapter protocol.");
    }

    const irValidada = executarJsonCliInstalada(
      semaBin,
      ["interativo", "validar-ir", experienceIrInterativa],
      sandbox,
    );
    validarFronteiraInterativa(irValidada, "interativo validar-ir");
    if (irValidada.resultado?.valido !== true || !irValidada.resultado?.documentDigest) {
      throw new Error("The installed public CLI rejected its official Experience IR document.");
    }

    const irConsultada = executarJsonCliInstalada(
      semaBin,
      ["interativo", "consultar-ir", experienceIrInterativa, "--semantic-id", "scene.main"],
      sandbox,
    );
    validarFronteiraInterativa(irConsultada, "interativo consultar-ir");
    if (irConsultada.resultado?.encontrado !== true || irConsultada.resultado?.entry?.semanticId !== "scene.main") {
      throw new Error("The installed public CLI could not query its Experience IR semantic index.");
    }

    const serializacaoIr = executarJsonCliInstalada(semaBin, ["interativo", "descrever-ir"], sandbox);
    validarFronteiraInterativa(serializacaoIr, "interativo descrever-ir");
    if (
      serializacaoIr.resultado?.descriptor?.json?.native !== true ||
      serializacaoIr.resultado?.descriptor?.cbor?.support !== "EXTERNAL" ||
      serializacaoIr.resultado?.descriptor?.cbor?.installed !== false
    ) {
      throw new Error("The installed public CLI misrepresented Experience IR serialization support.");
    }

    const fixtureAvancada = (nome) => path.join(
      projetoCodex,
      "exemplos",
      "sistemas-interativos",
      "advanced",
      nome,
    );
    const snapshotAntes = fixtureAvancada("engine-snapshot-before-valid.json");
    const snapshotDepois = fixtureAvancada("engine-snapshot-after-valid.json");
    const acceptanceLock = fixtureAvancada("acceptance-lock-valid.json");
    const temporal = fixtureAvancada("temporal-valid.json");
    const comandosAvancadosInstalados = [
      ["validar-ir", experienceIrInterativa],
      ["indexar-ir", experienceIrInterativa],
      ["consultar-ir", experienceIrInterativa, "--semantic-id", "scene.main"],
      ["chunk-ir", experienceIrInterativa, "--semantic-id", "entity.player"],
      ["descrever-ir"],
      ["validar-engine-snapshot", snapshotAntes],
      ["diff-engine-snapshots", snapshotAntes, snapshotDepois],
      ["validar-asset-provenance", fixtureAvancada("asset-provenance-valid.json")],
      ["validar-editor-state", fixtureAvancada("editor-state-valid.json")],
      ["planejar-jobs", fixtureAvancada("job-orchestration-valid.json")],
      ["validar-acceptance", acceptanceLock],
      ["operar-acceptance", acceptanceLock, "--operation", "EVALUATE", "--context-file", fixtureAvancada("acceptance-context-evaluate-valid.json")],
      ["validar-multimodal", fixtureAvancada("multimodal-evidence-valid.json")],
      ["validar-temporal", temporal],
      ["validar-evidencia-temporal", temporal, "--bundle-arquivo", fixtureAvancada("temporal-evidence-valid.json")],
      ["validar-autonomia", fixtureAvancada("autonomy-repair-valid.json")],
      ["validar-playtest-fuzz", fixtureAvancada("playtest-fuzz-valid.json")],
      ["validar-multiplayer", fixtureAvancada("multiplayer-authority-valid.json")],
      ["analisar-portabilidade", fixtureAvancada("portability-valid.json")],
      ["validar-workers", fixtureAvancada("distributed-workers-valid.json")],
    ];
    if (comandosAvancadosInstalados.length !== 20 || new Set(comandosAvancadosInstalados.map(([command]) => command)).size !== 20) {
      throw new Error("The installed-package advanced smoke matrix does not cover exactly 20 unique commands.");
    }
    for (const argumentos of comandosAvancadosInstalados) {
      const payload = executarJsonCliInstalada(semaBin, ["interativo", ...argumentos], sandbox);
      validarFronteiraInterativa(payload, `interativo ${argumentos[0]}`);
      if (!payload.resultado || typeof payload.resultado !== "object") {
        throw new Error(`The installed advanced command ${argumentos[0]} did not return a structured result.`);
      }
    }

    const controlDefinition = fixtureAvancada("control-run-definition-valid.json");
    const controlManifest = fixtureAvancada("control-run-valid.json");
    const temporalEvidence = fixtureAvancada("temporal-evidence-valid.json");
    const controlPlan = executarJsonCliInstalada(semaBin, ["interativo", "planejar", controlDefinition], sandbox);
    const temporalResult = executarJsonCliInstalada(semaBin, ["interativo", "validar-evidencia-temporal", temporal, "--bundle-arquivo", temporalEvidence], sandbox);
    const controlPlanFile = path.join(sandbox, "control-run-plan.json");
    const controlResultFile = path.join(sandbox, "control-run-result.json");
    await Promise.all([
      writeFile(controlPlanFile, JSON.stringify(controlPlan.plano), "utf8"),
      writeFile(controlResultFile, JSON.stringify(temporalResult), "utf8"),
    ]);
    const controlRun = executarJsonCliInstalada(semaBin, [
      "interativo", "validar-control-run", controlManifest,
      "--definition-arquivo", controlDefinition, "--plano-arquivo", controlPlanFile,
      "--contrato-arquivo", temporal, "--entrada-arquivo", temporal,
      "--entrada-auxiliar-arquivo", temporalEvidence, "--evidencia-arquivo", temporalEvidence,
      "--resultado-arquivo", controlResultFile,
    ], sandbox);
    validarFronteiraInterativa(controlRun, "interativo validar-control-run");
    const controlBindings = controlRun.resultado?.bindings;
    if (controlRun.resultado?.valid !== true
      || !Array.isArray(controlBindings)
      || controlBindings.length !== 8
      || !controlBindings.every((binding) => binding.matched === true)) {
      throw new Error("The installed public CLI could not validate its fully bound control run.");
    }

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

main().catch((erro) => {
  console.error("Failed to validate the public local-only Sema CLI package.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
