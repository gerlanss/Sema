import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const raiz = process.cwd();
const origemExtensao = path.join(raiz, "pacotes", "editor-vscode");
const origemNucleo = path.join(raiz, "pacotes", "nucleo");
const stageDir = path.join(raiz, ".tmp", "editor-vscode-stage");
const saidaDir = path.join(raiz, ".tmp", "editor-vscode");

function executar(comando, argumentos, cwd) {
  if (process.platform === "win32" && (comando === "npm" || comando === "npx")) {
    const script = [comando, ...argumentos].join(" ");
    execFileSync("powershell", ["-NoProfile", "-Command", script], {
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

async function copiarEstruturaBase() {
  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });
  await mkdir(saidaDir, { recursive: true });

  const itens = [
    "extension.js",
    "server.js",
    "language-configuration.json",
    "logo.png",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    ".vscodeignore",
    "syntaxes",
    "snippets",
  ];

  for (const item of itens) {
    await cp(path.join(origemExtensao, item), path.join(stageDir, item), {
      recursive: true,
    });
  }
}

async function prepararPacoteNucleo() {
  const vendorDir = path.join(stageDir, "vendor", "nucleo");
  await mkdir(vendorDir, { recursive: true });

  const pacoteNucleo = JSON.parse(await readFile(path.join(origemNucleo, "package.json"), "utf8"));
  const pacoteMinimo = {
    name: pacoteNucleo.name,
    version: pacoteNucleo.version,
    type: pacoteNucleo.type,
    main: pacoteNucleo.main,
    types: pacoteNucleo.types,
  };

  await writeFile(path.join(vendorDir, "package.json"), `${JSON.stringify(pacoteMinimo, null, 2)}\n`, "utf8");
  await cp(path.join(origemNucleo, "dist"), path.join(vendorDir, "dist"), {
    recursive: true,
  });
}

async function prepararPackageJsonStage() {
  const pacoteExtensao = JSON.parse(await readFile(path.join(origemExtensao, "package.json"), "utf8"));
  const dependencias = {
    ...pacoteExtensao.dependencies,
  };
  delete dependencias["@sema/nucleo"];

  const pacoteStage = {
    ...pacoteExtensao,
    private: false,
    publisher: pacoteExtensao.publisher,
    dependencies: dependencias,
  };

  await writeFile(path.join(stageDir, "package.json"), `${JSON.stringify(pacoteStage, null, 2)}\n`, "utf8");
}

async function main() {
  console.log("Preparando stage da extensao VS Code da Sema...");
  await copiarEstruturaBase();
  await prepararPacoteNucleo();
  await prepararPackageJsonStage();

  console.log("Instalando dependencias da extensao no stage...");
  executar("npm", ["install", "--omit=dev"], stageDir);

  const pacoteStage = JSON.parse(await readFile(path.join(stageDir, "package.json"), "utf8"));
  const nomeVsix = `${pacoteStage.name}-${pacoteStage.version}.vsix`;
  const caminhoVsix = path.join(saidaDir, nomeVsix);

  console.log("Empacotando VSIX...");
  executar("npx", ["@vscode/vsce", "package", "--allow-missing-repository", "-o", caminhoVsix], stageDir);

  console.log(`Extensao empacotada com sucesso em ${caminhoVsix}`);
}

main().catch((erro) => {
  console.error("Falha ao empacotar a extensao VS Code da Sema.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
