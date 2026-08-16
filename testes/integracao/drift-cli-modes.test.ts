// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.modos, sema.produto.governanca_ia.drift.cache.store
// Descrição: prova os envelopes públicos e os efeitos persistentes dos modos de drift da CLI.

import assert from "node:assert/strict";
import { execFile, type ExecFileException } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extrairPayloadResultadoCliV1 } from "../helpers/resultado-cli-v1.ts";

type ModoCacheDriftPublico = "none" | "cache" | "fresh";

interface EstadoCachePublico {
  modo: ModoCacheDriftPublico;
  origem: "nao_aplicavel" | "calculado" | "cache" | "indisponivel";
  schema: "sema.drift-cache/v3";
  metricas: {
    hits: number;
    misses: number;
    corruptos: number;
    gravacoes: number;
    errosGravacao: number;
  };
}

interface AnaliseDriftPublica {
  modo: ModoCacheDriftPublico;
  executada: boolean;
  sucesso: boolean | null;
  cache: EstadoCachePublico | null;
}

interface PayloadResumoCli {
  comando: "resumo";
  analiseDrift: AnaliseDriftPublica;
  resumo: ResumoModuloPublico;
}

interface ResumoModuloPublico {
  modoVerificacaoCodigo: "codigo_completo" | "codigo_selecionado" | "contratos_apenas";
  scoreSemantico: number | null;
  confiancaGeral: string | null;
  consumerFramework: string | null;
  appRoutes: string[] | null;
  consumerSurfaces: string[] | null;
  consumerBridges: string[] | null;
  ancoragensVinculo: string[] | null;
}

interface PayloadResumoProjetoCli {
  comando: "resumo";
  analiseDrift: AnaliseDriftPublica;
  modulos: ResumoModuloPublico[];
  texto: string;
}

interface PayloadInspecionarCli {
  comando: "inspecionar";
  configuracao: {
    analiseDrift: AnaliseDriftPublica;
    scoreDrift: number | null;
    confiancaGeral: string | null;
    fontesLegado: string[];
  };
  projeto: {
    modulos: Array<{ implementacao: unknown | null }>;
  };
}

interface PayloadDriftCli {
  sucesso: boolean;
  escopo_aplicado: {
    cache: EstadoCachePublico | null;
  };
  resumo_operacional: {
    scoreMedio: number;
    confiancaGeral: string;
  };
}

interface ExecucaoCli {
  codigo: number;
  stdout: string;
  stderr: string;
}

interface SandboxCli {
  raiz: string;
  contratoRelativo: string;
}

interface OpcoesSandboxCli {
  declararDescobertaCodigo?: boolean;
}

const CLI_COMPILADA = fileURLToPath(new URL("../../pacotes/cli/dist/bin.js", import.meta.url));

async function criarSandboxCli(base: string, opcoes: OpcoesSandboxCli = {}): Promise<SandboxCli> {
  const raiz = path.join(base, "workspace");
  await mkdir(path.join(raiz, "contratos"), { recursive: true });
  await mkdir(path.join(raiz, "src"), { recursive: true });
  const descobertaDeclarada = opcoes.declararDescobertaCodigo !== false;
  await writeFile(path.join(raiz, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    ...(descobertaDeclarada ? {
      diretoriosCodigo: ["./src"],
      fontesLegado: ["typescript"],
    } : {}),
    pontuacaoSemanticaMinimaOperacional: 0,
    pontuacaoSemanticaAlvo: 0,
    pontuacaoSemanticaAlvoFinal: 0,
  }, null, 2), "utf8");
  await writeFile(path.join(raiz, "contratos", "cache-cli.sema"), `module app.cache_cli {
  vinculos { arquivo: "src/service.ts" }
  task executar {
    input { valor: Texto required }
    output { ok: Booleano }
    impl { ts: service.executar }
    guarantees { ok existe }
  }
}
`, "utf8");
  await writeFile(path.join(raiz, "src", "service.ts"), [
    "// SEMA-GOVERNED: app.cache_cli",
    "// Descrição: implementação mínima para a regressão pública de cache da CLI.",
    "export function executar(valor: string) { return { ok: valor.length > 0 }; }",
    "",
  ].join("\n"), "utf8");
  return { raiz, contratoRelativo: "contratos/cache-cli.sema" };
}

