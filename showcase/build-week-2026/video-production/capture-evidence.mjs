// SEMA-GOVERNED: sema.showcase.build_week_2026.video_production
// Contract: contratos/sema/build_week_video_production.sema
// Descricao: Captura estados e saidas reais, sanitizados e reproduziveis, usados como prova no video.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bootstrapWorkspace } from "../demo/lib/bootstrap-state.mjs";
import {
  applyBrokenRename,
  completeSemanticRename,
  contractPath,
  liveImplementationPath,
  paymentTestPath,
  prepareBaseline,
  readContractSnapshot,
  repoRoot,
  resetProject,
} from "../demo/lib/project-state.mjs";

const productionDir = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.join(productionDir, "evidence");
const contractRelative = path.relative(repoRoot, contractPath).replaceAll("\\", "/");
const testRelative = path.relative(repoRoot, paymentTestPath).replaceAll("\\", "/");
const semaExecutable = process.platform === "win32"
  ? (process.env.ComSpec ?? "cmd.exe")
  : "sema";
const semaPrefix = process.platform === "win32"
  ? ["/d", "/s", "/c", "sema.cmd"]
  : [];

function pathForms(value) {
  if (!value) return [];
  return [
    value,
    value.replaceAll("\\", "/"),
    value.replaceAll("\\", "\\\\"),
  ];
}

const redactions = [
  ...pathForms(repoRoot).map((value) => ({ value, replacement: "." })),
  ...pathForms(process.env.APPDATA).map((value) => ({
    value,
    replacement: "<appdata>",
  })),
  ...pathForms(process.env.LOCALAPPDATA).map((value) => ({
    value,
    replacement: "<localappdata>",
  })),
  ...pathForms(process.env.USERPROFILE).map((value) => ({
    value,
    replacement: "~",
  })),
].sort((left, right) => right.value.length - left.value.length);

function sanitizePathText(value) {
  let sanitized = String(value).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
  for (const { value: candidate, replacement } of redactions) {
    sanitized = sanitized.replaceAll(candidate, replacement);
  }

  return sanitized.replace(/[A-Za-z]:[\\/][^\r\n"]*/g, "<absolute-path>");
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeValue(nested)]),
    );
  }
  return typeof value === "string" ? sanitizePathText(value) : value;
}

function assertNoAbsolutePath(content, label) {
  if (/[A-Za-z]:[\\/]/.test(content)) {
    throw new Error(`${label} still contains an absolute Windows path`);
  }
}

function formatOutput(command, stdout, stderr) {
  const sections = [`$ ${command}`];
  if (stdout.trim()) sections.push(stdout.trimEnd());
  if (stderr.trim()) sections.push(`[stderr]\n${stderr.trimEnd()}`);
  return `${sanitizePathText(sections.join("\n"))}\n`;
}

