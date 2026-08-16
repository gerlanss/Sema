// SEMA-GOVERNED: sema.produto.cli_dev_mode
// Consulte contratos/sema/cli_dev_mode.sema antes de editar.
// Descrição: inicia a CLI em modo de desenvolvimento sem publicar ou instalar artefatos.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const argumentos = process.argv.slice(2);
const tscCli = path.resolve("node_modules/typescript/bin/tsc");

function executarTsc(argumentosTsc) {
  return spawnSync(process.execPath, [tscCli, ...argumentosTsc], {
    stdio: "inherit",
    shell: false,
  });
}

const clean = executarTsc(["-b", "--clean"]);

if ((clean.status ?? 1) !== 0) {
  process.exit(clean.status ?? 1);
}

rmSync(path.resolve("pacotes/cli/dist"), { recursive: true, force: true });

const build = executarTsc(["-b"]);

if ((build.status ?? 1) !== 0) {
  process.exit(build.status ?? 1);
}

const executar = spawnSync(process.execPath, ["pacotes/cli/dist/bin.js", ...argumentos], {
  stdio: "inherit",
  shell: false,
});

process.exit(executar.status ?? 1);
