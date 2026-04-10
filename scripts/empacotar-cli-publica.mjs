import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const raiz = process.cwd();
const stageDir = path.join(raiz, ".tmp", "cli-publica-stage");
const saidaDir = path.join(raiz, ".tmp", "pacotes-publicos");
const origemCli = path.join(raiz, "pacotes", "cli");
const DOCS_IA_PUBLICOS = [
  "AGENT_STARTER.md",
  "como-ensinar-a-sema-para-ia.md",
  "prompt-base-ia-sema.md",
  "fluxo-pratico-ia-sema.md",
  "persistencia-vendor-first.md",
  "sintaxe.md",
  "cli.md",
  "integracao-com-ia.md",
  "instalacao-e-primeiro-uso.md",
  "pagamento-ponta-a-ponta.md",
];
const ARQUIVOS_RAIZ_IA_PUBLICOS = [
  "AGENTS.md",
  "llms.txt",
  "llms-full.txt",
  "SEMA_BRIEF.md",
  "SEMA_BRIEF.micro.txt",
  "SEMA_BRIEF.curto.txt",
  "SEMA_INDEX.json",
];

const PACOTES_RUNTIME = [
  "nucleo",
  "padroes",
  "gerador-lua",
  "gerador-typescript",
  "gerador-python",
  "gerador-dart",
  "gerador-javascript",
  "gerador-html",
  "gerador-css",
];

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

async function prepararStageBase() {
  await rm(stageDir, { recursive: true, force: true });
  await mkdir(path.join(stageDir, "dist"), { recursive: true });
  await mkdir(path.join(stageDir, "docs"), { recursive: true });
  await mkdir(path.join(stageDir, "exemplos"), { recursive: true });
  await mkdir(saidaDir, { recursive: true });

  await cp(path.join(origemCli, "dist"), path.join(stageDir, "dist"), { recursive: true });
  await cp(path.join(raiz, "logo.png"), path.join(stageDir, "logo.png"));
  await cp(path.join(raiz, "LICENSE"), path.join(stageDir, "LICENSE"));
  for (const nomeArquivo of ARQUIVOS_RAIZ_IA_PUBLICOS) {
    await cp(path.join(raiz, nomeArquivo), path.join(stageDir, nomeArquivo));
  }
  for (const nomeDoc of DOCS_IA_PUBLICOS) {
    await cp(path.join(raiz, "docs", nomeDoc), path.join(stageDir, "docs", nomeDoc));
  }
  await cp(path.join(raiz, "exemplos"), path.join(stageDir, "exemplos"), { recursive: true });
}

async function prepararPacotesRuntime() {
  const baseNodeModules = path.join(stageDir, "node_modules", "@sema");
  await mkdir(baseNodeModules, { recursive: true });

  for (const pacote of PACOTES_RUNTIME) {
    const origemPacote = path.join(raiz, "pacotes", pacote);
    const destinoPacote = path.join(baseNodeModules, pacote);
    const manifest = JSON.parse(await readFile(path.join(origemPacote, "package.json"), "utf8"));

    await mkdir(destinoPacote, { recursive: true });
    await cp(path.join(origemPacote, "dist"), path.join(destinoPacote, "dist"), { recursive: true });
    await writeFile(
      path.join(destinoPacote, "package.json"),
      `${JSON.stringify({
        name: manifest.name,
        version: manifest.version,
        type: manifest.type,
        main: manifest.main,
        types: manifest.types,
      }, null, 2)}\n`,
      "utf8",
    );
  }
}

async function prepararManifestPublico() {
  const manifestCli = JSON.parse(await readFile(path.join(origemCli, "package.json"), "utf8"));
  const dependenciasOriginais = manifestCli.dependencies ?? {};
  const dependencias = Object.fromEntries(
    Object.entries(dependenciasOriginais).map(([nome, versao]) => [
      nome,
      nome.startsWith("@sema/") ? manifestCli.version : versao,
    ]),
  );
  const dependenciasInternas = Object.keys(dependencias).filter((nome) => nome.startsWith("@sema/"));

  const manifestPublico = {
    name: manifestCli.name,
    version: manifestCli.version,
    description: manifestCli.description,
    type: manifestCli.type,
    icon: manifestCli.icon,
    license: manifestCli.license ?? "MIT",
    repository: manifestCli.repository ?? {
      type: "git",
      url: "https://github.com/gerlanss/Sema.git",
    },
    homepage: manifestCli.homepage ?? "https://github.com/gerlanss/Sema",
    bugs: manifestCli.bugs ?? {
      url: "https://github.com/gerlanss/Sema/issues",
    },
    keywords: manifestCli.keywords ?? [
      "sema",
      "ai",
      "contracts",
      "governance",
      "backend",
      "drift",
      "dsl",
    ],
    engines: manifestCli.engines ?? {
      node: ">=20",
    },
    publishConfig: {
      access: "public",
      ...(manifestCli.publishConfig ?? {}),
    },
    bin: manifestCli.bin,
    main: manifestCli.main,
    types: manifestCli.types,
    files: [
      "dist",
      "docs",
      "exemplos",
      "AGENTS.md",
      "llms.txt",
      "llms-full.txt",
      "SEMA_BRIEF.md",
      "SEMA_BRIEF.micro.txt",
      "SEMA_BRIEF.curto.txt",
      "SEMA_INDEX.json",
      "logo.png",
      "README.md",
      "LICENSE",
    ],
    dependencies: dependencias,
    bundledDependencies: dependenciasInternas,
  };

  await writeFile(path.join(stageDir, "package.json"), `${JSON.stringify(manifestPublico, null, 2)}\n`, "utf8");
}

async function prepararReadmePublico() {
  const manifestCli = JSON.parse(await readFile(path.join(origemCli, "package.json"), "utf8"));
  const tgz = `sema-cli-${manifestCli.version}.tgz`;
  const modelo = await readFile(path.join(origemCli, "README.md"), "utf8");
  const conteudo = modelo.replaceAll("{{TGZ_ARQUIVO}}", tgz);

  await writeFile(path.join(stageDir, "README.md"), conteudo, "utf8");
}

async function main() {
  console.log("Preparando pacote publico da CLI da Sema...");
  await prepararStageBase();
  await prepararPacotesRuntime();
  await prepararManifestPublico();
  await prepararReadmePublico();

  console.log("Empacotando tarball publico...");
  executar("npm", ["pack", "--pack-destination", saidaDir], stageDir);
  console.log(`Pacote publico gerado em ${saidaDir}`);
}

main().catch((erro) => {
  console.error("Falha ao empacotar a CLI publica da Sema.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
