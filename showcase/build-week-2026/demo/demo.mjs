// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Human-facing entrypoint for the Build Week demonstration.

import { fileURLToPath } from "node:url";

import { runScenario } from "./lib/scenario.mjs";

export async function main() {
  await runScenario({ mode: "demo" });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`\nDEMO FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
