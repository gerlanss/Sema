import { spawnSync } from "node:child_process";

const execucao = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "testes/integracao/drift-legado.test.ts",
    "testes/integracao/importador-legado.test.ts",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SEMA_SMOKE_REAL: "1",
    },
  },
);

process.exit(execucao.status ?? 1);
