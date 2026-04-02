import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const raiz = process.cwd();
const pastaPacotes = path.join(raiz, ".tmp", "pacotes-publicos");

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
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return arquivos.at(-1);
}

async function validarManifestSemDependenciasFile(caminhoTarball) {
  const manifest = execFileSync("tar", ["-xOf", caminhoTarball, "package/package.json"], {
    cwd: raiz,
    encoding: "utf8",
  });
  const json = JSON.parse(manifest);
  const dependencias = Object.values(json.dependencies ?? {});
  if (dependencias.some((valor) => typeof valor === "string" && valor.startsWith("file:"))) {
    throw new Error("O pacote publico ainda contem dependencias file:, o que fode a instalacao fora do monorrepo.");
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
    throw new Error("Nenhum pacote publico encontrado. Rode `npm run cli:empacotar-publica` primeiro.");
  }

  const caminhoTarball = path.join(pastaPacotes, tarball);
  await validarManifestSemDependenciasFile(caminhoTarball);

  const sandbox = await mkdtemp(path.join(os.tmpdir(), "sema-cli-publica-"));

  try {
    await writeFile(
      path.join(sandbox, "package.json"),
      `${JSON.stringify({
        name: "sema-cli-publica-smoke",
        private: true,
        version: "1.0.0",
      }, null, 2)}\n`,
      "utf8",
    );

    executar("npm", ["install", caminhoTarball], sandbox);
    executar("npx", ["sema", "--help"], sandbox);
    const ajudaIa = execFileSync("npx", ["--prefix", sandbox, "sema", "ajuda-ia"], {
      cwd: sandbox,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (ajudaIa.includes("Documentos locais encontrados: nenhum")) {
      throw new Error("A CLI publicada ainda nao encontrou os docs de IA no pacote npm.");
    }
    executar("npx", ["sema", "validar", path.join(raiz, "exemplos", "calculadora.sema"), "--json"], sandbox);

    const basePacote = path.join(sandbox, "node_modules", "@semacode", "cli");
    for (const arquivoIa of [
      "AGENTS.md",
      "llms.txt",
      "llms-full.txt",
      "SEMA_BRIEF.md",
      "SEMA_BRIEF.micro.txt",
      "SEMA_BRIEF.curto.txt",
      "SEMA_INDEX.json",
    ]) {
      if (!(await existe(path.join(basePacote, arquivoIa)))) {
        throw new Error(`O pacote publico nao incluiu o artefato IA-first ${arquivoIa}.`);
      }
    }

    const pacotesInternosAninhados = path.join(sandbox, "node_modules", "@semacode", "cli", "node_modules", "@sema");
    const pacotesInternosHoistados = path.join(sandbox, "node_modules", "@sema");
    if (!(await existe(pacotesInternosAninhados)) && !(await existe(pacotesInternosHoistados))) {
      throw new Error("A instalacao do pacote publico nao carregou os pacotes internos esperados.");
    }

    const geradorLuaAninhado = path.join(pacotesInternosAninhados, "gerador-lua", "package.json");
    const geradorLuaHoistado = path.join(pacotesInternosHoistados, "gerador-lua", "package.json");
    if (!(await existe(geradorLuaAninhado)) && !(await existe(geradorLuaHoistado))) {
      throw new Error("A instalacao do pacote publico nao incluiu o pacote interno @sema/gerador-lua.");
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}

main().catch((erro) => {
  console.error("Falha ao validar o pacote publico da CLI da Sema.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
