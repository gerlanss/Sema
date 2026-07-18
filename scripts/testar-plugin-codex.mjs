// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: instala a skill oficial em um CODEX_HOME isolado e prova o bootstrap sem MCP.
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const raiz = process.cwd();

function executarCodex(argumentos, codexHome) {
  const resultado = spawnSync("codex", argumentos, {
    cwd: raiz,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
    },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: true,
  });
  if (resultado.error) {
    throw resultado.error;
  }
  if (resultado.status !== 0) {
    throw new Error(`codex ${argumentos.join(" ")} failed: ${resultado.stderr || resultado.stdout}`);
  }
  return `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;
}

async function main() {
  const pacote = JSON.parse(await readFile(path.join(raiz, "package.json"), "utf8"));
  const versao = pacote.version;
  const versaoRegex = versao.replaceAll(".", "\\.");
  const temporario = await mkdtemp(path.join(os.tmpdir(), "sema-plugin-codex-"));
  const codexHome = path.join(temporario, "codex-home");
  await mkdir(codexHome, { recursive: true });

  try {
    executarCodex(["plugin", "marketplace", "add", raiz], codexHome);
    executarCodex(["plugin", "add", "sema@sema"], codexHome);
    const listagem = executarCodex(["plugin", "list"], codexHome);
    if (!new RegExp(`sema@sema\\s+installed, enabled\\s+${versaoRegex}`, "u").test(listagem)) {
      throw new Error(`The isolated Codex installation did not enable sema@sema ${versao}.`);
    }

    const fonte = path.join(raiz, "plugins", "sema");
    const instalado = path.join(codexHome, "plugins", "cache", "sema", "sema", versao);
    await access(path.join(instalado, ".codex-plugin", "plugin.json"));
    await access(path.join(instalado, "skills", "sema", "SKILL.md"));

    const skillFonte = await readFile(path.join(fonte, "skills", "sema", "SKILL.md"), "utf8");
    const skillInstalada = await readFile(path.join(instalado, "skills", "sema", "SKILL.md"), "utf8");
    if (skillFonte.replaceAll("\r\n", "\n") !== skillInstalada.replaceAll("\r\n", "\n")) {
      throw new Error("The installed Sema skill differs from the versioned source.");
    }

    const manifesto = JSON.parse(await readFile(path.join(instalado, ".codex-plugin", "plugin.json"), "utf8"));
    if (manifesto.name !== "sema" || manifesto.version !== versao || manifesto.apps || manifesto.mcpServers) {
      throw new Error(`The installed Sema plugin manifest is not the expected skill-only ${versao} bootstrap.`);
    }
    if (manifesto.interface?.composerIcon !== "./assets/sema.png" || manifesto.interface?.logo !== "./assets/sema.png") {
      throw new Error("The installed Sema plugin manifest does not use the official PNG logo.");
    }

    const logoFonte = await readFile(path.join(raiz, "logo.png"));
    const logoInstalada = await readFile(path.join(instalado, "assets", "sema.png"));
    if (!logoFonte.equals(logoInstalada)) {
      throw new Error("The installed Sema plugin logo differs from the official repository logo.");
    }

    const mcp = executarCodex(["mcp", "list"], codexHome);
    if (/^sema\s+/imu.test(mcp)) {
      throw new Error("The isolated Codex installation unexpectedly registered a Sema MCP server.");
    }

    const resultado = {
      sucesso: true,
      marketplace: "sema",
      plugin: "sema@sema",
      versao: manifesto.version,
      skill_bootstrap_instalada: true,
      logo_oficial_instalada: true,
      mcp_sema_ausente: true,
    };
    console.log(JSON.stringify(resultado, null, 2));
    return resultado;
  } finally {
    await rm(temporario, { recursive: true, force: true });
  }
}

main().catch((erro) => {
  console.error("Failed to validate the Sema Codex bootstrap plugin.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});

export { main };
