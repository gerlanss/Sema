// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: valida manifesto, runtime e documentacao do tarball publico sem publicar a release.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
const ARTEFATO_NAO_PUBLICAVEL = /(?:^|\/)(?:[^/]+\.(?:map|pem|key|p12|pfx)|\.env(?:\.|$)|billing(?:\/|\.|$))/iu;
const ARQUIVO_RUNTIME_VISIVEL = /^package\/dist\/(?:(?:discovery|sistemasInterativos)\/[^/]+|(?:agentContext|agentContextPack|agentContextTipos|agentEntryPoints|doctorCommand|docs\.part01|exemplosOficiais|fsGovernado|index\.part0[1-8]|initCommand|initTemplatesBase|workspaceWrite))\.(?:js|d\.ts|json)$/i;
const PACOTES_RUNTIME_PUBLICOS = [
  "@sema/nucleo", "@sema/padroes", "@sema/gerador-lua", "@sema/gerador-typescript",
  "@sema/gerador-python", "@sema/gerador-dart", "@sema/gerador-javascript",
  "@sema/gerador-html", "@sema/gerador-css", "@sema/gerador-php",
  "@sema/gerador-dotnet", "@sema/gerador-cpp",
];

function removerDetectorMigracaoLegada(arquivo, conteudo) {
  if (!/^package\/dist\/agentEntryPoints\.js$/i.test(arquivo)) {
    return conteudo;
  }
  return conteudo.replace(
    /function contemVestigioSemaLegado\([^)]*\) \{[\s\S]*?\n\}/u,
    "",
  );
}

