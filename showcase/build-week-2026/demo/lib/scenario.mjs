// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Runs the deterministic red-to-green Build Week terminal demonstration.

import { spawnSync } from "node:child_process";
import { relative } from "node:path";

import { prepareBootstrapWorkspace } from "./bootstrap-state.mjs";
import {
  applyBrokenRename,
  completeSemanticRename,
  contractPath,
  paymentTestPath,
  prepareBaseline,
  readContractSnapshot,
  repoRoot,
  resetProject,
} from "./project-state.mjs";

const contractRelative = relative(repoRoot, contractPath).replaceAll("\\", "/");
const testRelative = relative(repoRoot, paymentTestPath).replaceAll("\\", "/");
const semaExecutable = process.platform === "win32"
  ? (process.env.ComSpec ?? "cmd.exe")
  : "sema";
const semaPrefix = process.platform === "win32"
  ? ["/d", "/s", "/c", "sema.cmd"]
  : [];
const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

const tone = {
  cyan: (value) => (useColor ? `\u001b[36m${value}\u001b[0m` : value),
  green: (value) => (useColor ? `\u001b[32m${value}\u001b[0m` : value),
  red: (value) => (useColor ? `\u001b[31m${value}\u001b[0m` : value),
  yellow: (value) => (useColor ? `\u001b[33m${value}\u001b[0m` : value),
};

function run(command, args, acceptedStatuses = [0]) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (!acceptedStatuses.includes(result.status)) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.status}${
        details ? `\n${details}` : ""
      }`,
    );
  }

  return result;
}

function parseJson(result, label) {
  try {
    return JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${error.message}`);
  }
}

function assertCleanDrift(drift, label) {
  const brokenImpls = drift.impls_quebrados ?? [];
  const brokenLinks = drift.vinculos_quebrados ?? [];
  const divergentRoutes = drift.rotas_divergentes ?? [];

  if (
    drift.sucesso !== true ||
    brokenImpls.length > 0 ||
    brokenLinks.length > 0 ||
    divergentRoutes.length > 0
  ) {
    throw new Error(`${label} was not clean`);
  }
}

function assertControlledBreak(drift) {
  const brokenImpl = (drift.impls_quebrados ?? []).find(
    (item) =>
      item.task === "approve_payment" &&
      item.caminho?.endsWith(".approvePayment"),
  );
  const brokenLink = (drift.vinculos_quebrados ?? []).find(
    (item) =>
      item.dono === "approve_payment" &&
      item.tipo === "simbolo" &&
      item.valor?.endsWith(".approvePayment"),
  );

  if (drift.sucesso !== false || !brokenImpl || !brokenLink) {
    throw new Error("Sema did not report the expected approvePayment break");
  }

  return { brokenImpl, brokenLink };
}

function logStep(number, title) {
  console.log(`\n${tone.cyan(`[${number}/6]`)} ${title}`);
}

function logPass(message) {
  console.log(`  ${tone.green("PASS")}  ${message}`);
}

function runSemaJson(args, acceptedStatuses = [0]) {
  return parseJson(
    run(semaExecutable, [...semaPrefix, ...args], acceptedStatuses),
    `sema ${args[0]}`,
  );
}

function finalizeChange() {
  const documents = [
    "AGENTS.md",
    "SEMA_INDEX.json",
    "README.md",
    "docs/README.md",
    "pacotes/cli/README.md",
    "docs/cli.md",
    "docs/syntax.md",
    "docs/ai-workflow.md",
    "showcase/build-week-2026/demo/README.md",
    "showcase/build-week-2026/demo/contracts/payment.sema",
    "contratos/sema/build_week_demo.sema",
  ];
  const args = [
    "finalizar-mudanca",
    "--intencao",
    "prove that Sema catches a partial payment rename and restores the receipt guarantee",
  ];

  for (const document of documents) {
    args.push("--doc-lida", document);
  }

  args.push("--json");
  return runSemaJson(args);
}