function parseJsonOutput(result, label) {
  try {
    return JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${error.message}`);
  }
}

function assertAcceptedStatus(result, acceptedStatuses) {
  if (!acceptedStatuses.includes(result.exitCode)) {
    throw new Error(
      `${result.command} failed with exit code ${result.exitCode}\n${result.output}`,
    );
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
}

async function findSemaFiles(directory) {
  const found = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findSemaFiles(target)));
    } else if (entry.isFile() && entry.name.endsWith(".sema")) {
      found.push(target);
    }
  }

  return found.sort();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function runCommand({ id, executable, args, cwd, command }) {
  return new Promise((resolve, reject) => {
    const startedAt = new Date().toISOString();
    const child = spawn(executable, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      resolve({
        id,
        command,
        cwd,
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode,
        signal,
        stdout,
        stderr,
        output: formatOutput(command, stdout, stderr),
      });
    });
  });
}

function runNode(id, args, cwd = repoRoot) {
  return runCommand({
    id,
    executable: process.execPath,
    args,
    cwd,
    command: `node ${args.join(" ")}`,
  });
}

function runSema(id, args, cwd = repoRoot) {
  return runCommand({
    id,
    executable: semaExecutable,
    args: [...semaPrefix, ...args],
    cwd,
    command: `sema ${args.join(" ")}`,
  });
}

export async function captureEvidence({ reason = "record final Build Week proof" } = {}) {
  await mkdir(evidenceDir, { recursive: true });

  const commandResults = [];
  const artifacts = new Map();

  const writeTextArtifact = async (filename, value) => {
    const content = sanitizePathText(value);
    assertNoAbsolutePath(content, filename);
    await writeFile(path.join(evidenceDir, filename), content, "utf8");
    artifacts.set(filename, content);
    return content;
  };

  const writeJsonArtifact = async (filename, value) => {
    const content = `${JSON.stringify(sanitizeValue(value), null, 2)}\n`;
    return writeTextArtifact(filename, content);
  };

  const track = async (promise, acceptedStatuses = [0]) => {
    const result = await promise;
    commandResults.push(result);
    assertAcceptedStatus(result, acceptedStatuses);
    return result;
  };

  try {
    const bootstrap = await track(
      runNode("bootstrap", ["showcase/build-week-2026/demo/prepare-bootstrap.mjs"]),
    );
    await writeTextArtifact("bootstrap-output.log", bootstrap.output);
    const bootstrapState = parseJsonOutput(bootstrap, "bootstrap preparation");
    if (
      bootstrapState.success !== true ||
      bootstrapState.agents_absent !== true ||
      bootstrapState.contracts_absent !== true
    ) {
      throw new Error("Bootstrap preparation did not prove a clean workspace");
    }

    const bootstrapInit = await track(
      runSema("bootstrap-init", ["iniciar", "--template", "base"], bootstrapWorkspace),
    );
    await writeTextArtifact("bootstrap-init-output.log", bootstrapInit.output);

    const bootstrapSync = await track(
      runSema("bootstrap-sync", ["sync-codex", "--json"], bootstrapWorkspace),
    );
    await writeTextArtifact("bootstrap-sync-output.log", bootstrapSync.output);
    const syncResult = parseJsonOutput(bootstrapSync, "sema sync-codex");
    if (
      syncResult.sucesso !== true ||
      !syncResult.artefatos?.includes("AGENTS.md") ||
      syncResult.resultadosCodex?.entrypointCodex !== "AGENTS.md"
    ) {
      throw new Error("sync-codex did not generate the official AGENTS.md entrypoint");
    }

    const generatedAgentsPath = path.join(bootstrapWorkspace, "AGENTS.md");
    await writeTextArtifact(
      "bootstrap-generated-AGENTS.md",
      await readFile(generatedAgentsPath, "utf8"),
    );
    const generatedContracts = await findSemaFiles(
      path.join(bootstrapWorkspace, "contratos"),
    );
    if (generatedContracts.length !== 1) {
      throw new Error(
        `Expected one generated bootstrap contract, found ${generatedContracts.length}`,
      );
    }
    await writeTextArtifact(
      "bootstrap-generated-contract.sema",
      await readFile(generatedContracts[0], "utf8"),
    );

    await prepareBaseline();
    const baselineSnapshot = await readContractSnapshot();
    if (
      baselineSnapshot.implementationBinding !== "approvePayment" ||
      baselineSnapshot.receiptGuaranteePreserved !== true
    ) {
      throw new Error("Baseline contract did not preserve approvePayment and receipt_id");
    }
    await writeTextArtifact(
      "contract-before-fix.sema",
      await readFile(contractPath, "utf8"),
    );
    await writeTextArtifact(
      "implementation-before-fix.mjs",
      await readFile(liveImplementationPath, "utf8"),
    );

    await applyBrokenRename();
    const brokenSnapshot = await readContractSnapshot();
    if (
      brokenSnapshot.hash !== baselineSnapshot.hash ||
      brokenSnapshot.receiptGuaranteePreserved !== true
    ) {
      throw new Error("Controlled break changed the contract or removed receipt_id");
    }
    await writeTextArtifact(
      "implementation-broken.mjs",
      await readFile(liveImplementationPath, "utf8"),
    );

    const redDriftResult = await track(
      runSema("red-drift", [
        "drift",
        contractRelative,
        "--escopo",
        "modulo",
        "--incluir-consumidores-laterais",
        "--json",
      ]),
      [0, 1],
    );
    const redDrift = parseJsonOutput(redDriftResult, "red drift");
    assertControlledBreak(redDrift);
    await writeJsonArtifact("red-drift.json", redDrift);

    await completeSemanticRename();
    const finalSnapshot = await readContractSnapshot();
    if (
      finalSnapshot.implementationBinding !== "confirmPayment" ||
      finalSnapshot.semanticShapeHash !== baselineSnapshot.semanticShapeHash ||
      finalSnapshot.receiptGuaranteePreserved !== true
    ) {
      throw new Error("Semantic repair changed more than the binding or removed receipt_id");
    }
    await writeTextArtifact(
      "contract-after-fix.sema",
      await readFile(contractPath, "utf8"),
    );
    await writeTextArtifact(
      "implementation-after-fix.mjs",
      await readFile(liveImplementationPath, "utf8"),
    );

    const tests = await track(runNode("tests", ["--test", testRelative]));
    await writeTextArtifact("tests-output.log", tests.output);

    const validationResult = await track(
      runSema("validation-green", ["validar", contractRelative, "--json"]),
    );
    const validation = parseJsonOutput(validationResult, "green validation");
    if (validation.valido !== true || validation.bloqueia_acao === true) {
      throw new Error("Contract validation was not green after the correction");
    }
    await writeJsonArtifact("validation-green.json", validation);

    const greenDriftResult = await track(
      runSema("green-drift", [
        "drift",
        contractRelative,
        "--escopo",
        "modulo",
        "--incluir-consumidores-laterais",
        "--json",
      ]),
    );
    const greenDrift = parseJsonOutput(greenDriftResult, "green drift");
    assertCleanDrift(greenDrift, "Final drift");
    await writeJsonArtifact("green-drift.json", greenDrift);

    const demo = await track(
      runNode("demo", ["showcase/build-week-2026/demo/demo.mjs"]),
    );
    await writeTextArtifact("demo-output.log", demo.output);
    const smoke = await track(
      runNode("smoke", ["showcase/build-week-2026/demo/smoke-test.mjs"]),
    );
    await writeTextArtifact("smoke-output.log", smoke.output);

    const requiredDemoEvidence = [
      "RESULT: VERIFIED",
      '"drift_detected": true',
      '"broken_symbol": "approvePayment"',
      '"receipt_guarantee_preserved": true',
      '"tests_passed": true',
      '"final_drift_clean": true',
      '"closure_green": true',
    ];
    const missingDemoEvidence = requiredDemoEvidence.filter(
      (item) => !demo.output.includes(item),
    );
    if (missingDemoEvidence.length > 0) {
      throw new Error(
        `Demo output is missing required proof: ${missingDemoEvidence.join(", ")}`,
      );
    }
    if (!smoke.output.includes('"mode": "smoke"') || !smoke.output.includes("RESULT: VERIFIED")) {
      throw new Error("Smoke output is missing its verified smoke result");
    }

    const manifest = {
      capturedAt: new Date().toISOString(),
      reason,
      repoRootRedactedAs: ".",
      commands: commandResults.map(
        ({ id, command, cwd, startedAt, finishedAt, exitCode }) => ({
          id,
          command,
          cwd,
          startedAt,
          finishedAt,
          exitCode,
        }),
      ),
      artifacts: [...artifacts.entries()].map(([filename, content]) => ({
        filename,
        bytes: Buffer.byteLength(content),
        sha256: sha256(content),
      })),
      proof: {
        bootstrapWorkspaceStartedClean: true,
        bootstrapInitializedByPublicCli: true,
        codexHandshakeGenerated: true,
        controlledDriftDetected: true,
        brokenSymbol: "approvePayment",
        finalSymbol: "confirmPayment",
        receiptGuaranteePreserved: true,
        testsPassed: true,
        finalValidationGreen: true,
        finalDriftClean: true,
      },
      requiredDemoEvidence,
      verified: true,
      pathsSanitized: true,
    };
    await writeJsonArtifact("capture-manifest.json", manifest);

    console.log("EVIDENCE_CAPTURED verified=true paths_sanitized=true");
    return {
      verified: true,
      pathsSanitized: true,
      commands: manifest.commands,
      artifacts: manifest.artifacts,
    };
  } finally {
    await resetProject();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await captureEvidence();
}
