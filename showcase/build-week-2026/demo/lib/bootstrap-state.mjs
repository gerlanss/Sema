// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Creates the isolated pre-Sema workspace used for the bootstrap recording.

import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = resolve(demoDir, "bootstrap-seed");
const runtimeDir = resolve(demoDir, ".runtime");

export const bootstrapWorkspace = resolve(runtimeDir, "bootstrap-workspace");

function assertSafeRuntimeTarget(target) {
  const relativeTarget = relative(runtimeDir, target);
  const escapesRuntime =
    relativeTarget === "" ||
    relativeTarget.startsWith("..") ||
    isAbsolute(relativeTarget);

  if (escapesRuntime || relativeTarget !== "bootstrap-workspace") {
    throw new Error(`Refusing to reset unexpected bootstrap path: ${target}`);
  }
}

async function findHandshakeArtifacts(directory) {
  const found = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findHandshakeArtifacts(target)));
      continue;
    }

    if (entry.name === "AGENTS.md" || entry.name.endsWith(".sema")) {
      found.push(target);
    }
  }

  return found;
}

export async function prepareBootstrapWorkspace() {
  assertSafeRuntimeTarget(bootstrapWorkspace);
  await mkdir(runtimeDir, { recursive: true });
  await rm(bootstrapWorkspace, { recursive: true, force: true });
  await cp(seedDir, bootstrapWorkspace, { recursive: true, errorOnExist: true });

  const handshakeArtifacts = await findHandshakeArtifacts(bootstrapWorkspace);
  if (handshakeArtifacts.length > 0) {
    throw new Error(
      `Bootstrap seed is not clean: ${handshakeArtifacts.join(", ")}`,
    );
  }

  return {
    workspace_path: bootstrapWorkspace,
    agents_absent: true,
    contracts_absent: true,
  };
}
