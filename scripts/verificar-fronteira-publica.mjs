// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: valida a CLI local, o AGENTS.md e a skill oficial de bootstrap do Codex.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = process.cwd();
const emailSuporte = "suporte@otimitare.online";
const extensoesTexto = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".sema",
  ".sh",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);

const ignorarDiretorios = new Set([
  ".git",
  ".tmp",
  "dist",
  "node_modules",
]);

const arquivosObrigatorios = [
  "AGENTS.md",
  "LICENSE",
  "README.md",
  "pacotes/cli/package.json",
  "pacotes/cli/README.md",
  "scripts/empacotar-cli-publica.mjs",
  "scripts/testar-pacote-cli-publico.mjs",
  ".agents/plugins/marketplace.json",
  "plugins/sema/.codex-plugin/plugin.json",
  "logo.png",
  "plugins/sema/assets/sema.png",
  "plugins/sema/skills/sema/SKILL.md",
  "plugins/sema/skills/sema/agents/openai.yaml",
];

const entrypointsNaoCodex = [
  ".claude/CLAUDE.md",
  ".clinerules",
  ".clinerules/00-sema.md",
  ".cursor/rules/sema.mdc",
  ".github/copilot-instructions.md",
  ".opencode/instructions.md",
  ".roo/rules/00-sema.md",
  ".windsurf/rules.md",
];

const artefatosRuntimeProibidos = [
  "pacotes/cli/src/billing",
  "pacotes/cli/dist/billing",
];

const arquivosSuperficieLocalDireta = [
  "AGENTS.md",
  "README.md",
  "SEMA_BOOT.md",
  "SEMA_SMALL_MODEL.md",
  "CONTRIBUTING.md",
  "docs/README.md",
  "docs/ai-integration.md",
  "docs/ai-onboarding.md",
  "docs/ai-workflow.md",
  "docs/auth.md",
  "docs/cli.md",
  "docs/commands.md",
  "docs/descoberta-capacidades.md",
  "docs/deploy.md",
  "docs/getting-started.md",
  "docs/testing.md",
  "docs/sistemas-interativos.md",
  "pacotes/cli/README.md",
  "pacotes/cli/src/agentContext.ts",
  "pacotes/cli/src/agentContextPack.ts",
  "pacotes/cli/src/agentContextTipos.ts",
  "pacotes/cli/src/agentEntryPoints.ts",
  "pacotes/cli/src/doctorCommand.ts",
  "pacotes/cli/src/exemplosOficiais.ts",
  "pacotes/cli/src/fsGovernado.ts",
  "pacotes/cli/src/index.part01.ts",
  "pacotes/cli/src/index.part02.ts",
  "pacotes/cli/src/index.part03.ts",
  "pacotes/cli/src/index.part04.ts",
  "pacotes/cli/src/index.part05.ts",
  "pacotes/cli/src/index.part06.ts",
  "pacotes/cli/src/index.part07.ts",
  "pacotes/cli/src/index.part08.ts",
  "pacotes/cli/src/initCommand.ts",
  "pacotes/cli/src/initTemplatesBase.ts",
  "pacotes/cli/src/workspaceWrite.ts",
];

const arquivosDocsCodexEmIngles = [
  "docs/ai-integration.md",
  "docs/ai-workflow.md",
  "docs/commands.md",
  "docs/descoberta-capacidades.md",
  "docs/sistemas-interativos.md",
  "docs/syntax.md",
];

const prosaPortuguesaEmDocPublica = /\b(?:Leia|Rode|Antes de|Depois de|documentação obrigatória|código existente|mudança)\b/u;

const comandosGovernancaDuplicadosNaSkill = [
  "docs-impacto",
  "inspecionar",
  "drift",
  "impacto",
  "validar",
  "finalizar-mudanca",
];

