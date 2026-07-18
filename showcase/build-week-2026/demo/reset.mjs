// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Idempotent recovery command for the tracked payment implementation.

import { fileURLToPath } from "node:url";

import { resetProject } from "./lib/project-state.mjs";

export async function main() {
  const result = await resetProject();
  console.log(
    JSON.stringify(
      {
        success: true,
        state: "healthy",
        implementation_symbol: result.implementation_symbol,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`RESET FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
