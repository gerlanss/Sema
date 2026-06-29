// SEMA-GOVERNED: sema.produto.cli_dev_mode
// Consulte contratos/sema/cli_dev_mode.sema antes de editar.
// Descrição: inicia a CLI em modo de desenvolvimento sem publicar ou instalar artefatos.
import { spawnSync } from "node:child_process";

const argumentos = process.argv.slice(2);

const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: true,
});

if ((build.status ?? 1) !== 0) {
  process.exit(build.status ?? 1);
}

const executar = spawnSync("node", ["pacotes/cli/dist/index.js", ...argumentos], {
  stdio: "inherit",
  shell: true,
});

process.exit(executar.status ?? 1);
