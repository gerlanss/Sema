// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: testa o pacote publico local-only da CLI antes de publicacao npm.
import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const raiz = process.cwd();
const pastaPacotes = path.join(raiz, ".tmp", "pacotes-instalador-npm");

function executar(comando, argumentos, cwd) {
  if (process.platform === "win32" && (comando === "npm" || comando === "npx")) {
    execFileSync("powershell", ["-NoProfile", "-Command", [comando, ...argumentos].join(" ")], {
      cwd,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(comando, argumentos, {
    cwd,
    stdio: "inherit",
  });
}

async function localizarTarball() {
  const arquivos = (await readdir(pastaPacotes))
    .filter((arquivo) => /^(?:sema-cli|semacode-cli)-\d+\.\d+\.\d+\.tgz$/.test(arquivo))
    .sort((a, b) => compararVersoes(nomeParaVersao(a), nomeParaVersao(b)));

  return arquivos.at(-1);
}

function nomeParaVersao(nomeArquivo) {
  const match = nomeArquivo.match(/-(\d+)\.(\d+)\.(\d+)\.tgz$/);
  if (!match) {
    return [0, 0, 0];
  }

  return match.slice(1).map((parte) => Number.parseInt(parte, 10));
}

function compararVersoes(a, b) {
  for (let indice = 0; indice < 3; indice += 1) {
    const diferenca = a[indice] - b[indice];
    if (diferenca !== 0) {
      return diferenca;
    }
  }

  return 0;
}

async function validarManifestSemDependenciasFile(caminhoTarball) {
  const manifest = execFileSync("tar", ["-xOf", caminhoTarball, "package/package.json"], {
    cwd: raiz,
    encoding: "utf8",
  });
  const json = JSON.parse(manifest);
  const dependencias = Object.values(json.dependencies ?? {});
  if (dependencias.some((valor) => typeof valor === "string" && valor.startsWith("file:"))) {
    throw new Error("The npm package still contains file: dependencies.");
  }
  for (const artifact of ["AGENTS.md", "AGENT_CONTEXT_PACK.json", "SEMA_INDEX.json", "SEMA_BRIEF.md"]) {
    if ((json.files ?? []).includes(artifact)) {
      throw new Error(`The public package manifest must not include private workspace artifact ${artifact}.`);
    }
  }
}

function validarReadmePublico(conteudo) {
  const secoesObrigatorias = [
    "## Install",
    "## Local Workflow",
    "## Code Generation",
    "## Public Boundary",
    "## Support",
  ];
  const secoesAusentes = secoesObrigatorias.filter((secao) => !conteudo.includes(secao));
  if (secoesAusentes.length > 0) {
    throw new Error(`The published README is missing required sections: ${secoesAusentes.join(", ")}.`);
  }
  if (!conteudo.includes("suporte@otimitare.online")) {
    throw new Error("The published README must use suporte@otimitare.online for support.");
  }
  const padroesPrivados = [
    String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----`,
    String.raw`\bDATABASE_URL\b|\bDB_PASSWORD\b`,
    String.raw`\b(?:api[_-]?key|secret|token|password|senha|credential)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}`,
    String.raw`\b(?:AUTH_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|PRIVATE_KEY)\b\s*[:=]\s*["'][A-Za-z0-9_./+=-]{16,}["']`,
  ].join("|");
  if (new RegExp(padroesPrivados, "i").test(conteudo)) {
    throw new Error("The published README still mentions private operational material or credentials.");
  }
  if (/[\u00c3\u00c2\uFFFD]/u.test(conteudo)) {
    throw new Error("The published README contains broken encoding markers.");
  }
}

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const tarball = await localizarTarball();
  if (!tarball) {
    throw new Error("No npm package found. Run `npm run cli:empacotar-publica` first.");
  }

  const caminhoTarball = path.join(pastaPacotes, tarball);
  await validarManifestSemDependenciasFile(caminhoTarball);

  const sandbox = await mkdtemp(path.join(os.tmpdir(), "sema-cli-npm-"));

  try {
    await writeFile(
      path.join(sandbox, "package.json"),
      `${JSON.stringify({
        name: "sema-cli-npm-smoke",
        private: true,
        version: "0.0.0-smoke",
      }, null, 2)}\n`,
      "utf8",
    );

    executar("npm", ["install", caminhoTarball], sandbox);
    executar("npx", ["sema", "--help"], sandbox);
    executar("npx", ["sema", "preflight", "resumo", "--json"], sandbox);
    executar("npx", ["sema", "validar", path.join(raiz, "exemplos", "calculadora.sema"), "--json"], sandbox);

    const basePacote = path.join(sandbox, "node_modules", "@semacode", "cli");
    const semaBin = path.join(basePacote, "dist", "index.js");
    validarReadmePublico(await readFile(path.join(basePacote, "README.md"), "utf8"));

    for (const arquivoDoc of [
      "docs/cli.md",
      "docs/commands.md",
      "docs/documentation.md",
      "docs/security.md",
      "docs/support.md",
    ]) {
      if (!(await existe(path.join(basePacote, arquivoDoc)))) {
        throw new Error(`The public package did not include ${arquivoDoc}.`);
      }
    }

    for (const arquivoPrivado of [
      "AGENTS.md",
      "llms.txt",
      "llms-full.txt",
      "AGENT_CONTEXT_PACK.json",
      "SEMA_BRIEF.md",
      "SEMA_BRIEF.micro.txt",
      "SEMA_BRIEF.curto.txt",
      "SEMA_INDEX.json",
    ]) {
      if (await existe(path.join(basePacote, arquivoPrivado))) {
        throw new Error(`The public package still includes private workspace artifact ${arquivoPrivado}.`);
      }
    }

    for (const [profile, arquivo] of [
      ["software", "profile_software.sema"],
      ["workflow", "profile_workflow_n8n.sema"],
      ["ops", "profile_ops.sema"],
      ["game", "profile_game.sema"],
      ["legal", "profile_legal.sema"],
      ["research", "profile_research.sema"],
    ]) {
      const resultadoProfile = spawnSync(
        process.execPath,
        [semaBin, "profile", "validar", profile, path.join(basePacote, "exemplos", arquivo), "--json"],
        {
          cwd: sandbox,
          encoding: "utf8",
        },
      );
      if (resultadoProfile.status !== 0) {
        throw new Error(`The npm package failed profile ${profile}: ${resultadoProfile.stderr || resultadoProfile.stdout}`);
      }
      const jsonProfile = JSON.parse(resultadoProfile.stdout);
      if (!jsonProfile.aprovado || jsonProfile.bloqueado) {
        throw new Error(`The npm package did not approve the ${profile} example.`);
      }
    }

    const pacotesInternosAninhados = path.join(sandbox, "node_modules", "@semacode", "cli", "node_modules", "@sema");
    const pacotesInternosHoistados = path.join(sandbox, "node_modules", "@sema");
    if (!(await existe(pacotesInternosAninhados)) && !(await existe(pacotesInternosHoistados))) {
      throw new Error("The npm install did not load the expected bundled @sema packages.");
    }

    const geradorLuaAninhado = path.join(pacotesInternosAninhados, "gerador-lua", "package.json");
    const geradorLuaHoistado = path.join(pacotesInternosHoistados, "gerador-lua", "package.json");
    if (!(await existe(geradorLuaAninhado)) && !(await existe(geradorLuaHoistado))) {
      throw new Error("The npm install did not include @sema/gerador-lua.");
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}

main().catch((erro) => {
  console.error("Failed to validate the public local-only Sema CLI package.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