function ambienteCacheIsolado(raizCache: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: raizCache,
    USERPROFILE: raizCache,
    LOCALAPPDATA: raizCache,
    XDG_CACHE_HOME: raizCache,
  };
}

async function executarCli(
  sandbox: SandboxCli,
  argumentos: readonly string[],
  raizCache: string,
  ambienteExtra: NodeJS.ProcessEnv = {},
): Promise<ExecucaoCli> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI_COMPILADA, ...argumentos],
      {
        cwd: sandbox.raiz,
        encoding: "utf8",
        env: { ...ambienteCacheIsolado(raizCache), ...ambienteExtra },
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
      (erro: ExecFileException | null, stdout: string, stderr: string) => {
        resolve({
          codigo: erro === null ? 0 : (typeof erro.code === "number" ? erro.code : 1),
          stdout,
          stderr,
        });
      },
    );
  });
}

async function executarJson<T>(
  sandbox: SandboxCli,
  argumentos: readonly string[],
  raizCache: string,
  ambienteExtra: NodeJS.ProcessEnv = {},
): Promise<T> {
  const execucao = await executarCli(sandbox, argumentos, raizCache, ambienteExtra);
  assert.equal(
    execucao.codigo,
    0,
    `CLI compilada falhou.\nSTDOUT:\n${execucao.stdout}\nSTDERR:\n${execucao.stderr}`,
  );
  return extrairPayloadResultadoCliV1<T>(execucao.stdout, {
    command: argumentos[0] ?? "",
    exitCode: execucao.codigo,
  });
}

async function assertCaminhoAusente(caminho: string): Promise<void> {
  await assert.rejects(
    stat(caminho),
    (erro: unknown) => (erro as NodeJS.ErrnoException).code === "ENOENT",
  );
}

async function criarObservadorIoCodigo(
  base: string,
  diretorioArmadilha: string,
  arquivoEventos: string,
): Promise<NodeJS.ProcessEnv> {
  const arquivoHook = path.join(base, "observar-io-codigo.cjs");
  await writeFile(arquivoHook, [
    '"use strict";',
    'const fs = require("node:fs");',
    'const fsp = require("node:fs/promises");',
    'const path = require("node:path");',
    'const armadilha = path.resolve(process.env.SEMA_TEST_IO_TRAP);',
    'const eventos = path.resolve(process.env.SEMA_TEST_IO_LOG);',
    'const dentro = (alvo) => {',
    '  const absoluto = path.resolve(String(alvo));',
    '  const relativo = path.relative(armadilha, absoluto);',
    '  return relativo === "" || (relativo !== ".." && !relativo.startsWith(`..${path.sep}`) && !path.isAbsolute(relativo));',
    '};',
    'for (const metodo of ["readdir", "readFile", "open"]) {',
    '  const original = fsp[metodo].bind(fsp);',
    '  const observado = async (alvo, ...args) => {',
    '    if (dentro(alvo)) fs.appendFileSync(eventos, `${metodo}\n`, "utf8");',
    '    return original(alvo, ...args);',
    '  };',
    '  fsp[metodo] = observado;',
    '  fs.promises[metodo] = observado;',
    '}',
    'for (const metodo of ["readdirSync", "readFileSync", "openSync"]) {',
    '  const original = fs[metodo].bind(fs);',
    '  fs[metodo] = (alvo, ...args) => {',
    '    if (dentro(alvo)) fs.appendFileSync(eventos, `${metodo}\n`, "utf8");',
    '    return original(alvo, ...args);',
    '  };',
    '}',
    '',
  ].join("\n"), "utf8");
  const requireHook = `--require=${JSON.stringify(arquivoHook.replace(/\\/g, "/"))}`;
  return {
    NODE_OPTIONS: [process.env.NODE_OPTIONS, requireHook].filter(Boolean).join(" "),
    SEMA_TEST_IO_TRAP: diretorioArmadilha,
    SEMA_TEST_IO_LOG: arquivoEventos,
  };
}

