// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.store
// Descrição: prova resolução cross-platform, confinamento, integridade e concorrência do cache externo.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import {
  capturarEstadoEntradaGuardado,
  publicarObjetoExclusivo,
} from "../../pacotes/cli/src/driftCacheCas.js";
import {
  capturarGuardaCadeia,
  identidadeDe,
} from "../../pacotes/cli/src/driftCacheFilesystem.js";
import {
  criarStoreCacheDrift,
  digestJsonCanonicoCacheDrift,
  resolverRaizCacheSema,
  serializarJsonCanonicoCacheDrift,
  type EventoStoreCacheDrift,
  type StoreCacheDrift,
} from "../../pacotes/cli/src/driftCacheStore.js";

const HEAD = "0123456789abcdef0123456789abcdef01234567";
const executarArquivo = promisify(execFile);

interface FixtureCache {
  base: string;
  workspace: string;
  raizCache: string;
}

async function criarFixture(nome: string): Promise<FixtureCache> {
  const logica = await mkdtemp(path.join(os.tmpdir(), `sema-cache-store-${nome}-`));
  const base = await realpath(logica);
  const workspace = path.join(base, "workspace-segredo-nao-vazar");
  const raizCache = path.join(base, "cache-segredo-nao-vazar");
  await mkdir(workspace, { recursive: true });
  return { base, workspace, raizCache };
}

