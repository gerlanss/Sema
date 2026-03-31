import path from "node:path";
import { spawnSync } from "node:child_process";

function falhar(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

const [, , entradaArquivo, entradaSaida] = process.argv;

if (!entradaArquivo) {
  falhar("Uso: node scripts/preparar-contexto-ia.mjs <arquivo.sema> [pasta-saida]");
}

const cli = path.resolve(process.cwd(), "pacotes", "cli", "dist", "index.js");
const args = [cli, "contexto-ia", entradaArquivo];

if (entradaSaida) {
  args.push("--saida", entradaSaida);
}

const execucao = spawnSync("node", args, {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(execucao.status ?? 1);
