// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: empacota a CLI local publica sem artefatos privados do workspace.
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const raiz = process.cwd();
const stageDir = path.join(raiz, ".tmp", "cli-npm-stage");
const saidaDir = path.join(raiz, ".tmp", "pacotes-instalador-npm");
const cacheNpm = path.join(raiz, ".tmp", "npm-cache");
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
  "descoberta-capacidades.md",
  "deploy.md",
  "documentation.md",
  "env.md",
  "frontend.md",
  "getting-started.md",
  "i18n.md",
  "pipeline-conteudo.md",
  "profiles.md",
  "repositories.md",
  "rollback.md",
  "security.md",
  "sistemas-interativos.md",
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
  "gerador-php",
  "gerador-dotnet",
  "gerador-cpp",
];

const DIST_NAO_PUBLICAVEL = [
  /(?:^|[/\\])[^/\\]*\.(?:map|pem|key|p12|pfx)$/i,
  /(?:^|[/\\])\.env(?:\.|$)/i,
  /(?:^|[/\\])billing(?:[/\\]|\.|$)/i,
];

const MARCADORES_PORTEIRO_LEGADO = [
  { regex: /\bpreflight\b/i, motivo: "terminologia preflight legada" },
  { regex: /\bsema\s+preflight\b/i, motivo: "comando de autorizacao legado" },
  { regex: /\b(?:comando|executar)PreflightCli\b/, motivo: "handler de autorizacao legado" },
  { regex: /\buse_cli_local\b/, motivo: "decisao de autorizacao legada" },
  { regex: /\borigemCobranca\b/, motivo: "marcador de billing legado" },
  { regex: /\boperationCode\b/, motivo: "codigo de operacao do porteiro legado" },
];

const MARCADOR_NOME_TOOL_MCP_LEGADO = /\bsema_(?:docs_impacto|finalizar_mudanca|inspecionar|drift|impacto|exemplos)\b/i;
const MARCADOR_MOJIBAKE_VISIVEL = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|Ã¢Å¡|Ã¯Â¸/u;
const ARQUIVO_RUNTIME_VISIVEL = /^dist\/(?:(?:discovery|sistemasInterativos)\/[^/]+|(?:agentContext|agentContextPack|agentContextTipos|agentEntryPoints|doctorCommand|docs\.part01|exemplosOficiais|fsGovernado|index\.part0[1-8]|initCommand|initTemplatesBase|workspaceWrite))\.(?:js|d\.ts|json)$/i;

function removerDetectorMigracaoLegada(arquivo, conteudo) {
  if (!/^dist\/agentEntryPoints\.js$/i.test(arquivo)) {
    return conteudo;
  }
  return conteudo.replace(
    /function contemVestigioSemaLegado\([^)]*\) \{[\s\S]*?\n\}/u,
    "",
  );
}

function executar(comando, argumentos, cwd) {
  if (process.platform === "win32" && (comando === "npm" || comando === "npx")) {
    const argumentosIsolados = [...argumentos, "--cache", cacheNpm];
    const cliLocal = path.join(
      path.dirname(process.execPath),
      "node_modules",
      "npm",
      "bin",
      `${comando}-cli.js`,
    );
    if (existsSync(cliLocal)) {
      execFileSync(process.execPath, [cliLocal, ...argumentosIsolados], { cwd, stdio: "inherit" });
      return;
    }
    execFileSync("powershell", ["-NoProfile", "-Command", [comando, ...argumentosIsolados].join(" ")], {
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
  await validarDistLocalDireto();
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
      await rm(caminho, { recursive: true, force: true });
      return;
    }
    if ((await stat(caminho)).isDirectory()) {
      await removerArquivosNaoPublicaveis(caminho);
    }
  }));
}

async function validarDistLocalDireto(dir = path.join(stageDir, "dist")) {
  const entradas = await readdir(dir, { withFileTypes: true });
  for (const entrada of entradas) {
    const caminho = path.join(dir, entrada.name);
    const relativo = path.relative(stageDir, caminho).replaceAll(path.sep, "/");
    if (/(?:^|\/)billing(?:\/|\.|$)/i.test(relativo)) {
      throw new Error(`Public package stage still contains removed billing artifact: ${relativo}`);
    }
    if (entrada.isDirectory()) {
      await validarDistLocalDireto(caminho);
      continue;
    }
    if (!/\.(?:js|d\.ts|json)$/i.test(entrada.name)) {
      continue;
    }
    const conteudo = removerDetectorMigracaoLegada(relativo, await readFile(caminho, "utf8"));
    const marcador = MARCADORES_PORTEIRO_LEGADO.find(({ regex }) => regex.test(conteudo));
    if (marcador) {
      throw new Error(`Public package stage contains ${marcador.motivo} in ${relativo}.`);
    }
    if (MARCADOR_NOME_TOOL_MCP_LEGADO.test(conteudo)) {
      throw new Error(`Public package stage contains a legacy Sema MCP tool name in ${relativo}.`);
    }
    if (ARQUIVO_RUNTIME_VISIVEL.test(relativo) && MARCADOR_MOJIBAKE_VISIVEL.test(conteudo)) {
      throw new Error(`Public package stage contains visible mojibake in ${relativo}.`);
    }
  }
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
  const versoesRuntime = new Map(await Promise.all(PACOTES_RUNTIME.map(async (pacote) => {
    const manifest = JSON.parse(await readFile(path.join(raiz, "pacotes", pacote, "package.json"), "utf8"));
    return [manifest.name, manifest.version];
  })));
  const dependenciasOriginais = manifestCli.dependencies ?? {};
  const dependencias = Object.fromEntries(
    Object.entries(dependenciasOriginais).map(([nome, versao]) => [
      nome,
      nome.startsWith("@sema/") ? versoesRuntime.get(nome) : versao,
    ]),
  );
  for (const [nome, versao] of Object.entries(dependencias).filter(([nome]) => nome.startsWith("@sema/"))) {
    if (!versao) {
      throw new Error(`Missing runtime package version for ${nome}.`);
    }
  }
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
    exports: manifestCli.exports,
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

  const manifest = JSON.parse(await readFile(path.join(stageDir, "package.json"), "utf8"));
  const readme = await readFile(path.join(stageDir, "README.md"), "utf8");
  const license = await readFile(path.join(stageDir, "LICENSE"), "utf8");
  const caminhoPacote = path.join(saidaDir, `semacode-cli-${manifest.version}.tgz`);
  await access(caminhoPacote);
  const dependenciasFileRemovidas = Object.values(manifest.dependencies ?? {})
    .every((versao) => typeof versao !== "string" || !versao.startsWith("file:"));
  const resultado = {
    pacote_gerado: true,
    dependencias_file_removidas: dependenciasFileRemovidas,
    metadados_suporte_email: manifest.bugs?.email === "suporte@otimitare.online" && readme.includes("suporte@otimitare.online"),
    licenca_nao_comercial_incluida: license.includes("commercial replica") && license.includes("resale permission"),
    produto_codex_native: String(manifest.description ?? "").includes("Codex-native") && readme.includes("AGENTS.md"),
    cli_sem_autorizacao_local: true,
  };
  if (Object.values(resultado).some((valor) => valor !== true)) {
    throw new Error(`Public package evidence failed: ${JSON.stringify(resultado)}`);
  }
  return resultado;
}

main().then((resultado) => {
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(resultado, null, 2));
  }
}).catch((erro) => {
  console.error("Failed to package the public local-only Sema CLI.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});

export { main };