async function criarGitNormal(workspace: string): Promise<void> {
  const ref = path.join(workspace, ".git", "refs", "heads", "main");
  await mkdir(path.dirname(ref), { recursive: true });
  await writeFile(path.join(workspace, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
  await writeFile(ref, `${HEAD}\n`, "utf8");
}

function caminhoObjeto(
  raizCache: string,
  store: StoreCacheDrift,
  chave: string,
): string {
  assert.ok(store.workspaceId);
  const digest = chave.slice("sha256:".length);
  return path.join(
    raizCache,
    "drift",
    "v3",
    "workspaces",
    store.workspaceId.slice("sha256:".length),
    "objects",
    "sha256",
    digest.slice(0, 2),
    `${digest}.json`,
  );
}

function caminhoLock(raizCache: string, store: StoreCacheDrift, chave: string): string {
  const objeto = caminhoObjeto(raizCache, store, chave);
  return path.join(path.dirname(objeto), `.${chave.slice("sha256:".length)}.lock`);
}

test("JSON canonico ordena campos e produz SHA-256 deterministico", () => {
  const a = { z: [3, { b: true, a: null }], a: "valor" };
  const b = { a: "valor", z: [3, { a: null, b: true }] };
  assert.equal(serializarJsonCanonicoCacheDrift(a), serializarJsonCanonicoCacheDrift(b));
  assert.equal(digestJsonCanonicoCacheDrift(a), digestJsonCanonicoCacheDrift(b));
  assert.match(digestJsonCanonicoCacheDrift(a), /^sha256:[a-f0-9]{64}$/u);
  assert.throws(() => serializarJsonCanonicoCacheDrift({ valor: undefined }), /tipo_undefined/u);
  const ciclico: Record<string, unknown> = {};
  ciclico.self = ciclico;
  assert.throws(() => serializarJsonCanonicoCacheDrift(ciclico), /referencia_ciclica/u);
});

test("resolver de raiz segue Windows, macOS e XDG sem aceitar caminho relativo", () => {
  assert.deepEqual(
    resolverRaizCacheSema({
      plataforma: "win32",
      ambiente: { LOCALAPPDATA: "C:\\Users\\Ada\\AppData\\Local" },
      diretorioUsuario: "C:\\Users\\Ada",
    }),
    {
      disponivel: true,
      raiz: "C:\\Users\\Ada\\AppData\\Local\\Sema\\Cache",
      origem: "localappdata",
    },
  );
  assert.deepEqual(
    resolverRaizCacheSema({
      plataforma: "win32",
      ambiente: { LOCALAPPDATA: "relativo" },
      diretorioUsuario: "C:\\Users\\Ada",
    }),
    {
      disponivel: true,
      raiz: "C:\\Users\\Ada\\AppData\\Local\\Sema\\Cache",
      origem: "windows_fallback",
    },
  );
  assert.deepEqual(
    resolverRaizCacheSema({ plataforma: "darwin", ambiente: {}, diretorioUsuario: "/Users/ada" }),
    { disponivel: true, raiz: "/Users/ada/Library/Caches/Sema", origem: "macos_cache" },
  );
  assert.deepEqual(
    resolverRaizCacheSema({
      plataforma: "linux",
      ambiente: { XDG_CACHE_HOME: "/var/cache/ada" },
      diretorioUsuario: "/home/ada",
    }),
    { disponivel: true, raiz: "/var/cache/ada/sema", origem: "xdg_cache" },
  );
  assert.deepEqual(
    resolverRaizCacheSema({
      plataforma: "linux",
      ambiente: { XDG_CACHE_HOME: "cache-relativo" },
      diretorioUsuario: "/home/ada",
    }),
    { disponivel: true, raiz: "/home/ada/.cache/sema", origem: "unix_fallback" },
  );
  assert.deepEqual(
    resolverRaizCacheSema({ plataforma: "linux", raizCache: "cache-relativo" }),
    { disponivel: false, codigo: "cache_root_relativa" },
  );
});

test("store publica fora do workspace, acerta no warm e nao vaza caminhos", async () => {
  const fixture = await criarFixture("roundtrip");
  try {
    await criarGitNormal(fixture.workspace);
    const eventos: EventoStoreCacheDrift[] = [];
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
      observador: (evento) => eventos.push(evento),
    });
    assert.equal(store.disponivel, true);
    assert.match(store.workspaceId ?? "", /^sha256:[a-f0-9]{64}$/u);
    assert.equal(store.gitHead, HEAD);

    const payload = { simbolos: ["pedido.criar"], arquivo: "src/pedido.ts" } as const;
    const chave = digestJsonCanonicoCacheDrift({ analise: "simbolos-v1", payload });
    const cold = await store.ler(chave);
    assert.equal(cold.estado, "miss");
    const publicado = await store.publicar(chave, payload);
    assert.equal(publicado.estado, "publicado");
    const warm = await store.ler(chave, (valor): valor is typeof payload => (
      typeof valor === "object"
      && valor !== null
      && Array.isArray((valor as { simbolos?: unknown }).simbolos)
    ));
    assert.equal(warm.estado, "hit");
    if (warm.estado === "hit") assert.deepEqual(warm.valor, payload);

    const arquivo = caminhoObjeto(fixture.raizCache, store, chave);
    const envelope = await readFile(arquivo, "utf8");
    const trilhaPublica = JSON.stringify({ eventos, publicado, warm, metricas: store.metricas() });
    for (const sensivel of [fixture.base, fixture.workspace, fixture.raizCache, "segredo-nao-vazar"]) {
      assert.equal(envelope.includes(sensivel), false);
      assert.equal(trilhaPublica.includes(sensivel), false);
    }
    assert.ok(eventos.every((evento) => !evento.caminhoVirtual || evento.caminhoVirtual.startsWith("$SEMA_CACHE/")));
    assert.deepEqual(store.metricas(), {
      leituras: 2,
      hits: 1,
      misses: 1,
      corruptos: 0,
      publicacoes: 1,
      reutilizacoes: 0,
      corridasValidadas: 0,
      erros: 0,
    });
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("root dentro do workspace e root hardlinked ficam indisponiveis sem lancar", async () => {
  const fixture = await criarFixture("roots-invalidas");
  try {
    const interno = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: path.join(fixture.workspace, ".cache"),
    });
    assert.equal(interno.disponivel, false);
    assert.equal(interno.erroDisponibilidade, "cache_root_sobrepoe_workspace");

    const arquivo = path.join(fixture.base, "arquivo-root");
    const hardlink = path.join(fixture.base, "hardlink-root");
    await writeFile(arquivo, "nao-diretorio", "utf8");
    await link(arquivo, hardlink);
    const storeHardlink = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: hardlink,
    });
    assert.equal(storeHardlink.disponivel, false);
    assert.equal(storeHardlink.erroDisponibilidade, "cache_root_hardlink");
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("root por symlink ou junction e recusado", async (t) => {
  const fixture = await criarFixture("root-link");
  try {
    const real = path.join(fixture.base, "cache-real");
    const atalho = path.join(fixture.base, "cache-link");
    await mkdir(real, { recursive: true });
    try {
      await symlink(real, atalho, process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "UNKNOWN"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente nao permite criar symlink ou junction");
        return;
      }
      throw erro;
    }
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: atalho,
    });
    assert.equal(store.disponivel, false);
    assert.equal(store.erroDisponibilidade, "cache_root_link");
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("arquivo .git de worktree externo nao e seguido nem persistido", async () => {
  const fixture = await criarFixture("git-externo");
  try {
    const sentinela = "gitdir: C:/segredo-absoluto-nao-vazar";
    await writeFile(path.join(fixture.workspace, ".git"), sentinela, "utf8");
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    assert.equal(store.disponivel, true);
    assert.equal(store.gitHead, null);
    const payload = { valor: 1 } as const;
    const chave = digestJsonCanonicoCacheDrift({ payload });
    assert.equal((await store.publicar(chave, payload)).estado, "publicado");
    const envelope = await readFile(caminhoObjeto(fixture.raizCache, store, chave), "utf8");
    assert.equal(envelope.includes(sentinela), false);
    assert.equal(envelope.includes("segredo-absoluto-nao-vazar"), false);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("corrupcao e hardlink de objeto viram miss seguro sem conteudo confiavel", async () => {
  const fixture = await criarFixture("corrupcao");
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const payload = { rotas: ["/pedidos"] } as const;
    const chave = digestJsonCanonicoCacheDrift({ caso: "corrupcao" });
    await store.publicar(chave, payload);
    const alvo = caminhoObjeto(fixture.raizCache, store, chave);
    await writeFile(alvo, "{json truncado", "utf8");
    const corrupto = await store.ler(chave);
    assert.equal(corrupto.estado, "corrupto");
    assert.equal(corrupto.estado === "corrupto" ? corrupto.codigo : null, "cache_objeto_corrupto");

    await unlink(alvo);
    const origemHardlink = path.join(fixture.base, "objeto-controlado");
    await writeFile(origemHardlink, "{}", "utf8");
    await link(origemHardlink, alvo);
    const hardlinked = await store.ler(chave);
    assert.equal(hardlinked.estado, "corrupto");
    assert.equal(hardlinked.estado === "corrupto" ? hardlinked.codigo : null, "cache_objeto_hardlink");
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("publicacoes concorrentes deixam um unico objeto valido", async () => {
  const fixture = await criarFixture("concorrencia");
  try {
    const [storeA, storeB] = await Promise.all([
      criarStoreCacheDrift({ baseProjeto: fixture.workspace, raizCache: fixture.raizCache }),
      criarStoreCacheDrift({ baseProjeto: fixture.workspace, raizCache: fixture.raizCache }),
    ]);
    assert.equal(storeA.workspaceId, storeB.workspaceId);
    const payload = { dependencias: ["src/a.ts", "src/b.ts"] } as const;
    const chave = digestJsonCanonicoCacheDrift({ analise: "deps-v1" });
    const resultados = await Promise.all([
      storeA.publicar(chave, payload),
      storeB.publicar(chave, payload),
      storeA.publicar(chave, payload),
      storeB.publicar(chave, payload),
    ]);
    assert.ok(
      resultados.every((resultado) => ["publicado", "existente"].includes(resultado.estado)),
      JSON.stringify(resultados),
    );
    const final = await storeA.ler(chave);
    assert.equal(final.estado, "hit");
    if (final.estado === "hit") assert.deepEqual(final.valor, payload);
    const pasta = path.dirname(caminhoObjeto(fixture.raizCache, storeA, chave));
    assert.deepEqual((await readdir(pasta)).filter((nome) => nome.endsWith(".tmp")), []);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("publicacao com validador repara payload autoconsistente invalido e preserva vencedor valido", async () => {
  const fixture = await criarFixture("reparo-semantico");
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const chave = digestJsonCanonicoCacheDrift({ caso: "reparo-semantico" });
    await store.publicar(chave, { schema: "indices-antigos", itens: [] });
    type PayloadAtual = { schema: "indices-v3"; itens: string[] };
    const validarAtual = (valor: unknown): valor is PayloadAtual => (
      typeof valor === "object"
      && valor !== null
      && (valor as { schema?: unknown }).schema === "indices-v3"
      && Array.isArray((valor as { itens?: unknown }).itens)
    );

    assert.equal((await store.ler(chave, validarAtual)).estado, "corrupto");
    const payloadAtual: PayloadAtual = { schema: "indices-v3", itens: ["pedido.criar"] };
    assert.equal((await store.publicar(chave, payloadAtual, validarAtual)).estado, "publicado");
    const reparado = await store.ler(chave, validarAtual);
    assert.equal(reparado.estado, "hit");
    if (reparado.estado === "hit") assert.deepEqual(reparado.valor, payloadAtual);

    const divergente: PayloadAtual = { schema: "indices-v3", itens: ["pedido.cancelar"] };
    const conflito = await store.publicar(chave, divergente, validarAtual);
    assert.equal(conflito.estado, "erro");
    assert.equal(conflito.estado === "erro" ? conflito.codigo : null, "cache_objeto_conflitante");
    const preservado = await store.ler(chave, validarAtual);
    assert.equal(preservado.estado, "hit");
    if (preservado.estado === "hit") assert.deepEqual(preservado.valor, payloadAtual);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("CAS usa barreira de estado e link exclusivo sem sobrescrever vencedor tardio", async () => {
  const fixture = await criarFixture("cas-barreira");
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const chave = digestJsonCanonicoCacheDrift({ caso: "cas-barreira" });
    assert.equal((await store.publicar(chave, { valor: "inicial" })).estado, "publicado");
    const destino = caminhoObjeto(fixture.raizCache, store, chave);
    const pasta = path.dirname(destino);
    const identidadeRaiz = identidadeDe(await lstat(fixture.raizCache, { bigint: true }));
    const guarda = await capturarGuardaCadeia(fixture.raizCache, identidadeRaiz, pasta);
    const estadoCapturado = await capturarEstadoEntradaGuardado(destino, guarda);
    assert.ok(estadoCapturado);

    const temporario = path.join(
      pasta,
      `.${chave.slice("sha256:".length)}.22222222-2222-4222-8222-222222222222.tmp`,
    );
    await writeFile(temporario, "candidato", "utf8");
    const identidadeTemporario = identidadeDe(await lstat(temporario, { bigint: true }));

    await unlink(destino);
    await writeFile(destino, "vencedor-tardio", "utf8");
    const reparo = await publicarObjetoExclusivo({
      temporario,
      destino,
      guarda,
      identidadeTemporario,
      estadoDestinoSubstituivel: estadoCapturado,
    });
    assert.equal(reparo.estado, "conflito");
    assert.equal(await readFile(destino, "utf8"), "vencedor-tardio");

    const publicacaoNormal = await publicarObjetoExclusivo({
      temporario,
      destino,
      guarda,
      identidadeTemporario,
      estadoDestinoSubstituivel: null,
    });
    assert.equal(publicacaoNormal.estado, "existente");
    assert.equal(await readFile(destino, "utf8"), "vencedor-tardio");
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("troca de componente intermediario por junction ou symlink bloqueia escrita e leitura", async (t) => {
  const fixture = await criarFixture("troca-intermediaria");
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const chave = digestJsonCanonicoCacheDrift({ caso: "troca-intermediaria" });
    const v3 = path.join(fixture.raizCache, "drift", "v3");
    const v3Guardado = path.join(fixture.raizCache, "drift", "v3-guardado");
    const externo = path.join(fixture.base, "externo-escrita");
    await mkdir(externo, { recursive: true });
    await rename(v3, v3Guardado);
    try {
      await symlink(externo, v3, process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      await rename(v3Guardado, v3);
      if (["EPERM", "EACCES", "UNKNOWN"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente nao permite trocar componente por junction/symlink");
        return;
      }
      throw erro;
    }

    const bloqueado = await store.publicar(chave, { valor: "nao-vazar" });
    assert.equal(bloqueado.estado, "erro");
    assert.deepEqual(await readdir(externo), []);
    await rm(v3, { force: true });
    await rename(v3Guardado, v3);

    assert.equal((await store.publicar(chave, { valor: "seguro" })).estado, "publicado");
    const objeto = caminhoObjeto(fixture.raizCache, store, chave);
    const pastaPrefixo = path.dirname(objeto);
    const pastaGuardada = `${pastaPrefixo}-guardada`;
    const externoLeitura = path.join(fixture.base, "externo-leitura");
    await mkdir(externoLeitura, { recursive: true });
    await writeFile(path.join(externoLeitura, path.basename(objeto)), await readFile(objeto));
    await rename(pastaPrefixo, pastaGuardada);
    await symlink(externoLeitura, pastaPrefixo, process.platform === "win32" ? "junction" : "dir");
    const leitura = await store.ler(chave);
    assert.equal(leitura.estado, "corrupto");
    assert.equal(leitura.estado === "corrupto" ? leitura.codigo : null, "cache_root_link");
    await rm(pastaPrefixo, { force: true });
    await rename(pastaGuardada, pastaPrefixo);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("processos concorrentes com payload divergente nao substituem o vencedor", async () => {
  const fixture = await criarFixture("concorrencia-processos");
  try {
    const chave = digestJsonCanonicoCacheDrift({ caso: "concorrencia-processos" });
    const modulo = pathToFileURL(path.resolve("pacotes/cli/src/driftCacheStore.ts")).href;
    const programa = `
      import { criarStoreCacheDrift } from ${JSON.stringify(modulo)};
      const store = await criarStoreCacheDrift({
        baseProjeto: process.env.SEMA_TEST_WORKSPACE,
        raizCache: process.env.SEMA_TEST_CACHE,
      });
      const resultado = await store.publicar(
        process.env.SEMA_TEST_CHAVE,
        JSON.parse(process.env.SEMA_TEST_PAYLOAD),
      );
      process.stdout.write(JSON.stringify(resultado));
    `;
    const executar = async (valor: string) => executarArquivo(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", programa],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SEMA_TEST_WORKSPACE: fixture.workspace,
          SEMA_TEST_CACHE: fixture.raizCache,
          SEMA_TEST_CHAVE: chave,
          SEMA_TEST_PAYLOAD: JSON.stringify({ valor }),
        },
        windowsHide: true,
      },
    );
    const saidas = await Promise.all([executar("a"), executar("b")]);
    const resultados = saidas.map(({ stdout }) => JSON.parse(stdout.trim()) as {
      estado: string;
      codigo?: string;
    });
    assert.equal(
      resultados.filter((item) => item.estado === "publicado").length,
      1,
      JSON.stringify(resultados),
    );
    assert.equal(
      resultados.filter((item) => item.codigo === "cache_objeto_conflitante").length,
      1,
      JSON.stringify(resultados),
    );

    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const final = await store.ler<{ valor: string }>(chave);
    assert.equal(final.estado, "hit");
    if (final.estado === "hit") assert.ok(["a", "b"].includes(final.valor.valor));
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("lock e temporario deixados por processo morto sao recuperados sem orfaos", async () => {
  const fixture = await criarFixture("crash-recovery");
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const chave = digestJsonCanonicoCacheDrift({ caso: "crash-recovery" });
    await store.publicar(chave, { valor: "preparar-pasta" });
    const objeto = caminhoObjeto(fixture.raizCache, store, chave);
    const pasta = path.dirname(objeto);
    await unlink(objeto);
    const digest = chave.slice("sha256:".length);
    const temporario = path.join(pasta, `.${digest}.00000000-0000-4000-8000-000000000000.tmp`);
    await writeFile(temporario, "objeto parcial", "utf8");
    await writeFile(caminhoLock(fixture.raizCache, store, chave), JSON.stringify({
      schema: "sema.drift-cache-lock/v1",
      pid: 999_999_999,
      processoIniciadoEm: performance.timeOrigin - 60_000,
      "token": "11111111-1111-4111-8111-111111111111",
      criadoEm: Date.now(),
    }), "utf8");

    assert.equal((await store.publicar(chave, { valor: "recuperado" })).estado, "publicado");
    const nomes = await readdir(pasta);
    assert.equal(nomes.some((nome) => nome.endsWith(".tmp") || nome.endsWith(".lock")), false);
    assert.equal((await store.ler(chave)).estado, "hit");
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("temporario hardlinked de crash e recuperado sem remover o objeto publicado", async () => {
  const fixture = await criarFixture("crash-hardlink");
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const chave = digestJsonCanonicoCacheDrift({ caso: "crash-hardlink" });
    const payload = { valor: "persistido" } as const;
    assert.equal((await store.publicar(chave, payload)).estado, "publicado");
    const objeto = caminhoObjeto(fixture.raizCache, store, chave);
    const pasta = path.dirname(objeto);
    const temporario = path.join(
      pasta,
      `.${chave.slice("sha256:".length)}.33333333-3333-4333-8333-333333333333.tmp`,
    );
    await link(objeto, temporario);
    assert.equal((await lstat(objeto)).nlink, 2);

    assert.equal((await store.publicar(chave, payload)).estado, "existente");
    assert.equal((await lstat(objeto)).nlink, 1);
    assert.equal((await lstat(temporario).catch(() => null)), null);
    const leitura = await store.ler<typeof payload>(chave);
    assert.equal(leitura.estado, "hit");
    if (leitura.estado === "hit") assert.deepEqual(leitura.valor, payload);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("worker ativo no mesmo PID conserva lock antigo e fallback reutiliza vencedor", async () => {
  const fixture = await criarFixture("worker-lock");
  let worker: Worker | undefined;
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const chave = digestJsonCanonicoCacheDrift({ caso: "worker-lock" });
    const payload = { valor: "vencedor" } as const;
    assert.equal((await store.publicar(chave, payload)).estado, "publicado");
    const lock = caminhoLock(fixture.raizCache, store, chave);
    const programaWorker = `
      const { parentPort, workerData } = require("node:worker_threads");
      const { performance } = require("node:perf_hooks");
      const { unlink, utimes, writeFile } = require("node:fs/promises");
      (async () => {
        await writeFile(workerData.lock, JSON.stringify({
          schema: "sema.drift-cache-lock/v1",
          pid: process.pid,
          processoIniciadoEm: performance.timeOrigin,
          "token": "44444444-4444-4444-8444-444444444444",
          criadoEm: Date.now() - 60_000,
        }), { encoding: "utf8", flag: "wx", mode: 0o600 });
        const antigo = new Date(Date.now() - 60_000);
        await utimes(workerData.lock, antigo, antigo);
        parentPort.postMessage({ tipo: "pronto", pid: process.pid, origem: performance.timeOrigin });
        parentPort.once("message", async () => {
          let removido = true;
          try {
            await unlink(workerData.lock);
          } catch (erro) {
            removido = erro?.code !== "ENOENT";
          }
          parentPort.postMessage({ tipo: "liberado", removido });
          parentPort.close();
        });
      })().catch((erro) => {
        parentPort.postMessage({ tipo: "erro", mensagem: String(erro?.stack || erro) });
      });
    `;
    worker = new Worker(programaWorker, { eval: true, workerData: { lock } });
    const proximaMensagem = () => new Promise<Record<string, unknown>>((resolve, reject) => {
      worker!.once("message", (mensagem) => resolve(mensagem as Record<string, unknown>));
      worker!.once("error", reject);
    });
    const pronto = await proximaMensagem();
    assert.deepEqual(
      { tipo: pronto.tipo, pid: pronto.pid, origem: pronto.origem },
      { tipo: "pronto", pid: process.pid, origem: performance.timeOrigin },
    );

    const inicio = Date.now();
    const resultado = await store.publicar(chave, payload);
    const duracaoMs = Date.now() - inicio;
    assert.equal(resultado.estado, "existente");
    assert.ok(duracaoMs >= 1_500, `lock ativo foi roubado em ${duracaoMs}ms`);
    assert.ok(await lstat(lock));

    const encerrado = new Promise<void>((resolve, reject) => {
      worker!.once("exit", (codigo) => codigo === 0 ? resolve() : reject(new Error(`worker_exit_${codigo}`)));
      worker!.once("error", reject);
    });
    worker.postMessage("liberar");
    const liberado = await proximaMensagem();
    assert.deepEqual(liberado, { tipo: "liberado", removido: true });
    await encerrado;
    worker = undefined;
  } finally {
    await worker?.terminate().catch(() => undefined);
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("lock com PID reciclado so e recuperado depois do TTL", async () => {
  const fixture = await criarFixture("pid-reciclado");
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const chave = digestJsonCanonicoCacheDrift({ caso: "pid-reciclado" });
    assert.equal((await store.publicar(chave, { valor: "preparar" })).estado, "publicado");
    await unlink(caminhoObjeto(fixture.raizCache, store, chave));
    const lock = caminhoLock(fixture.raizCache, store, chave);
    await writeFile(lock, JSON.stringify({
      schema: "sema.drift-cache-lock/v1",
      pid: process.pid,
      processoIniciadoEm: performance.timeOrigin - 60_000,
      "token": "55555555-5555-4555-8555-555555555555",
      criadoEm: Date.now() - 60_000,
    }), "utf8");
    const antigo = new Date(Date.now() - 60_000);
    await utimes(lock, antigo, antigo);

    assert.equal((await store.publicar(chave, { valor: "recuperado" })).estado, "publicado");
    assert.equal(await lstat(lock).catch(() => null), null);
    assert.equal((await store.ler(chave)).estado, "hit");
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("diretorios e objetos usam permissoes privadas em POSIX", async (t) => {
  if (process.platform === "win32") {
    t.skip("bits POSIX nao sao uma fronteira de ACL no Windows");
    return;
  }
  const fixture = await criarFixture("permissoes");
  try {
    const store = await criarStoreCacheDrift({
      baseProjeto: fixture.workspace,
      raizCache: fixture.raizCache,
    });
    const payload = { valor: true } as const;
    const chave = digestJsonCanonicoCacheDrift({ caso: "permissoes" });
    await store.publicar(chave, payload);
    const arquivo = caminhoObjeto(fixture.raizCache, store, chave);
    assert.equal((await stat(fixture.raizCache)).mode & 0o777, 0o700);
    assert.equal((await stat(path.dirname(arquivo))).mode & 0o777, 0o700);
    assert.equal((await stat(arquivo)).mode & 0o777, 0o600);
    assert.equal((await lstat(arquivo)).nlink, 1);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});
