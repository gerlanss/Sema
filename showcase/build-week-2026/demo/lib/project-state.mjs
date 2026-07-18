// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Applies and restores the controlled implementation states used by the demo.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const repoRoot = resolve(demoDir, "../../..");
export const portableContractPath = resolve(demoDir, "contracts/payment.sema");
export const contractPath = resolve(
  demoDir,
  ".runtime/scenario-contracts/payment.sema",
);
export const baselineFixturePath = resolve(
  demoDir,
  "project/fixtures/payment.baseline.mjs",
);
export const healthyFixturePath = resolve(
  demoDir,
  "project/fixtures/payment.healthy.mjs",
);
export const brokenFixturePath = resolve(
  demoDir,
  "project/fixtures/payment.broken.mjs",
);
export const liveImplementationPath = resolve(
  demoDir,
  "project/src/payment.mjs",
);
export const paymentTestPath = resolve(
  demoDir,
  "project/test/payment.test.mjs",
);

async function copyImplementation(source) {
  await mkdir(dirname(liveImplementationPath), { recursive: true });
  await copyFile(source, liveImplementationPath);
}

function bindContractTo(source, symbol) {
  const supportedSymbols = new Set(["approvePayment", "confirmPayment"]);
  if (!supportedSymbols.has(symbol)) {
    throw new TypeError(`Unsupported contract binding: ${symbol}`);
  }

  const currentSymbol = symbol === "approvePayment" ? "confirmPayment" : "approvePayment";
  const currentBinding = `payment.${currentSymbol}`;
  const targetBinding = `payment.${symbol}`;
  const currentCount = source.split(currentBinding).length - 1;
  const targetCount = source.split(targetBinding).length - 1;

  if (currentCount === 0 && targetCount === 3) {
    return source;
  }

  if (currentCount !== 3 || targetCount !== 0) {
    throw new Error(
      `Expected exactly three ${currentBinding} bindings and no ${targetBinding} bindings`,
    );
  }

  return source.replaceAll(currentBinding, targetBinding);
}

async function writeRuntimeContract(symbol) {
  const portableSource = await readFile(portableContractPath, "utf8");
  const runtimeSource = bindContractTo(portableSource, symbol);
  await mkdir(dirname(contractPath), { recursive: true });
  await writeFile(contractPath, runtimeSource, "utf8");
}

async function readImplementationSymbols() {
  const source = await readFile(liveImplementationPath, "utf8");
  return {
    hasApprovePayment: /\bfunction\s+approvePayment\b/.test(source),
    hasConfirmPayment: /\bfunction\s+confirmPayment\b/.test(source),
  };
}

export async function resetProject() {
  await copyImplementation(healthyFixturePath);
  await writeRuntimeContract("confirmPayment");
  const symbols = await readImplementationSymbols();

  if (symbols.hasApprovePayment || !symbols.hasConfirmPayment) {
    throw new Error("Healthy fixture did not restore the final contracted symbol");
  }

  return {
    restored: true,
    implementation_symbol: "confirmPayment",
  };
}

export async function prepareBaseline() {
  await copyImplementation(baselineFixturePath);
  await writeRuntimeContract("approvePayment");
  const symbols = await readImplementationSymbols();

  if (!symbols.hasApprovePayment || symbols.hasConfirmPayment) {
    throw new Error("Baseline fixture did not restore approvePayment");
  }

  return {
    restored: true,
    implementation_symbol: "approvePayment",
  };
}

export async function applyBrokenRename() {
  await copyImplementation(brokenFixturePath);
  const symbols = await readImplementationSymbols();

  if (symbols.hasApprovePayment || !symbols.hasConfirmPayment) {
    throw new Error("Broken fixture did not apply the controlled partial rename");
  }

  return {
    renamed: true,
    implementation_symbol: "confirmPayment",
  };
}

export async function completeSemanticRename() {
  const source = await readFile(contractPath, "utf8");
  await writeFile(contractPath, bindContractTo(source, "confirmPayment"), "utf8");
  const symbols = await readImplementationSymbols();

  if (symbols.hasApprovePayment || !symbols.hasConfirmPayment) {
    throw new Error("Code did not retain confirmPayment during contract repair");
  }

  return {
    completed: true,
    implementation_symbol: "confirmPayment",
  };
}

export async function readContractSnapshot() {
  const source = await readFile(contractPath, "utf8");
  const taskStart = source.indexOf("task approve_payment");
  const nextTask = source.indexOf("\n  task ", taskStart + 1);
  const taskSource = source.slice(
    taskStart,
    nextTask === -1 ? source.length : nextTask,
  );
  const implementationBinding = taskSource.match(
    /\bjs:\s+payment\.(approvePayment|confirmPayment)\b/,
  )?.[1];
  const normalizedSource = source.replaceAll(
    /payment\.(?:approvePayment|confirmPayment)/g,
    "payment.<implementation>",
  );

  return {
    hash: createHash("sha256").update(source).digest("hex"),
    semanticShapeHash: createHash("sha256")
      .update(normalizedSource)
      .digest("hex"),
    implementationBinding,
    receiptGuaranteePreserved:
      taskStart >= 0 &&
      /guarantees\s*\{[\s\S]*?\breceipt_id\s+existe\b/.test(taskSource),
  };
}
