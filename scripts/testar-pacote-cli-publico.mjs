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
const ARQUIVO_RUNTIME_VISIVEL = /^package\/dist\/(?:agentContext|agentContextPack|agentContextTipos|agentEntryPoints|doctorCommand|docs\.part01|exemplosOficiais|fsGovernado|index\.part0[1-8]|initCommand|initTemplatesBase|workspaceWrite)\.(?:js|d\.ts|json)$/i;

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
  for (const alvo of ["typescript", "php"]) {
    const saida = path.join(sandbox, `gerado-${alvo}`);
    executarComSaida(
      process.execPath,
      [semaBin, "compilar", contrato, "--alvo", alvo, "--saida", saida, "--estrutura", "modulos"],
      sandbox,
    );
    const arquivos = await listarArquivosRecursivos(saida);
    const extensao = alvo === "php" ? ".php" : ".ts";
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
    const ajuda = executarComSaida(process.execPath, [semaBin, "--help"], sandbox);
    if (/\bpreflight\b/i.test(ajuda)) {
      throw new Error("The installed public CLI help still exposes the removed preflight command.");
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
    if (packCodex.versao !== 6 || packCodex.entrypointCodex !== "AGENTS.md" || !packCodex.codexNativo || !packCodex.cliLocalSemAutorizacao) {
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
      "docs/documentation.md",
      "docs/security.md",
      "docs/support.md",
    ]) {
      if (!(await existe(path.join(basePacote, arquivoDoc)))) {
        throw new Error(`The public package did not include ${arquivoDoc}.`);
      }
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
    await rm(sandbox, { recursive: true, force: true });
  }
}

main().catch((erro) => {
  console.error("Failed to validate the public local-only Sema CLI package.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