const padroesPorteiroLegado = [
  { regex: /\bpreflight\b/i, motivo: "terminologia preflight legada" },
  { regex: /\bsema\s+preflight\b/i, motivo: "comando de autorizacao legado" },
  { regex: /\b(?:comando|executar)PreflightCli\b/, motivo: "handler de autorizacao legado" },
  { regex: /\buse_cli_local\b/, motivo: "decisao de autorizacao legada" },
  { regex: /\borigemCobranca\b/, motivo: "marcador de billing legado" },
  { regex: /\boperationCode\b/, motivo: "codigo de operacao do porteiro legado" },
];

const padraoNomeToolMcpLegado = /\bsema_(?:docs_impacto|finalizar_mudanca|inspecionar|drift|impacto|exemplos)\b/i;
const padraoMojibakeVisivel = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|âš|ï¸/u;

const arquivosIgnoradosConteudo = new Set([
  "scripts/verificar-fronteira-publica.mjs",
]);

const nomesBloqueados = [
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /(^|[/\\])\.env(?:\.|$)/i,
  /(^|[/\\])(?:backup|backups|snapshot|snapshots|dump|dumps)(?:[/\\]|$)/i,
  /\.(?:7z|rar|zip)$/i,
];

const padroesConteudoBloqueados = [
  { regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, motivo: "chave privada PEM" },
  { regex: /\b(?:api[_-]?key|secret|token|password|senha|credential)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i, motivo: "segredo aparente" },
  { regex: /\b(?:AUTH_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|PRIVATE_KEY)\b\s*[:=]\s*["'][A-Za-z0-9_./+=-]{16,}["']/i, motivo: "segredo aparente" },
  { regex: /\bDB_PASSWORD\b|\bDATABASE_URL\b/i, motivo: "credencial de banco" },
  { regex: /\b(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:\d{1,3})){3}\b/, motivo: "IP publico fixo" },
];

function paraRelativo(caminho) {
  return path.relative(raiz, caminho).replaceAll(path.sep, "/");
}

async function existe(caminhoRelativo) {
  try {
    await stat(path.join(raiz, caminhoRelativo));
    return true;
  } catch {
    return false;
  }
}

async function listarArquivos(dir = raiz) {
  const entradas = await readdir(dir, { withFileTypes: true });
  const arquivos = [];

  for (const entrada of entradas) {
    const caminho = path.join(dir, entrada.name);
    const relativo = paraRelativo(caminho);
    if (entrada.isDirectory()) {
      if (ignorarDiretorios.has(entrada.name)) {
        continue;
      }
      arquivos.push(...(await listarArquivos(caminho)));
      continue;
    }
    if (entrada.isFile() && extensoesTexto.has(path.extname(entrada.name).toLowerCase())) {
      arquivos.push(relativo);
    }
  }

  return arquivos;
}

function registrar(lista, caminho, motivo) {
  lista.push({ caminho, motivo });
}

function removerDetectorMigracaoLegada(arquivo, conteudo) {
  if (arquivo !== "pacotes/cli/src/agentEntryPoints.ts") {
    return conteudo;
  }
  return conteudo.replace(
    /function contemVestigioSemaLegado\([^)]*\): boolean \{[\s\S]*?\n\}/u,
    "",
  );
}

function removerFixturesDoScannerDeSegredos(arquivo, conteudo) {
  if (arquivo !== "scripts/testar-pacote-cli-publico.mjs") {
    return conteudo;
  }
  return conteudo
    .replace(/const MARCADORES_CONTEUDO_PRIVADO = \[[\s\S]*?\n\];/u, "")
    .replace(/  const padroesPrivados = \[[\s\S]*?\n  \]\.join\("\|"\);/u, "");
}

