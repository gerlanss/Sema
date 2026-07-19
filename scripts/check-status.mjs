// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
// Descrição: valida se STATUS.md segue a estrutura esperada para contexto operacional do projeto.
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const caminhoStatus = new URL("../STATUS.md", import.meta.url);
const caminhoManifestoRaiz = new URL("../package.json", import.meta.url);
const secoesObrigatorias = [
  "# Sema Status",
  "## Current Line",
  "## Release Gate",
  "## Maintenance Focus",
];

function executarGit(args, aceitarFalha = false) {
  const resultado = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!aceitarFalha && (resultado.status ?? 1) !== 0) {
    throw new Error(resultado.stderr?.trim() || `Falha ao executar git ${args.join(" ")}`);
  }

  return {
    codigo: resultado.status ?? 1,
    stdout: resultado.stdout.trim(),
    stderr: resultado.stderr.trim(),
  };
}

function falhar(mensagem) {
  console.error(`STATUS.md invalido: ${mensagem}`);
  process.exit(1);
}

const conteudo = await readFile(caminhoStatus, "utf8");
const manifestoRaiz = JSON.parse(await readFile(caminhoManifestoRaiz, "utf8"));
const versaoPublica = typeof manifestoRaiz.version === "string" ? manifestoRaiz.version : "";
const normalizar = (texto) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "");
const conteudoNormalizado = normalizar(conteudo).toLowerCase();

for (const secao of secoesObrigatorias) {
  if (!conteudoNormalizado.includes(normalizar(secao).toLowerCase())) {
    falhar(`secao obrigatoria ausente: ${secao}`);
  }
}

const conteudoSemAcentos = normalizar(conteudo);
const linhaData = conteudoSemAcentos.match(/- last updated: (\d{4}-\d{2}-\d{2})/iu);
if (!linhaData) {
  falhar("linha Last updated ausente ou fora do formato YYYY-MM-DD.");
}

const linhaCommit = conteudoSemAcentos.match(/- reference commit: `?([0-9a-f]{7,40})`?/iu);
if (!linhaCommit) {
  falhar("linha Reference commit ausente ou invalida.");
}

const commitReferencia = linhaCommit[1];
const commitExiste = executarGit(["rev-parse", "--verify", `${commitReferencia}^{commit}`], true);
if (commitExiste.codigo !== 0) {
  falhar(`o commit de referencia ${commitReferencia} nao existe neste repositorio.`);
}

if (!versaoPublica || !conteudo.includes(`Version: \`${versaoPublica}\``) || !conteudo.includes("Package: `@semacode/cli`")) {
  falhar(`versao ou pacote publico ${versaoPublica || "invalido"} ausente.`);
}
if (!conteudo.includes("official skill bootstraps") || !conteudo.includes("generated `AGENTS.md` becomes the automatic workspace protocol")) {
  falhar("fronteira Skill -> AGENTS.md -> CLI nao esta explicita.");
}

function obterArquivosAlteradosNoRange() {
  if (process.env.GITHUB_EVENT_NAME === "pull_request" && process.env.GITHUB_BASE_REF) {
    executarGit(["fetch", "origin", process.env.GITHUB_BASE_REF, "--depth", "1"], true);
    const diff = executarGit(["diff", "--name-only", `origin/${process.env.GITHUB_BASE_REF}...HEAD`], true);
    if (diff.codigo === 0) {
      return diff.stdout.split(/\r?\n/u).filter(Boolean);
    }
  }

  const headAnterior = executarGit(["rev-parse", "--verify", "HEAD^"], true);
  if (headAnterior.codigo === 0) {
    const diff = executarGit(["diff", "--name-only", "HEAD^..HEAD"], true);
    if (diff.codigo === 0) {
      return diff.stdout.split(/\r?\n/u).filter(Boolean);
    }
  }

  return [];
}

function obterArquivosAlteradosNoWorktree() {
  const resultado = spawnSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if ((resultado.status ?? 1) !== 0 || !resultado.stdout) {
    return [];
  }

  return resultado.stdout
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((linha) => linha.slice(3).trim())
    .filter(Boolean);
}

const arquivosAlterados = [...new Set([
  ...obterArquivosAlteradosNoRange(),
  ...obterArquivosAlteradosNoWorktree(),
])];
const statusAlterado = arquivosAlterados.includes("STATUS.md");
const mudancasRelevantes = arquivosAlterados.some((arquivo) =>
  arquivo.startsWith("pacotes/") ||
  arquivo.startsWith("contratos/") ||
  arquivo.startsWith("plugins/") ||
  arquivo.startsWith(".agents/") ||
  arquivo.startsWith("docs/") ||
  arquivo.startsWith("exemplos/") ||
  arquivo.startsWith("scripts/") ||
  arquivo === "package.json" ||
  arquivo === "README.md",
);

if (mudancasRelevantes && !statusAlterado) {
  falhar("houve mudancas relevantes no projeto sem atualizacao correspondente de STATUS.md.");
}

console.log("STATUS.md validado com sucesso.");
