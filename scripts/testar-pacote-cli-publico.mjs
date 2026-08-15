// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: orquestra uma unica instalacao isolada do pacote publico e delega as validacoes por responsabilidade.
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { validarBootstrapCodexInstalado } from "./cli-publico/bootstrap-codex.mjs";
import {
  validarManifestSemDependenciasFile,
  validarReadmePublico,
  validarRuntimeLocalDireto,
} from "./cli-publico/fronteira-publica.mjs";
import { validarPipelineConteudoInstalado } from "./cli-publico/pipeline-conteudo.mjs";
import {
  EXEMPLOS_INTERATIVOS_PUBLICOS,
  validarSistemasInterativosInstalados,
} from "./cli-publico/sistemas-interativos.mjs";
import { validarGeradoresInstalados } from "./cli-publico/toolchains-geradas.mjs";

const raiz = process.cwd();
const pastaPacotes = path.join(raiz, ".tmp", "pacotes-instalador-npm");
const cacheNpm = path.join(raiz, ".tmp", "npm-cache");

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

function executarComSaida(comando, argumentos, cwd) {
  const resultado = spawnSync(comando, argumentos, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (resultado.error) {
    throw resultado.error;
  }
  if (resultado.status !== 0) {
    throw new Error(
      `Command failed (${[comando, ...argumentos].join(" ")}): ${resultado.stderr || resultado.stdout}`,
    );
  }
  return resultado.stdout;
}

function executarJsonCliInstalada(semaBin, argumentos, cwd) {
  return JSON.parse(executarComSaida(
    process.execPath,
    [semaBin, ...argumentos, "--json"],
    cwd,
  ));
}

function validarFronteiraDescoberta(payload, comando) {
  if (
    payload.schemaVersion !== "sema.discovery/v1" ||
    payload.success !== true ||
    payload.executed !== false ||
    payload.workspaceMutated !== false ||
    payload.externalCalls !== false ||
    payload.requiresExplicitRun !== true
  ) {
    throw new Error(`The installed public CLI broke the read-only discovery boundary for ${comando}.`);
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

async function localizarTarball(versaoEsperada) {
  const nomeEsperado = `semacode-cli-${versaoEsperada}.tgz`;
  return await existe(path.join(pastaPacotes, nomeEsperado)) ? nomeEsperado : undefined;
}

async function main() {
  const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
  const versaoEsperada = manifestCli.version;
  const tarball = await localizarTarball(versaoEsperada);
  if (!tarball) {
    throw new Error(`The exact npm package semacode-cli-${versaoEsperada}.tgz is missing. Run \`npm run cli:empacotar-publica\` first.`);
  }

  const caminhoTarball = path.join(pastaPacotes, tarball);
  await validarManifestSemDependenciasFile(caminhoTarball, versaoEsperada, raiz);
  validarRuntimeLocalDireto(caminhoTarball, raiz);

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
    const basePacote = path.join(sandbox, "node_modules", "@semacode", "cli");
    const semaBin = path.join(basePacote, "dist", "index.js");
    const deepImport = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", "await import('@semacode/cli/dist/pipelineConteudo/trust.js')"],
      { cwd: sandbox, encoding: "utf8" },
    );
    if (deepImport.status === 0 || !/ERR_PACKAGE_PATH_NOT_EXPORTED/u.test(deepImport.stderr)) {
      throw new Error(`The installed public CLI did not block the internal pipeline deep import: ${deepImport.stderr}`);
    }
    const ajuda = executarComSaida(process.execPath, [semaBin, "--help"], sandbox);
    if (/\bpreflight\b/i.test(ajuda)) {
      throw new Error("The installed public CLI help still exposes the removed preflight command.");
    }
    for (const comando of ["sema descobrir", "sema pipeline", "sema capabilities", "sema interativo"]) {
      if (!ajuda.includes(comando)) {
        throw new Error(`The installed public CLI help is missing ${comando}.`);
      }
    }
    if (!ajuda.includes("sema conteudo capabilities --json") || !ajuda.includes("sema conteudo status")) {
      throw new Error("The installed public CLI help does not expose the AI-native content pipeline.");
    }

    validarPipelineConteudoInstalado({ semaBin, sandbox, executarComSaida });

    const importRaiz = spawnSync(process.execPath, [
      "--input-type=module",
      "--eval",
      "const api = await import('@semacode/cli'); process.stdout.write(JSON.stringify({ exemplos: typeof api.materializarExemplosOficiais, descoberta: typeof api.montarCatalogoCapacidades, interativo: typeof api.validarDefinicaoSistemaInterativo, ir: typeof api.validarExperienceIr, operacao: typeof api.validarSnapshotEngine, temporal: typeof api.validarContratoTemporalInterativo, autonomia: typeof api.validarCicloReparoAutonomo, portabilidade: typeof api.analisarPlanoPortabilidadeInterativa, extensaoCli: typeof api.executarExtensaoCliInterativa, controlRun: typeof api.validarControlRunInterativo }));",
    ], {
      cwd: sandbox,
      encoding: "utf8",
    });
    if (importRaiz.status !== 0) {
      throw new Error(`The installed public CLI root import failed: ${importRaiz.stderr}`);
    }
    const apiPublica = JSON.parse(importRaiz.stdout);
    if (
      importRaiz.stderr !== "" ||
      apiPublica.exemplos !== "function" ||
      apiPublica.descoberta !== "function" ||
      apiPublica.interativo !== "function" ||
      apiPublica.ir !== "function" ||
      apiPublica.operacao !== "function" ||
      apiPublica.temporal !== "function" ||
      apiPublica.autonomia !== "function" ||
      apiPublica.portabilidade !== "function" ||
      apiPublica.extensaoCli !== "function" ||
      apiPublica.controlRun !== "function"
    ) {
      throw new Error("The installed public CLI root import executed the bin or omitted a public API.");
    }

    const catalogoDescoberta = executarJsonCliInstalada(semaBin, ["descobrir", "catalogo"], sandbox);
    validarFronteiraDescoberta(catalogoDescoberta, "descobrir catalogo");
    if (
      catalogoDescoberta.mode !== "catalog" ||
      !catalogoDescoberta.entries?.some((item) => item.id === "simulation.calibrate")
    ) {
      throw new Error("The installed public CLI discovery catalog omitted simulation.calibrate.");
    }

    const recomendacaoDescoberta = executarJsonCliInstalada(
      semaBin,
      ["descobrir", "recomendar", "--intencao", "simulador 3D autônomo calibrado"],
      sandbox,
    );
    validarFronteiraDescoberta(recomendacaoDescoberta, "descobrir recomendar");
    if (
      recomendacaoDescoberta.mode !== "ranking" ||
      recomendacaoDescoberta.noMatch !== false ||
      recomendacaoDescoberta.recommendations?.[0]?.id !== "simulation.calibrate"
    ) {
      throw new Error("The installed public CLI did not recommend the calibrated simulation pipeline.");
    }

    const pipelinesDescoberta = executarJsonCliInstalada(semaBin, ["pipeline", "listar"], sandbox);
    validarFronteiraDescoberta(pipelinesDescoberta, "pipeline listar");
    if (
      !pipelinesDescoberta.entries?.some((item) => item.id === "simulation.calibrate") ||
      !pipelinesDescoberta.entries?.every((item) => item.kind === "ORCHESTRATION_PIPELINE")
    ) {
      throw new Error("The installed public CLI pipeline alias returned an invalid catalog.");
    }

    const capabilitiesDescoberta = executarJsonCliInstalada(semaBin, ["capabilities"], sandbox);
    validarFronteiraDescoberta(capabilitiesDescoberta, "capabilities");
    if (
      capabilitiesDescoberta.mode !== "catalog" ||
      capabilitiesDescoberta.entries?.map((item) => item.id).join("\n") !==
        catalogoDescoberta.entries?.map((item) => item.id).join("\n")
    ) {
      throw new Error("The installed public CLI capabilities alias diverged from the discovery catalog.");
    }

    const versao = executarComSaida(process.execPath, [semaBin, "--version"], sandbox).trim();
    if (versao !== versaoEsperada) {
      throw new Error(`The installed public CLI returned ${versao}; expected ${versaoEsperada}.`);
    }

    const preflightRemovido = spawnSync(process.execPath, [semaBin, "preflight", "resumo", "--json"], {
      cwd: sandbox,
      encoding: "utf8",
    });
    if (preflightRemovido.status === 0) {
      throw new Error("The installed public CLI still executes the removed preflight command.");
    }

    const projetoCodex = await validarBootstrapCodexInstalado({
      semaBin,
      sandbox,
      executarComSaida,
      existe,
      exemplosInterativosPublicos: EXEMPLOS_INTERATIVOS_PUBLICOS,
    });

    const resumoSaida = executarComSaida(
      process.execPath,
      [semaBin, "resumo", path.join(raiz, "exemplos", "calculadora.sema"), "--micro", "--json"],
      sandbox,
    );
    const resumo = JSON.parse(resumoSaida);
    if (resumo.comando !== "resumo" || resumo.modulo !== "exemplos.calculadora") {
      throw new Error("The installed public CLI did not execute resumo directly against a local contract.");
    }

    executar(process.execPath, [semaBin, "validar", path.join(raiz, "exemplos", "calculadora.sema"), "--json"], sandbox);
    validarReadmePublico(await readFile(path.join(basePacote, "README.md"), "utf8"));
    await validarGeradoresInstalados({ semaBin, basePacote, sandbox, executarComSaida });

    for (const arquivoDoc of [
      "docs/cli.md",
      "docs/commands.md",
      "docs/descoberta-capacidades.md",
      "docs/documentation.md",
      "docs/pipeline-conteudo.md",
      "docs/security.md",
      "docs/sistemas-interativos.md",
      "docs/support.md",
    ]) {
      if (!(await existe(path.join(basePacote, arquivoDoc)))) {
        throw new Error(`The public package did not include ${arquivoDoc}.`);
      }
    }

    for (const arquivoExemplo of [
      "exemplos/profile_simulation.sema",
      ...EXEMPLOS_INTERATIVOS_PUBLICOS,
    ]) {
      if (!(await existe(path.join(basePacote, arquivoExemplo)))) {
        throw new Error(`The public package did not include ${arquivoExemplo}.`);
      }
    }

    await validarSistemasInterativosInstalados({
      semaBin,
      sandbox,
      projetoCodex,
      executarJsonCliInstalada,
    });

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
      ["simulation", "profile_simulation.sema"],
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

    const manifestInstalado = JSON.parse(await readFile(path.join(basePacote, "package.json"), "utf8"));
    for (const [nome, versaoDeclarada] of Object.entries(manifestInstalado.dependencies ?? {}).filter(([nome]) => nome.startsWith("@sema/"))) {
      const relativo = nome.slice("@sema/".length);
      const aninhado = path.join(pacotesInternosAninhados, relativo, "package.json");
      const hoistado = path.join(pacotesInternosHoistados, relativo, "package.json");
      const caminhoManifesto = await existe(aninhado) ? aninhado : hoistado;
      const bundled = JSON.parse(await readFile(caminhoManifesto, "utf8"));
      if (bundled.version !== versaoDeclarada) {
        throw new Error(`Installed bundled dependency ${nome} is ${bundled.version}; manifest declares ${versaoDeclarada}.`);
      }
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
}

main().catch((erro) => {
  console.error("Failed to validate the public local-only Sema CLI package.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
