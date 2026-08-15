// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.agent_pack, sema.produto.fronteira_repositorios
// Consulte contratos/sema/governanca_ia_contexto_agent_pack.sema antes de editar.
// Descricao: prova o bootstrap Codex materializado e suas barreiras de escrita no pacote instalado.
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validarTextoHandshakePublico } from "./fronteira-publica.mjs";

async function validarHandshakeCodexMaterializado(projetoCodex, agents, packCodex, existe) {
  const referencias = [...new Set([
    ...(packCodex.ordemLeitura ?? []),
    ...Object.values(packCodex.guiaPorCapacidade ?? {}).flat(),
  ])];
  const ordemAgents = agents.match(/^Ordem de leitura: (.+)\.$/mu)?.[1]
    ?.split(" -> ")
    .map((item) => item.trim()) ?? [];
  referencias.push(...ordemAgents);

  for (const referencia of new Set(referencias)) {
    if (typeof referencia !== "string" || !(await existe(path.join(projetoCodex, referencia)))) {
      throw new Error(`The Codex handshake references missing bootstrap artifact ${String(referencia)}.`);
    }
  }

  for (const referencia of [
    "AGENTS.md",
    "SEMA_BOOT.md",
    "SEMA_SMALL_MODEL.md",
    "AGENT_CONTEXT_PACK.json",
    "SEMA_INDEX.json",
    "docs/commands.md",
    "docs/ai-workflow.md",
  ]) {
    validarTextoHandshakePublico(
      await readFile(path.join(projetoCodex, referencia), "utf8"),
      referencia,
    );
  }
}

export async function validarBootstrapCodexInstalado({
  semaBin,
  sandbox,
  executarComSaida,
  existe,
  exemplosInterativosPublicos,
}) {
  const projetoCodex = path.join(sandbox, "projeto-codex");
  await mkdir(projetoCodex, { recursive: true });
  const readmeOriginal = "# README original do projeto\n\nNao sobrescrever.\n";
  await writeFile(path.join(projetoCodex, "README.md"), readmeOriginal, "utf8");
  executarComSaida(process.execPath, [semaBin, "iniciar", "--template", "base"], projetoCodex);
  if (await readFile(path.join(projetoCodex, "README.md"), "utf8") !== readmeOriginal) {
    throw new Error("The installed CLI overwrote an existing README during Codex bootstrap.");
  }
  for (const arquivoExemplo of exemplosInterativosPublicos) {
    if (!(await existe(path.join(projetoCodex, arquivoExemplo)))) {
      throw new Error(`The installed CLI did not materialize nested official example ${arquivoExemplo}.`);
    }
  }
  await mkdir(path.join(projetoCodex, ".github"), { recursive: true });
  await writeFile(
    path.join(projetoCodex, ".github", "copilot-instructions.md"),
    "<!-- sema:agent-entrypoint:start -->\nsema preflight resumo --json\n<!-- sema:agent-entrypoint:end -->\n",
    "utf8",
  );
  const syncCodex = JSON.parse(executarComSaida(process.execPath, [semaBin, "sync-codex", "--json"], projetoCodex));
  if (syncCodex.comando !== "sync-codex" || !syncCodex.sucesso || !syncCodex.resultadosCodex?.entrypointsLegadosLimpos) {
    throw new Error("The installed public CLI did not complete the Codex-native synchronization flow.");
  }
  const agents = await readFile(path.join(projetoCodex, "AGENTS.md"), "utf8");
  if (!agents.includes("Sema para Codex") || /\bsema\s+preflight\b|\buse_cli_local\b/i.test(agents)) {
    throw new Error("The installed public CLI generated an invalid Codex AGENTS.md handshake.");
  }
  if (await existe(path.join(projetoCodex, ".github", "copilot-instructions.md"))) {
    throw new Error("The installed public CLI did not remove the managed legacy Copilot entrypoint.");
  }

  const legadoMalformado = [
    "MANUAL-BEFORE",
    "<!-- sema:agent-entrypoint:start -->",
    "ORPHAN-CONTENT-MUST-SURVIVE",
    "<!-- sema:agent-entrypoint:start -->",
    "OLD",
    "<!-- sema:agent-entrypoint:end -->",
    "MANUAL-AFTER",
    "",
  ].join("\n");
  await mkdir(path.join(projetoCodex, ".github"), { recursive: true });
  const legadoMalformadoPath = path.join(projetoCodex, ".github", "copilot-instructions.md");
  await writeFile(legadoMalformadoPath, legadoMalformado, "utf8");
  const syncMalformado = spawnSync(process.execPath, [semaBin, "sync-codex", "--json"], {
    cwd: projetoCodex,
    encoding: "utf8",
  });
  if (syncMalformado.status === 0 || await readFile(legadoMalformadoPath, "utf8") !== legadoMalformado) {
    throw new Error("The installed CLI did not fail closed while preserving a malformed managed block.");
  }

  const projetoJunction = path.join(sandbox, "projeto-junction");
  const foraJunction = path.join(sandbox, "fora-junction");
  await mkdir(projetoJunction, { recursive: true });
  await mkdir(foraJunction, { recursive: true });
  await symlink(foraJunction, path.join(projetoJunction, "contratos"), process.platform === "win32" ? "junction" : "dir");
  const iniciarJunction = spawnSync(process.execPath, [semaBin, "iniciar", "--template", "base"], {
    cwd: projetoJunction,
    encoding: "utf8",
  });
  if (iniciarJunction.status === 0 || await existe(path.join(foraJunction, "pedidos.sema"))) {
    throw new Error("The installed CLI followed a junction outside the bootstrap workspace.");
  }
  const packCodex = JSON.parse(await readFile(path.join(projetoCodex, "AGENT_CONTEXT_PACK.json"), "utf8"));
  if (packCodex.versao !== 7 || packCodex.descoberta?.schemaVersion !== "sema.discovery/v1" || packCodex.entrypointCodex !== "AGENTS.md" || !packCodex.codexNativo || !packCodex.cliLocalSemAutorizacao) {
    throw new Error("The installed public CLI generated an outdated Agent Context Pack schema.");
  }
  await validarHandshakeCodexMaterializado(projetoCodex, agents, packCodex, existe);
  const workflowCodex = await readFile(path.join(projetoCodex, "docs", "ai-workflow.md"), "utf8");
  if (!workflowCodex.startsWith("<!-- sema:agent-entrypoint:start -->\n# Practical Codex + Sema Workflow") || /\b(?:Leia|Rode)\b/u.test(workflowCodex)) {
    throw new Error("The installed public CLI regenerated generic or mixed-language Codex workflow docs.");
  }

  return projetoCodex;
}
