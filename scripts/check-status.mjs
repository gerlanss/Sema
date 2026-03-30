import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const caminhoStatus = new URL("../STATUS.md", import.meta.url);
const secoesObrigatorias = [
  "## Quadro-resumo",
  "## Legenda",
  "## Em Andamento Nesta Sprint",
  "## Fundacao do Projeto",
  "## Nucleo do Compilador",
  "## Semantica da Linguagem",
  "## Geracao de Codigo",
  "## CLI",
  "## Exemplos Obrigatorios",
  "## Documentacao",
  "## Testes e Verificacao",
  "## Proximos Passos do MVP",
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

for (const secao of secoesObrigatorias) {
  if (!conteudo.includes(secao)) {
    falhar(`secao obrigatoria ausente: ${secao}`);
  }
}

const linhaData = conteudo.match(/- Ultima atualizacao: (\d{4}-\d{2}-\d{2})/u);
if (!linhaData) {
  falhar("linha de ultima atualizacao ausente ou fora do formato YYYY-MM-DD.");
}

const linhaCommit = conteudo.match(/- Ultimo commit de referencia: `([0-9a-f]{7,40})`/u);
if (!linhaCommit) {
  falhar("linha de ultimo commit de referencia ausente ou invalida.");
}

const commitReferencia = linhaCommit[1];
const commitExiste = executarGit(["rev-parse", "--verify", `${commitReferencia}^{commit}`], true);
if (commitExiste.codigo !== 0) {
  falhar(`o commit de referencia ${commitReferencia} nao existe neste repositorio.`);
}

const marcadores = ["[x]", "[-]", "[ ]", "[!]"];
if (!marcadores.some((marcador) => conteudo.includes(marcador))) {
  falhar("nenhum marcador de status foi encontrado.");
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
  const status = executarGit(["status", "--porcelain"], true);
  if (status.codigo !== 0 || !status.stdout) {
    return [];
  }

  return status.stdout
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
  arquivo.startsWith("exemplos/") ||
  arquivo.startsWith("showcases/") ||
  arquivo.startsWith("scripts/") ||
  arquivo === "package.json" ||
  arquivo === "README.md",
);

if (mudancasRelevantes && !statusAlterado) {
  falhar("houve mudancas relevantes no projeto sem atualizacao correspondente de STATUS.md.");
}

console.log("STATUS.md validado com sucesso.");
