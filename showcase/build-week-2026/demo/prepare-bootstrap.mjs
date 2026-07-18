// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Recreates the clean workspace used to record the Sema first-contact flow.

import { fileURLToPath } from "node:url";

import { prepareBootstrapWorkspace } from "./lib/bootstrap-state.mjs";

export async function main() {
  const result = await prepareBootstrapWorkspace();
  console.log(
    JSON.stringify(
      {
        success: true,
        ...result,
        next: [
          "Open workspace_path in a new Codex task",
          "Invoke $sema or run: sema iniciar --template base",
          "Run: sema sync-codex --json",
          "Open another new task so Codex loads AGENTS.md",
        ],
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`BOOTSTRAP PREP FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