function listarTarball(caminhoTarball, raiz) {
  return execFileSync("tar", ["-tf", caminhoTarball], {
    cwd: raiz,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).split(/\r?\n/u).filter(Boolean);
}

function lerArquivoTarball(caminhoTarball, arquivo, raiz) {
  return execFileSync("tar", ["-xOf", caminhoTarball, arquivo], {
    cwd: raiz,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function lerArquivoTarballBytes(caminhoTarball, arquivo, raiz) {
  return execFileSync("tar", ["-xOf", caminhoTarball, arquivo], {
    cwd: raiz,
    maxBuffer: 16 * 1024 * 1024,
  });
}

export function validarBytesArtefatoDistribuicao(empacotado, fonte, referencia) {
  if (!Buffer.isBuffer(empacotado) || !Buffer.isBuffer(fonte) || !empacotado.equals(fonte)) {
    throw new Error(`The packaged distribution artifact differs byte-for-byte from source: ${referencia}.`);
  }
}

export async function validarArtefatosDistribuicaoContraFonte(caminhoTarball, raiz) {
  const artefatos = [
    ["package/scripts/postinstall.mjs", "pacotes/cli/scripts/postinstall.mjs"],
    ["package/skills/sema/SKILL.md", "plugins/sema/skills/sema/SKILL.md"],
    ["package/skills/sema/agents/openai.yaml", "plugins/sema/skills/sema/agents/openai.yaml"],
  ];
  for (const [arquivoEmpacotado, arquivoFonte] of artefatos) {
    validarBytesArtefatoDistribuicao(
      lerArquivoTarballBytes(caminhoTarball, arquivoEmpacotado, raiz),
      await readFile(path.join(raiz, arquivoFonte)),
      arquivoEmpacotado,
    );
  }
}

export function validarManifestSemDependenciasFile(caminhoTarball, versaoEsperada, raiz) {
  const json = JSON.parse(lerArquivoTarball(caminhoTarball, "package/package.json", raiz));
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
  if (!["Claude", "Codex", "GLM", "Kimi"].every((agente) => String(json.description ?? "").includes(agente))) {
    throw new Error("The public package manifest must declare proven compatibility with Claude, Codex, zCode (GLM) and Kimi.");
  }
  if (json.bin?.sema !== "dist/bin.js" || json.main !== "dist/index.js" || json.types !== "dist/index.d.ts") {
    throw new Error("The public package must separate the executable bin from the root API entrypoint.");
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

  const arquivos = listarTarball(caminhoTarball, raiz);
  for (const entrada of ["package/dist/bin.js", "package/dist/index.js", "package/dist/index.d.ts"]) {
    if (!arquivos.includes(entrada)) {
      throw new Error(`The public package is missing CLI entrypoint ${entrada}.`);
    }
  }
  const artefatoNaoPublicavel = arquivos.find((arquivo) => ARTEFATO_NAO_PUBLICAVEL.test(arquivo));
  if (artefatoNaoPublicavel) {
    throw new Error(`The public package contains forbidden artifact ${artefatoNaoPublicavel}.`);
  }
  if (JSON.stringify(json.scripts ?? {}) !== JSON.stringify({ postinstall: "node scripts/postinstall.mjs" })) {
    throw new Error("The public package must expose only the postinstall lifecycle.");
  }
  const lifecycleCas = arquivos.find((arquivo) => /package\/scripts\/(?:prepack|postpack|bloquear-pack-workspace)/iu.test(arquivo));
  if (lifecycleCas) throw new Error(`The public package contains workspace lifecycle code: ${lifecycleCas}.`);
  if (!arquivos.includes("package/skills/sema/SKILL.md")
    || !arquivos.includes("package/skills/sema/agents/openai.yaml")
    || !arquivos.some((arquivo) => /^package\/exemplos\/.+\.sema$/iu.test(arquivo))) {
    throw new Error("The public package is missing the bundled skill or official examples.");
  }
  const nomesRuntime = Object.keys(json.dependencies ?? {}).filter((nome) => nome.startsWith("@sema/")).sort();
  if (JSON.stringify(nomesRuntime) !== JSON.stringify([...PACOTES_RUNTIME_PUBLICOS].sort())) {
    throw new Error("The public package runtime inventory is incomplete or divergent.");
  }
  for (const [nome, versao] of Object.entries(json.dependencies ?? {}).filter(([nome]) => nome.startsWith("@sema/"))) {
    const manifestoBundled = `package/node_modules/${nome}/package.json`;
    if (!arquivos.includes(manifestoBundled)) {
      throw new Error(`The npm package is missing bundled dependency metadata for ${nome}.`);
    }
    const bundled = JSON.parse(lerArquivoTarball(caminhoTarball, manifestoBundled, raiz));
    if (bundled.version !== versao) {
      throw new Error(`Bundled dependency ${nome} is ${bundled.version}; manifest declares ${versao}.`);
    }
  }
}

export function validarRuntimeLocalDireto(caminhoTarball, raiz) {
  const arquivos = listarTarball(caminhoTarball, raiz);
  const billing = arquivos.find((arquivo) => /(?:^|\/)billing(?:\/|\.|$)/i.test(arquivo));
  if (billing) {
    throw new Error(`The public package still contains removed billing artifact ${billing}.`);
  }

  for (const arquivo of arquivos.filter((item) => /^package\/dist\/.+\.(?:js|d\.ts|json)$/i.test(item))) {
    const conteudo = lerArquivoTarball(caminhoTarball, arquivo, raiz);
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
    arquivo === "package/package.json" ||
    arquivo === "package/scripts/postinstall.mjs" ||
    /^package\/skills\/sema\/.+\.(?:md|txt|json|ya?ml)$/i.test(arquivo) ||
    /^package\/docs\/.+\.(?:md|txt|json|ya?ml)$/i.test(arquivo),
  );
  for (const arquivo of arquivosPublicosTexto) {
    const conteudo = lerArquivoTarball(caminhoTarball, arquivo, raiz);
    const marcadorPrivado = MARCADORES_CONTEUDO_PRIVADO.find(({ regex }) => regex.test(conteudo));
    if (marcadorPrivado) {
      throw new Error(`The public package contains ${marcadorPrivado.motivo} in ${arquivo}.`);
    }
    if (/[\u00c3\u00c2\uFFFD]/u.test(conteudo)) {
      throw new Error(`The public package contains broken encoding markers in ${arquivo}.`);
    }
  }
}

export function validarReadmePublico(conteudo) {
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
  if (!conteudo.includes("suporte@otimitare.com")) {
    throw new Error("The published README must use suporte@otimitare.com for support.");
  }
  if (!["Claude", "Codex", "GLM", "Kimi"].every((agente) => conteudo.includes(agente))) {
    throw new Error("The published README must declare proven compatibility with Claude, Codex, zCode (GLM) and Kimi.");
  }
  if (!conteudo.includes("npm install -g @semacode/cli") || !conteudo.includes("sema skill status --json")) {
    throw new Error("The published README must document the npm-bundled global Sema skill.");
  }
  if (!conteudo.includes("~/.agents/skills/sema") || !conteudo.includes("~/.sema/bin")) {
    throw new Error("The published README must document the canonical skill root and managed launcher.");
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

export function validarTextoHandshakePublico(conteudo, referencia) {
  if (MARCADOR_NOME_TOOL_MCP_LEGADO.test(conteudo)) {
    throw new Error(`The generated Codex handshake still teaches a legacy MCP tool name in ${referencia}.`);
  }
  if (MARCADOR_MOJIBAKE_VISIVEL.test(conteudo)) {
    throw new Error(`The generated Codex handshake contains mojibake in ${referencia}.`);
  }
}
