// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Automated judge-facing smoke test for the complete red-to-green scenario.

import { fileURLToPath } from "node:url";

import { runScenario } from "./lib/scenario.mjs";

export async function main() {
  const result = await runScenario({ mode: "smoke" });
  if (!result.success) {
    throw new Error("Build Week demo did not complete successfully");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`\nSMOKE TEST FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
