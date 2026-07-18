// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
// Descrição: sincroniza STATUS.md com data e commit de referência.
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const caminhoStatus = new URL("../STATUS.md", import.meta.url);

function executarGit(args) {
  const resultado = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if ((resultado.status ?? 1) !== 0) {
    throw new Error(resultado.stderr?.trim() || `Falha ao executar git ${args.join(" ")}`);
  }

  return resultado.stdout.trim();
}

function obterDataLocal() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const commitAtual = executarGit(["rev-parse", "--short", "HEAD"]);
const dataAtual = obterDataLocal();

const conteudoAtual = await readFile(caminhoStatus, "utf8");
const conteudoAtualizado = conteudoAtual
  .replace(/- Last updated: .*/u, `- Last updated: ${dataAtual}`)
  .replace(/- Reference commit: `.*`/u, `- Reference commit: \`${commitAtual}\``);

if (conteudoAtualizado !== conteudoAtual) {
  await writeFile(caminhoStatus, conteudoAtualizado, "utf8");
  console.log(`STATUS.md sincronizado com data ${dataAtual} e commit ${commitAtual}.`);
} else {
  console.log("STATUS.md ja estava sincronizado.");
}