export async function runScenario({ mode = "demo" } = {}) {
  if (!new Set(["demo", "smoke"]).has(mode)) {
    throw new TypeError(`Unsupported demo mode: ${mode}`);
  }

  console.log("\nSEMA / OPENAI BUILD WEEK 2026");
  console.log("Semantic contracts turn agent changes into verifiable evidence.");

  try {
    logStep(1, "Use the installed public CLI");
    const version = run(semaExecutable, [...semaPrefix, "--version"]).stdout.trim();
    logPass(`sema ${version}; no local rebuild`);

    logStep(2, "Prepare a clean first-contact workspace");
    const bootstrap = await prepareBootstrapWorkspace();
    logPass("no AGENTS.md and no .sema contract before bootstrap");
    if (mode === "demo") {
      console.log(`  workspace: ${bootstrap.workspace_path}`);
    }

    logStep(3, "Prove the contracted baseline");
    await resetProject();
    const canonicalSnapshot = await readContractSnapshot();
    if (
      canonicalSnapshot.implementationBinding !== "confirmPayment" ||
      !canonicalSnapshot.receiptGuaranteePreserved
    ) {
      throw new Error("The canonical confirmPayment contract is not healthy");
    }
    await prepareBaseline();
    const baselineSnapshot = await readContractSnapshot();
    if (
      baselineSnapshot.implementationBinding !== "approvePayment" ||
      baselineSnapshot.semanticShapeHash !== canonicalSnapshot.semanticShapeHash ||
      !baselineSnapshot.receiptGuaranteePreserved
    ) {
      throw new Error("The controlled baseline changed more than the implementation binding");
    }
    const validation = runSemaJson(["validar", contractRelative, "--json"]);
    if (validation.valido !== true || validation.bloqueia_acao !== false) {
      throw new Error("The Build Week demo contract did not validate");
    }
    const baseline = runSemaJson([
      "drift",
      contractRelative,
      "--escopo",
      "modulo",
      "--incluir-consumidores-laterais",
      "--json",
    ]);
    assertCleanDrift(baseline, "Baseline drift");
    logPass("approve_payment -> approvePayment is linked and receipt_id is guaranteed");

    logStep(4, "Simulate an agent's incomplete rename");
    await applyBrokenRename();
    const brokenSnapshot = await readContractSnapshot();
    if (
      brokenSnapshot.hash !== baselineSnapshot.hash ||
      !brokenSnapshot.receiptGuaranteePreserved
    ) {
      throw new Error("The controlled break changed the semantic contract");
    }
    const brokenDrift = runSemaJson(
      [
        "drift",
        contractRelative,
        "--escopo",
        "modulo",
        "--incluir-consumidores-laterais",
        "--json",
      ],
      [0, 1],
    );
    assertControlledBreak(brokenDrift);
    console.log(
      `  ${tone.red("DETECTED")} approve_payment still requires ${tone.yellow(
        "approvePayment",
      )}; code exposes confirmPayment`,
    );
    logPass("receipt_id guarantee remained in the untouched contract");

    logStep(5, "Complete the semantic rename and prove behavior");
    await completeSemanticRename();
    run(process.execPath, ["--test", testRelative]);
    const finalValidation = runSemaJson(["validar", contractRelative, "--json"]);
    if (finalValidation.valido !== true) {
      throw new Error("Contract validation failed after the correction");
    }
    const finalDrift = runSemaJson([
      "drift",
      contractRelative,
      "--escopo",
      "modulo",
      "--incluir-consumidores-laterais",
      "--json",
    ]);
    assertCleanDrift(finalDrift, "Final drift");
    const finalSnapshot = await readContractSnapshot();
    if (
      finalSnapshot.hash !== canonicalSnapshot.hash ||
      finalSnapshot.semanticShapeHash !== baselineSnapshot.semanticShapeHash ||
      finalSnapshot.implementationBinding !== "confirmPayment" ||
      !finalSnapshot.receiptGuaranteePreserved
    ) {
      throw new Error("Semantic repair changed more than the binding or removed receipt_id");
    }
    logPass("contract and code converge on confirmPayment; receipt_id stays guaranteed");

    logStep(6, "Close with documentation evidence");
    const closure = finalizeChange();
    if (closure.sucesso !== true) {
      throw new Error("Sema did not close the governed change");
    }
    logPass("finalizar-mudanca accepted the declared evidence");

    const result = {
      success: true,
      mode,
      cli_version: version,
      bootstrap_workspace_clean:
        bootstrap.agents_absent && bootstrap.contracts_absent,
      drift_detected: true,
      broken_symbol: "approvePayment",
      final_symbol: "confirmPayment",
      receipt_guarantee_preserved: true,
      tests_passed: true,
      final_drift_clean: true,
      closure_green: true,
    };

    console.log(`\n${tone.green("RESULT: VERIFIED")}`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await resetProject();
  }
}
