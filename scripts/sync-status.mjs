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
  const agora = new Date();
  const ano = String(agora.getFullYear());
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

const commitAtual = executarGit(["rev-parse", "--short", "HEAD"]);
const dataAtual = obterDataLocal();

const conteudoAtual = await readFile(caminhoStatus, "utf8");
const conteudoAtualizado = conteudoAtual
  .replace(/- Ultima atualizacao: .*/u, `- Ultima atualizacao: ${dataAtual}`)
  .replace(/- Ultimo commit de referencia: `.*`/u, `- Ultimo commit de referencia: \`${commitAtual}\``);

if (conteudoAtualizado !== conteudoAtual) {
  await writeFile(caminhoStatus, conteudoAtualizado, "utf8");
  console.log(`STATUS.md sincronizado com data ${dataAtual} e commit ${commitAtual}.`);
} else {
  console.log("STATUS.md ja estava sincronizado.");
}