async function verificarArtefatosBootstrapAtuais(bloqueios) {
  try {
    const pack = JSON.parse(await readFile(path.join(raiz, "AGENT_CONTEXT_PACK.json"), "utf8"));
    const referencias = [...new Set([
      ...(pack.ordemLeitura ?? []),
      ...Object.values(pack.guiaPorCapacidade ?? {}).flat(),
    ])];
    let todosExistem = true;
    for (const referencia of referencias) {
      if (typeof referencia !== "string" || !(await existe(referencia))) {
        todosExistem = false;
        registrar(bloqueios, String(referencia), "artefato citado pelo handshake Codex nao existe no workspace sincronizado");
      }
    }
    return todosExistem;
  } catch {
    registrar(bloqueios, "AGENT_CONTEXT_PACK.json", "Agent Context Pack ausente ou invalido para validar o handshake Codex");
    return false;
  }
}

async function verificarFronteiraPublica({ json = false } = {}) {
  const bloqueios = [];
  const avisos = [];

  for (const caminho of arquivosObrigatorios) {
    if (!(await existe(caminho))) {
      registrar(bloqueios, caminho, "arquivo publico obrigatorio ausente");
    }
  }

  for (const caminho of entrypointsNaoCodex) {
    if (await existe(caminho)) {
      registrar(bloqueios, caminho, "entrypoint de cliente nao Codex nao pertence a superficie oficial");
    }
  }

  for (const caminho of artefatosRuntimeProibidos) {
    if (await existe(caminho)) {
      registrar(bloqueios, caminho, "artefato removido de billing/autorizacao local ainda presente");
    }
  }

  let cliSemAutorizacaoLocal = true;
  let protocoloSemNomesMcp = true;
  let textoPublicoSemMojibake = true;
  for (const arquivo of arquivosSuperficieLocalDireta) {
    if (!(await existe(arquivo))) {
      continue;
    }
    const conteudoOriginal = await readFile(path.join(raiz, arquivo), "utf8");
    const conteudo = removerDetectorMigracaoLegada(arquivo, conteudoOriginal);
    const marcador = padroesPorteiroLegado.find(({ regex }) => regex.test(conteudo));
    if (marcador) {
      cliSemAutorizacaoLocal = false;
      registrar(bloqueios, arquivo, marcador.motivo);
    }
    if (padraoNomeToolMcpLegado.test(conteudo)) {
      protocoloSemNomesMcp = false;
      registrar(bloqueios, arquivo, "protocolo Codex-native ainda ensina nome de tool MCP legado");
    }
    if (padraoMojibakeVisivel.test(conteudo)) {
      textoPublicoSemMojibake = false;
      registrar(bloqueios, arquivo, "texto visivel contem mojibake");
    }
  }

  let docsPublicasEmIngles = true;
  for (const arquivo of arquivosDocsCodexEmIngles) {
    if (!(await existe(arquivo))) {
      docsPublicasEmIngles = false;
      registrar(bloqueios, arquivo, "documentacao publica Codex obrigatoria ausente");
      continue;
    }
    const conteudo = removerFixturesDoScannerDeSegredos(
      arquivo,
      await readFile(path.join(raiz, arquivo), "utf8"),
    );
    if (prosaPortuguesaEmDocPublica.test(conteudo)) {
      docsPublicasEmIngles = false;
      registrar(bloqueios, arquivo, "documentacao publica Codex contem prosa operacional em portugues");
    }
  }

  const arquivos = await listarArquivos();
  for (const arquivo of arquivos) {
    if (nomesBloqueados.some((regex) => regex.test(arquivo))) {
      registrar(bloqueios, arquivo, "arquivo sensivel nao publicavel");
      continue;
    }
    if (arquivosIgnoradosConteudo.has(arquivo)) {
      continue;
    }

    const conteudo = removerFixturesDoScannerDeSegredos(
      arquivo,
      await readFile(path.join(raiz, arquivo), "utf8"),
    );
    for (const padrao of padroesConteudoBloqueados) {
      if (padrao.regex.test(conteudo)) {
        registrar(bloqueios, arquivo, padrao.motivo);
      }
    }
  }

  const license = await readFile(path.join(raiz, "LICENSE"), "utf8").catch(() => "");
  const licencaSemRevendaComercial =
    license.includes("Sell Sema") &&
    license.includes("commercial replica") &&
    license.includes("resale permission");
  if (!licencaSemRevendaComercial || !license.includes(emailSuporte)) {
    registrar(bloqueios, "LICENSE", "licenca publica precisa proibir uso comercial sem permissao e informar suporte oficial");
  }

  const readme = await readFile(path.join(raiz, "README.md"), "utf8").catch(() => "");
  if (!readme.includes(emailSuporte)) {
    registrar(bloqueios, "README.md", "README precisa informar suporte oficial");
  }
  const disclaimerIndependente = readme.includes("not affiliated with or endorsed by") && readme.includes("OpenAI");
  if (!disclaimerIndependente) {
    registrar(bloqueios, "README.md", "README precisa declarar que Sema e independente e nao endossado pela OpenAI");
  }

  const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8").catch(() => "{}"));
  if (manifestCli.license !== "SEE LICENSE IN LICENSE") {
    registrar(bloqueios, "pacotes/cli/package.json", "manifesto da CLI precisa apontar para a licenca do repositorio");
  }
  if (manifestCli.bugs?.email !== emailSuporte) {
    registrar(bloqueios, "pacotes/cli/package.json", "manifesto da CLI precisa usar o email oficial de suporte");
  }
  const produtoCodexNative =
    readme.includes("Codex-native") &&
    readme.includes("AGENTS.md") &&
    String(manifestCli.description ?? "").includes("Codex-native") &&
    (manifestCli.keywords ?? []).includes("codex");
  if (!produtoCodexNative) {
    registrar(bloqueios, "README.md", "superficie publica precisa assumir Codex-native e AGENTS.md como entrypoint oficial");
  }

  const marketplace = JSON.parse(await readFile(path.join(raiz, ".agents", "plugins", "marketplace.json"), "utf8").catch(() => "{}"));
  const manifestPlugin = JSON.parse(await readFile(path.join(raiz, "plugins", "sema", ".codex-plugin", "plugin.json"), "utf8").catch(() => "{}"));
  const skillSema = await readFile(path.join(raiz, "plugins", "sema", "skills", "sema", "SKILL.md"), "utf8").catch(() => "");
  const openaiYaml = await readFile(path.join(raiz, "plugins", "sema", "skills", "sema", "agents", "openai.yaml"), "utf8").catch(() => "");
  const logoOficial = await readFile(path.join(raiz, "logo.png")).catch(() => Buffer.alloc(0));
  const logoPlugin = await readFile(path.join(raiz, "plugins", "sema", "assets", "sema.png")).catch(() => Buffer.alloc(0));
  const entradaMarketplace = (marketplace.plugins ?? []).find((item) => item?.name === "sema");
  const pluginMarcaOficial =
    logoOficial.length > 0 &&
    logoOficial.equals(logoPlugin) &&
    manifestPlugin.interface?.composerIcon === "./assets/sema.png" &&
    manifestPlugin.interface?.logo === "./assets/sema.png";
  const skillBootstrapCodexOficial =
    marketplace.name === "sema" &&
    entradaMarketplace?.source?.source === "local" &&
    entradaMarketplace?.source?.path === "./plugins/sema" &&
    manifestPlugin.name === "sema" &&
    manifestPlugin.version === manifestCli.version &&
    manifestPlugin.skills === "./skills/" &&
    pluginMarcaOficial &&
    String(manifestPlugin.description ?? "").includes("bootstrap") &&
    !/\boptional\b/i.test(JSON.stringify(manifestPlugin)) &&
    skillSema.includes("sema iniciar --template base") &&
    skillSema.includes("sema sync-codex --json") &&
    /^---\r?\nname: sema\r?\ndescription: .+\r?\n---/u.test(skillSema) &&
    /^interface:\r?\n  display_name: "Sema"\r?\n  short_description: ".+"\r?\n  default_prompt: ".*\$sema.*"\r?\n?$/u.test(openaiYaml);
  if (!skillBootstrapCodexOficial) {
    registrar(bloqueios, "plugins/sema", "skill oficial precisa cobrir o bootstrap Codex, compartilhar a versao da CLI e nao se declarar opcional");
  }
  if (!pluginMarcaOficial) {
    registrar(bloqueios, "plugins/sema/assets/sema.png", "plugin precisa usar uma copia byte a byte da logo oficial do Sema");
  }

  const skillDelegaAoAgentsMd =
    skillSema.includes("Read the generated `AGENTS.md`") &&
    skillSema.includes("This skill only bridges the absence of that protocol") &&
    comandosGovernancaDuplicadosNaSkill.every((comando) => !skillSema.includes(`sema ${comando}`));
  if (!skillDelegaAoAgentsMd) {
    registrar(bloqueios, "plugins/sema/skills/sema/SKILL.md", "skill deve encerrar no bootstrap e delegar a governanca ao AGENTS.md sem duplicar comandos");
  }

  const pluginSemMcpAuth =
    !(await existe("plugins/sema/.mcp.json")) &&
    !(await existe("plugins/sema/.app.json")) &&
    manifestPlugin.mcpServers === undefined &&
    manifestPlugin.apps === undefined;
  if (!pluginSemMcpAuth) {
    registrar(bloqueios, "plugins/sema", "plugin de bootstrap nao pode incluir MCP, app ou autenticacao propria");
  }

  const artefatosBootstrapExistentes = await verificarArtefatosBootstrapAtuais(bloqueios);

  const aprovado = bloqueios.length === 0;
  const suporteEmailOficial = manifestCli?.bugs?.email === emailSuporte && readme.includes(emailSuporte) && license.includes(emailSuporte);
  const revendaComercialBloqueada = licencaSemRevendaComercial;
  const decisaoAgente = aprovado ? "continuar" : "parar";
  const resultado = {
    aprovado,
    bloqueado: !aprovado,
    fronteira: "publico_local_only",
    suporte: emailSuporte,
    politica_comercial: "nao_replicar_para_venda_comercial",
    bloqueios,
    avisos,
  };
  const result = {
    comando: "verificar-fronteira-publica",
    sucesso: aprovado,
    resultado,
    ...resultado,
    decisaoAgente,
    decisao_agente: decisaoAgente,
    materiais_privados_ausentes: aprovado,
    artefatos_sensiveis_ausentes: aprovado,
    segredos_ausentes: aprovado,
    docs_publicas_em_ingles: docsPublicasEmIngles,
    suporte_email_oficial: suporteEmailOficial,
    revenda_comercial_bloqueada: revendaComercialBloqueada,
    produto_codex_native: produtoCodexNative,
    entrypoint_codex_oficial: produtoCodexNative && entrypointsNaoCodex.every((caminho) => !bloqueios.some((item) => item.caminho === caminho)),
    cli_sem_autorizacao_local: cliSemAutorizacaoLocal && artefatosRuntimeProibidos.every((caminho) => !bloqueios.some((item) => item.caminho === caminho)),
    skill_bootstrap_codex_oficial: skillBootstrapCodexOficial,
    plugin_marca_oficial: pluginMarcaOficial,
    skill_delega_ao_agents_md: skillDelegaAoAgentsMd,
    plugin_sem_mcp_auth: pluginSemMcpAuth,
    protocolo_sem_nomes_mcp: protocoloSemNomesMcp,
    artefatos_bootstrap_existentes: artefatosBootstrapExistentes,
    texto_publico_sem_mojibake: textoPublicoSemMojibake,
    produto_independente_openai: disclaimerIndependente,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (aprovado) {
    console.log("Fronteira publica Codex-native local-only aprovada.");
  } else {
    console.error("Fronteira publica local-only bloqueada:");
    for (const bloqueio of bloqueios) {
      console.error(`- ${bloqueio.caminho}: ${bloqueio.motivo}`);
    }
  }

  return result;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const json = process.argv.includes("--json");
  const result = await verificarFronteiraPublica({ json });
  process.exit(result.aprovado ? 0 : 1);
}

export { verificarFronteiraPublica };
