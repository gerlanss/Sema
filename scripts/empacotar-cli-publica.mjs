// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: empacota a CLI local publica sem artefatos privados do workspace.
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const raiz = process.cwd();
const stageDir = path.join(raiz, ".tmp", "cli-npm-stage");
const saidaDir = path.join(raiz, ".tmp", "pacotes-instalador-npm");
const origemCli = path.join(raiz, "pacotes", "cli");

const DOCS_PUBLICOS = [
  "README.md",
  "ai-integration.md",
  "ai-onboarding.md",
  "ai-workflow.md",
  "auth.md",
  "cli.md",
  "commands.md",
  "database.md",
  "deploy.md",
  "documentation.md",
  "env.md",
  "frontend.md",
  "getting-started.md",
  "i18n.md",
  "profiles.md",
  "repositories.md",
  "rollback.md",
  "security.md",
  "support.md",
  "syntax.md",
  "testing.md",
  "vocabulary.md",
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

const DIST_NAO_PUBLICAVEL = [
  /(?:^|[/\\])[^/\\]*\.(?:map|pem|key|p12|pfx)$/i,
  /(?:^|[/\\])\.env(?:\.|$)/i,
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
  await removerDistNaoPublicavel();
  await cp(path.join(raiz, "logo.png"), path.join(stageDir, "logo.png"));
  await cp(path.join(raiz, "LICENSE"), path.join(stageDir, "LICENSE"));

  for (const nomeDoc of DOCS_PUBLICOS) {
    await cp(path.join(raiz, "docs", nomeDoc), path.join(stageDir, "docs", nomeDoc));
  }

  await cp(path.join(raiz, "exemplos"), path.join(stageDir, "exemplos"), { recursive: true });
}

async function removerDistNaoPublicavel() {
  await removerArquivosNaoPublicaveis(path.join(stageDir, "dist"));
}

async function removerArquivosNaoPublicaveis(dir) {
  const arquivos = await readdir(dir);
  await Promise.all(arquivos.map(async (arquivo) => {
    const caminho = path.join(dir, arquivo);
    const relativo = path.relative(stageDir, caminho).replaceAll(path.sep, "/");
    if (DIST_NAO_PUBLICAVEL.some((padrao) => padrao.test(relativo))) {
      await rm(caminho, { force: true });
      return;
    }
    if ((await stat(caminho)).isDirectory()) {
      await removerArquivosNaoPublicaveis(caminho);
    }
  }));
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
    license: manifestCli.license ?? "SEE LICENSE IN LICENSE",
    repository: manifestCli.repository,
    homepage: manifestCli.homepage ?? "https://otimitare.online",
    bugs: manifestCli.bugs ?? {
      url: "https://otimitare.online",
      email: "suporte@otimitare.online",
    },
    keywords: manifestCli.keywords ?? [
      "sema",
      "ai",
      "contracts",
      "governance",
      "local-cli",
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
  const tgz = `semacode-cli-${manifestCli.version}.tgz`;
  const modelo = await readFile(path.join(origemCli, "README.md"), "utf8");
  const conteudo = modelo.replaceAll("{{TGZ_ARQUIVO}}", tgz);

  await writeFile(path.join(stageDir, "README.md"), conteudo, "utf8");
}

async function main() {
  console.log("Preparing the public local-only Sema CLI package...");
  await prepararStageBase();
  await prepararPacotesRuntime();
  await prepararManifestPublico();
  await prepararReadmePublico();

  console.log("Packing the CLI tarball...");
  executar("npm", ["pack", "--pack-destination", saidaDir], stageDir);
  console.log(`CLI package generated in ${saidaDir}`);
}

main().catch((erro) => {
  console.error("Failed to package the public local-only Sema CLI.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