function assertConsultaSemDrift(
  payload: PayloadResumoCli | PayloadInspecionarCli,
): void {
  const analise = payload.comando === "resumo"
    ? payload.analiseDrift
    : payload.configuracao.analiseDrift;
  assert.equal(analise.modo, "none");
  assert.equal(analise.executada, false);
  assert.equal(analise.sucesso, null);
  assert.equal(analise.cache, null);

  if (payload.comando === "resumo") {
    assert.equal(payload.resumo.modoVerificacaoCodigo, "contratos_apenas");
    assert.equal(payload.resumo.scoreSemantico, null);
    assert.equal(payload.resumo.confiancaGeral, null);
    assert.equal(payload.resumo.consumerFramework, null);
    assert.equal(payload.resumo.appRoutes, null);
    assert.equal(payload.resumo.consumerSurfaces, null);
    assert.equal(payload.resumo.consumerBridges, null);
    assert.equal(payload.resumo.ancoragensVinculo, null);
    return;
  }

  assert.equal(payload.configuracao.scoreDrift, null);
  assert.equal(payload.configuracao.confiancaGeral, null);
  assert.ok(payload.projeto.modulos.length > 0);
  assert.equal(payload.projeto.modulos.every((modulo) => modulo.implementacao === null), true);
}

test("resumo e inspecionar não analisam nem criam cache por padrão ou com --drift none", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cli-none-"));
  try {
    const sandbox = await criarSandboxCli(base);
    const casos = [
      { comando: "resumo" as const, argumentos: ["resumo", sandbox.contratoRelativo, "--json"] },
      { comando: "resumo" as const, argumentos: ["resumo", sandbox.contratoRelativo, "--drift", "none", "--json"] },
      { comando: "inspecionar" as const, argumentos: ["inspecionar", sandbox.contratoRelativo, "--json"] },
      { comando: "inspecionar" as const, argumentos: ["inspecionar", sandbox.contratoRelativo, "--drift", "none", "--json"] },
    ];

    for (const [indice, caso] of casos.entries()) {
      const raizCache = path.join(base, `cache-ausente-${indice}`);
      const arquivoEventos = path.join(base, `io-arquivo-none-${indice}.log`);
      const ambienteIo = await criarObservadorIoCodigo(
        base,
        path.join(sandbox.raiz, "src"),
        arquivoEventos,
      );
      const payload = caso.comando === "resumo"
        ? await executarJson<PayloadResumoCli>(sandbox, caso.argumentos, raizCache, ambienteIo)
        : await executarJson<PayloadInspecionarCli>(sandbox, caso.argumentos, raizCache, ambienteIo);
      assertConsultaSemDrift(payload);
      await assertCaminhoAusente(arquivoEventos);
      await assertCaminhoAusente(raizCache);
    }

    const resumoHumano = await executarCli(sandbox, [
      "resumo",
      sandbox.contratoRelativo,
      "--micro",
      "--drift",
      "none",
    ], path.join(base, "cache-ausente-texto"));
    assert.equal(resumoHumano.codigo, 0, resumoHumano.stderr);
    assert.match(resumoHumano.stdout, /CONSUMER_FRAMEWORK: não avaliado/);
    assert.match(resumoHumano.stdout, /APP_ROUTES: não avaliado/);
    assert.match(resumoHumano.stdout, /CONSUMER_SURFACES: não avaliado/);
    assert.match(resumoHumano.stdout, /CONSUMER_BRIDGES: não avaliado/);
    assert.doesNotMatch(resumoHumano.stdout, /CONSUMER_FRAMEWORK: nenhum/);
    await assertCaminhoAusente(path.join(base, "cache-ausente-texto"));

    const resumoHumanoCurto = await executarCli(sandbox, [
      "resumo",
      sandbox.contratoRelativo,
      "--curto",
      "--drift",
      "none",
    ], path.join(base, "cache-ausente-curto"));
    assert.equal(resumoHumanoCurto.codigo, 0, resumoHumanoCurto.stderr);
    assert.match(resumoHumanoCurto.stdout, /CONFIANCA: não avaliada/);
    assert.match(resumoHumanoCurto.stdout, /SCORE: não avaliado/);
    await assertCaminhoAusente(path.join(base, "cache-ausente-curto"));

    const inspecaoHumana = await executarCli(sandbox, [
      "inspecionar",
      sandbox.contratoRelativo,
      "--drift",
      "none",
    ], path.join(base, "cache-ausente-inspecao-texto"));
    assert.equal(inspecaoHumana.codigo, 0, inspecaoHumana.stderr);
    assert.match(inspecaoHumana.stdout, /Resultado do drift: não avaliado/u);
    assert.match(inspecaoHumana.stdout, /Score médio de drift: não avaliado/u);
    assert.match(inspecaoHumana.stdout, /Confiança geral: não avaliada/u);
    await assertCaminhoAusente(path.join(base, "cache-ausente-inspecao-texto"));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("consultas none com alvo projeto não caminham nem leem código", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cli-project-none-"));
  try {
    const sandbox = await criarSandboxCli(base, { declararDescobertaCodigo: false });
    const armadilha = path.join(sandbox.raiz, "armadilha");
    const sentinela = "SENTINELA_CODIGO_NAO_LIDO_NO_DRIFT_NONE";
    await mkdir(armadilha, { recursive: true });
    await writeFile(path.join(armadilha, "segredo.ts"), `export const segredo = "${sentinela}";\n`, "utf8");

    const eventosResumoNone = path.join(base, "io-resumo-projeto-none.log");
    const resumoNone = await executarJson<PayloadResumoProjetoCli>(
      sandbox,
      ["resumo", ".", "--curto", "--drift", "none", "--json"],
      path.join(base, "cache-resumo-projeto-none"),
      await criarObservadorIoCodigo(base, armadilha, eventosResumoNone),
    );
    assert.equal(resumoNone.analiseDrift.modo, "none");
    assert.equal(resumoNone.analiseDrift.executada, false);
    assert.equal(resumoNone.analiseDrift.sucesso, null);
    assert.equal(resumoNone.analiseDrift.cache, null);
    assert.equal(resumoNone.modulos.length > 0, true);
    assert.equal(resumoNone.modulos.every((modulo) => modulo.modoVerificacaoCodigo === "contratos_apenas"), true);
    assert.equal(resumoNone.modulos.every((modulo) => modulo.scoreSemantico === null), true);
    assert.equal(resumoNone.modulos.every((modulo) => modulo.confiancaGeral === null), true);
    assert.match(resumoNone.texto, /RESULTADO_DRIFT: não avaliado/u);
    assert.equal(resumoNone.texto.includes(sentinela), false);
    await assertCaminhoAusente(eventosResumoNone);
    await assertCaminhoAusente(path.join(base, "cache-resumo-projeto-none"));

    const eventosInspecionarNone = path.join(base, "io-inspecionar-projeto-none.log");
    const inspecionarNone = await executarJson<PayloadInspecionarCli>(
      sandbox,
      ["inspecionar", ".", "--drift", "none", "--json"],
      path.join(base, "cache-inspecionar-projeto-none"),
      await criarObservadorIoCodigo(base, armadilha, eventosInspecionarNone),
    );
    assertConsultaSemDrift(inspecionarNone);
    assert.deepEqual(inspecionarNone.configuracao.fontesLegado, []);
    assert.equal(JSON.stringify(inspecionarNone).includes(sentinela), false);
    await assertCaminhoAusente(eventosInspecionarNone);
    await assertCaminhoAusente(path.join(base, "cache-inspecionar-projeto-none"));

    const raizCacheResumoProjeto = path.join(base, "cache-resumo-projeto-executado");
    const eventosResumoFresh = path.join(base, "io-resumo-projeto-fresh.log");
    const resumoFresh = await executarJson<PayloadResumoProjetoCli>(
      sandbox,
      ["resumo", ".", "--drift", "fresh", "--json"],
      raizCacheResumoProjeto,
      await criarObservadorIoCodigo(base, armadilha, eventosResumoFresh),
    );
    assert.equal(resumoFresh.analiseDrift.executada, true);
    assert.equal(resumoFresh.analiseDrift.sucesso, true);
    assert.equal(resumoFresh.analiseDrift.cache?.modo, "fresh");
    assert.match(await readFile(eventosResumoFresh, "utf8"), /readdir|readFile|open/u);

    const eventosResumoCache = path.join(base, "io-resumo-projeto-cache.log");
    const resumoCache = await executarJson<PayloadResumoProjetoCli>(
      sandbox,
      ["resumo", ".", "--drift", "cache", "--json"],
      raizCacheResumoProjeto,
      await criarObservadorIoCodigo(base, armadilha, eventosResumoCache),
    );
    assert.equal(resumoCache.analiseDrift.modo, "cache");
    assert.equal(resumoCache.analiseDrift.executada, true);
    assert.equal(resumoCache.analiseDrift.sucesso, true);
    assert.equal(resumoCache.analiseDrift.cache?.modo, "cache");
    assert.match(await readFile(eventosResumoCache, "utf8"), /readdir|readFile|open/u);

    const raizCacheInspecionarProjeto = path.join(base, "cache-inspecionar-projeto-executado");
    const eventosInspecionarFresh = path.join(base, "io-inspecionar-projeto-fresh.log");
    const inspecionarFresh = await executarJson<PayloadInspecionarCli>(
      sandbox,
      ["inspecionar", ".", "--drift", "fresh", "--json"],
      raizCacheInspecionarProjeto,
      await criarObservadorIoCodigo(base, armadilha, eventosInspecionarFresh),
    );
    assert.equal(inspecionarFresh.configuracao.analiseDrift.executada, true);
    assert.equal(inspecionarFresh.configuracao.analiseDrift.sucesso, true);
    assert.equal(inspecionarFresh.configuracao.fontesLegado.includes("typescript"), true);
    assert.match(await readFile(eventosInspecionarFresh, "utf8"), /readdir|readFile|open/u);

    const eventosInspecionarCache = path.join(base, "io-inspecionar-projeto-cache.log");
    const inspecionarCache = await executarJson<PayloadInspecionarCli>(
      sandbox,
      ["inspecionar", ".", "--drift", "cache", "--json"],
      raizCacheInspecionarProjeto,
      await criarObservadorIoCodigo(base, armadilha, eventosInspecionarCache),
    );
    assert.equal(inspecionarCache.configuracao.analiseDrift.modo, "cache");
    assert.equal(inspecionarCache.configuracao.analiseDrift.executada, true);
    assert.equal(inspecionarCache.configuracao.analiseDrift.sucesso, true);
    assert.equal(inspecionarCache.configuracao.analiseDrift.cache?.modo, "cache");
    assert.equal(inspecionarCache.configuracao.fontesLegado.includes("typescript"), true);
    assert.match(await readFile(eventosInspecionarCache, "utf8"), /readdir|readFile|open/u);

    for (const comando of ["resumo", "inspecionar"] as const) {
      const raizCacheArquivo = path.join(base, `cache-${comando}-arquivo-executado`);
      for (const modo of ["none", "fresh", "cache"] as const) {
        const arquivoEventos = path.join(base, `io-${comando}-arquivo-${modo}.log`);
        const argumentos = [comando, sandbox.contratoRelativo, "--drift", modo, "--json"];
        const arquivo = comando === "resumo"
          ? await executarJson<PayloadResumoCli>(
            sandbox,
            argumentos,
            modo === "none" ? path.join(base, `cache-${comando}-arquivo-none`) : raizCacheArquivo,
            await criarObservadorIoCodigo(base, armadilha, arquivoEventos),
          )
          : await executarJson<PayloadInspecionarCli>(
            sandbox,
            argumentos,
            modo === "none" ? path.join(base, `cache-${comando}-arquivo-none`) : raizCacheArquivo,
            await criarObservadorIoCodigo(base, armadilha, arquivoEventos),
          );
        const analise = arquivo.comando === "resumo"
          ? arquivo.analiseDrift
          : arquivo.configuracao.analiseDrift;
        assert.equal(analise.modo, modo);
        assert.equal(analise.executada, modo !== "none");
        assert.equal(analise.sucesso, modo === "none" ? null : true);
        if (modo === "cache") {
          assert.equal(analise.cache?.origem, "cache");
        }
        if (arquivo.comando === "inspecionar") {
          assert.deepEqual(arquivo.configuracao.fontesLegado, []);
        }
        await assertCaminhoAusente(arquivoEventos);
      }
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("diretório com sufixo .sema continua sendo projeto e usa descoberta completa quando solicitada", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cli-directory-suffix-"));
  try {
    const sandbox = await criarSandboxCli(base, { declararDescobertaCodigo: false });
    const diretorioRelativo = "recorte.sema";
    const diretorioAlvo = path.join(sandbox.raiz, diretorioRelativo);
    await mkdir(diretorioAlvo, { recursive: true });
    await writeFile(
      path.join(diretorioAlvo, "alvo.sema"),
      await readFile(path.join(sandbox.raiz, sandbox.contratoRelativo), "utf8"),
      "utf8",
    );

    const eventosNone = path.join(base, "io-diretorio-sufixo-none.log");
    const resumo = await executarJson<PayloadResumoProjetoCli>(
      sandbox,
      ["resumo", diretorioRelativo, "--drift", "none", "--json"],
      path.join(base, "cache-diretorio-sufixo-none"),
      await criarObservadorIoCodigo(base, path.join(sandbox.raiz, "src"), eventosNone),
    );
    assert.equal(resumo.analiseDrift.executada, false);
    assert.equal(resumo.modulos.length, 1);
    assert.match(resumo.texto, /RESULTADO_DRIFT: não avaliado/u);
    await assertCaminhoAusente(eventosNone);
    await assertCaminhoAusente(path.join(base, "cache-diretorio-sufixo-none"));

    const inspecao = await executarJson<PayloadInspecionarCli>(
      sandbox,
      ["inspecionar", diretorioRelativo, "--drift", "fresh", "--json"],
      path.join(base, "cache-diretorio-sufixo-fresh"),
    );
    assert.equal(inspecao.configuracao.analiseDrift.executada, true);
    assert.equal(inspecao.configuracao.fontesLegado.includes("typescript"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("--drift fresh publica e --drift cache reaproveita entre consultas públicas", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cli-hit-"));
  try {
    const sandbox = await criarSandboxCli(base);
    const raizCache = path.join(base, "cache-global");
    const fresco = await executarJson<PayloadResumoCli>(sandbox, [
      "resumo",
      sandbox.contratoRelativo,
      "--drift",
      "fresh",
      "--json",
    ], raizCache);

    assert.equal(fresco.analiseDrift.modo, "fresh");
    assert.equal(fresco.analiseDrift.executada, true);
    assert.equal(fresco.analiseDrift.sucesso, true);
    assert.equal(fresco.analiseDrift.cache?.origem, "calculado");
    assert.equal(fresco.analiseDrift.cache?.schema, "sema.drift-cache/v3");
    assert.equal(fresco.analiseDrift.cache?.metricas.gravacoes, 1);
    assert.equal(typeof fresco.resumo.scoreSemantico, "number");
    assert.equal(typeof fresco.resumo.confiancaGeral, "string");
    assert.equal((await stat(raizCache)).isDirectory(), true);
    assert.equal(
      (await readdir(raizCache, { recursive: true })).some((arquivo) => arquivo.endsWith(".json")),
      true,
    );

    const reutilizado = await executarJson<PayloadInspecionarCli>(sandbox, [
      "inspecionar",
      sandbox.contratoRelativo,
      "--drift",
      "cache",
      "--json",
    ], raizCache);

    assert.equal(reutilizado.configuracao.analiseDrift.modo, "cache");
    assert.equal(reutilizado.configuracao.analiseDrift.executada, true);
    assert.equal(reutilizado.configuracao.analiseDrift.sucesso, true);
    assert.equal(reutilizado.configuracao.analiseDrift.cache?.origem, "cache");
    assert.equal(reutilizado.configuracao.analiseDrift.cache?.schema, "sema.drift-cache/v3");
    assert.equal(reutilizado.configuracao.analiseDrift.cache?.metricas.hits, 1);
    assert.equal(typeof reutilizado.configuracao.scoreDrift, "number");
    assert.equal(typeof reutilizado.configuracao.confiancaGeral, "string");
    assert.equal(reutilizado.projeto.modulos.some((modulo) => modulo.implementacao !== null), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("drift --cache none executa sem I/O persistente de cache", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cli-direct-none-"));
  try {
    const sandbox = await criarSandboxCli(base);
    const raizCache = path.join(base, "cache-proibido");
    const payload = await executarJson<PayloadDriftCli>(sandbox, [
      "drift",
      sandbox.contratoRelativo,
      "--escopo",
      "modulo",
      "--cache",
      "none",
      "--json",
    ], raizCache);

    assert.equal(payload.sucesso, true);
    assert.equal(payload.escopo_aplicado.cache?.modo, "none");
    assert.equal(payload.escopo_aplicado.cache?.origem, "calculado");
    assert.equal(payload.escopo_aplicado.cache?.schema, "sema.drift-cache/v3");
    assert.deepEqual(payload.escopo_aplicado.cache?.metricas, {
      hits: 0,
      misses: 0,
      corruptos: 0,
      gravacoes: 0,
      errosGravacao: 0,
    });
    assert.equal(typeof payload.resumo_operacional.scoreMedio, "number");
    assert.equal(typeof payload.resumo_operacional.confiancaGeral, "string");
    await assertCaminhoAusente(raizCache);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("resumo e inspecionar propagam drift executado com falha", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cli-falha-"));
  try {
    const sandbox = await criarSandboxCli(base);
    const raizCache = path.join(base, "cache-global");
    await writeFile(path.join(sandbox.raiz, "src", "service.ts"), [
      "// SEMA-GOVERNED: app.cache_cli",
      "// Descrição: fixture sem o símbolo contratado para provar propagação de falha.",
      "export const outro = true;",
      "",
    ].join("\n"), "utf8");

    for (const argumentos of [
      ["resumo", sandbox.contratoRelativo, "--drift", "fresh", "--json"],
      ["inspecionar", sandbox.contratoRelativo, "--drift", "cache", "--json"],
      ["resumo", ".", "--drift", "fresh", "--json"],
      ["inspecionar", ".", "--drift", "cache", "--json"],
    ]) {
      const execucao = await executarCli(sandbox, argumentos, raizCache);
      assert.equal(execucao.codigo, 1, execucao.stderr);
      const payload = extrairPayloadResultadoCliV1<PayloadResumoCli | PayloadInspecionarCli>(
        execucao.stdout,
        { command: argumentos[0] ?? "", exitCode: execucao.codigo },
      );
      const analise = payload.comando === "resumo"
        ? payload.analiseDrift
        : payload.configuracao.analiseDrift;
      assert.equal(analise.executada, true);
      assert.equal(analise.sucesso, false);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("CLI falha para modo inválido e combinações conflitantes sem criar cache", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cli-erros-"));
  try {
    const sandbox = await criarSandboxCli(base);
    const casos = [
      {
        argumentos: ["resumo", sandbox.contratoRelativo, "--drift", "automatico", "--json"],
      },
      {
        argumentos: ["resumo", sandbox.contratoRelativo, "--cache", "cache", "--json"],
      },
      {
        argumentos: ["drift", sandbox.contratoRelativo, "--drift", "cache", "--json"],
      },
      {
        argumentos: [
          "drift",
          sandbox.contratoRelativo,
          "--cache",
          "none",
          "--drift",
          "fresh",
          "--json",
        ],
      },
      {
        argumentos: [
          "inspecionar",
          sandbox.contratoRelativo,
          "--com-drift",
          "--drift",
          "fresh",
          "--json",
        ],
      },
    ];

    for (const [indice, caso] of casos.entries()) {
      const raizCache = path.join(base, `cache-erro-${indice}`);
      const execucao = await executarCli(sandbox, caso.argumentos, raizCache);
      assert.equal(execucao.codigo, 1);
      assert.equal(execucao.stderr, "");
      assert.deepEqual(JSON.parse(execucao.stdout), {
        schemaVersion: "sema.cli.control/v1",
        ok: false,
        kind: "ARGUMENT_ERROR",
        code: "CLI_ARGUMENT_ERROR",
        message: "Argumentos inválidos. Consulte a ajuda do comando.",
        exitCode: 1,
      });
      await assertCaminhoAusente(raizCache);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
