// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.store
// Descrição: prova cache global content-addressed sem mutação do workspace nem confiança em metadados fracos.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analisarDriftLegado } from "../../pacotes/cli/src/drift.part11.js";
import type { ResultadoDrift } from "../../pacotes/cli/src/drift.part01.js";
import {
  digestJsonCanonicoCacheDrift,
  resolverRaizCacheSema,
} from "../../pacotes/cli/src/driftCacheStore.js";
import type { EventoOperacaoDrift } from "../../pacotes/cli/src/driftCatalogo.js";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";

interface SnapshotArquivoTeste {
  caminho: string;
  tamanho: number;
  mtimeMs: number;
  digest: string;
}

interface OpcoesWorkspaceCache {
  vinculosExtras?: readonly string[];
}

interface EnvelopeCacheTeste {
  payload: Record<string, unknown>;
  payloadDigest: string;
  [chave: string]: unknown;
}

async function criarWorkspaceCache(opcoes: OpcoesWorkspaceCache = {}): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-workspace-"));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await mkdir(path.join(base, "src"), { recursive: true });
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    diretoriosCodigo: ["./src"],
    fontesLegado: ["typescript"],
  }, null, 2), "utf8");
  const vinculos = ["src/service.ts", ...(opcoes.vinculosExtras ?? [])]
    .map((arquivo) => `    arquivo: "${arquivo}"`)
    .join("\n");
  await writeFile(path.join(base, "contratos", "cache.sema"), `module app.cache {
  vinculos {
${vinculos}
  }
  task executar {
    input { valor: Texto required }
    output { ok: Booleano }
    impl { ts: service.executar }
    guarantees { ok existe }
  }
}
`, "utf8");
  await writeFile(
    path.join(base, "src", "service.ts"),
    "export function executar(valor: string) { return { ok: valor.length > 0 }; }\n",
    "utf8",
  );
  return base;
}

async function localizarObjetoCache(cache: string): Promise<string> {
  const arquivos = await readdir(cache, { recursive: true, withFileTypes: true });
  const objetos = arquivos.filter((entrada) => entrada.isFile() && entrada.name.endsWith(".json"));
  assert.equal(objetos.length, 1);
  const objeto = objetos[0];
  assert.ok(objeto);
  return path.join(objeto.parentPath, objeto.name);
}

async function lerEnvelopeCache(caminho: string): Promise<EnvelopeCacheTeste> {
  const valor = JSON.parse(await readFile(caminho, "utf8")) as unknown;
  assert.equal(typeof valor, "object");
  assert.notEqual(valor, null);
  assert.equal(Array.isArray(valor), false);
  const envelope = valor as EnvelopeCacheTeste;
  assert.equal(typeof envelope.payload, "object");
  assert.notEqual(envelope.payload, null);
  assert.equal(Array.isArray(envelope.payload), false);
  return envelope;
}

async function adulterarPayloadCache(
  caminho: string,
  alterar: (payload: Record<string, unknown>) => void,
): Promise<void> {
  const envelope = await lerEnvelopeCache(caminho);
  alterar(envelope.payload);
  envelope.payloadDigest = digestJsonCanonicoCacheDrift(envelope.payload);
  await writeFile(caminho, JSON.stringify(envelope), "utf8");
}

function obterIndicePayload(
  payload: Record<string, unknown>,
  chave: string,
): Record<string, unknown> {
  const indices = payload.indices;
  assert.equal(typeof indices, "object");
  assert.notEqual(indices, null);
  assert.equal(Array.isArray(indices), false);
  const indice = (indices as Record<string, unknown>)[chave];
  assert.equal(typeof indice, "object");
  assert.notEqual(indice, null);
  assert.equal(Array.isArray(indice), false);
  return indice as Record<string, unknown>;
}

async function snapshotWorkspace(base: string): Promise<SnapshotArquivoTeste[]> {
  const saida: SnapshotArquivoTeste[] = [];
  const visitar = async (diretorio: string): Promise<void> => {
    const entradas = await readdir(diretorio, { withFileTypes: true });
    entradas.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    for (const entrada of entradas) {
      const absoluto = path.join(diretorio, entrada.name);
      if (entrada.isDirectory()) {
        await visitar(absoluto);
        continue;
      }
      if (!entrada.isFile()) continue;
      const [bytes, info] = await Promise.all([readFile(absoluto), stat(absoluto)]);
      saida.push({
        caminho: path.relative(base, absoluto).replace(/\\/g, "/"),
        tamanho: info.size,
        mtimeMs: info.mtimeMs,
        digest: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  };
  await visitar(base);
  return saida;
}

function semMetricasCache(resultado: ResultadoDrift): unknown {
  const copia = JSON.parse(JSON.stringify(resultado)) as ResultadoDrift;
  delete copia.escopo_aplicado.cache;
  delete copia.escopo_aplicado.catalogo;
  return copia;
}

async function executar(
  base: string,
  modoCache: "none" | "cache" | "fresh",
  escopo: "modulo" | "projeto" = "modulo",
): Promise<{ resultado: ResultadoDrift; eventos: EventoOperacaoDrift[] }> {
  const contexto = await carregarProjeto("contratos/cache.sema", base, {
    escopo,
    adiarDescobertaCodigo: true,
  });
  const eventos: EventoOperacaoDrift[] = [];
  const resultado = await analisarDriftLegado(contexto, {
    escopo,
    modoCache,
    observador: (evento) => eventos.push(evento),
  });
  return { resultado, eventos };
}

async function comCacheUsuarioIsolado<T>(diretorio: string, acao: () => Promise<T>): Promise<T> {
  const chaves = ["HOME", "USERPROFILE", "LOCALAPPDATA", "XDG_CACHE_HOME"] as const;
  const anteriores = new Map(chaves.map((chave) => [chave, process.env[chave]]));
  for (const chave of chaves) process.env[chave] = diretorio;
  try {
    const resolucao = resolverRaizCacheSema();
    assert.equal(resolucao.disponivel, true);
    if (!resolucao.disponivel) throw new Error(resolucao.codigo);
    const raizEsperada = process.platform === "win32"
      ? path.join(diretorio, "Sema", "Cache")
      : process.platform === "darwin"
        ? path.join(diretorio, "Library", "Caches", "Sema")
        : path.join(diretorio, "sema");
    assert.equal(path.resolve(resolucao.raiz), path.resolve(raizEsperada));
    return await acao();
  } finally {
    for (const chave of chaves) {
      const anterior = anteriores.get(chave);
      if (anterior === undefined) delete process.env[chave];
      else process.env[chave] = anterior;
    }
  }
}

test("none executa drift sem qualquer I/O persistente de cache", async () => {
  const base = await criarWorkspaceCache();
  const cache = path.join(os.tmpdir(), `sema-drift-cache-none-${process.pid}-${Date.now()}`);
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      const antes = await snapshotWorkspace(base);
      const { resultado, eventos } = await executar(base, "none");
      const depois = await snapshotWorkspace(base);
      assert.equal(resultado.escopo_aplicado.cache?.modo, "none");
      assert.equal(resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(resultado.escopo_aplicado.cache?.schema, "sema.drift-cache/v3");
      assert.equal(eventos.some((evento) => evento.tipo.startsWith("cache.")), false);
      await assert.rejects(stat(cache), /ENOENT/u);
      assert.deepEqual(depois, antes);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("fresh publica fora do workspace e cache reutiliza extrações sem recriar AST", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-global-"));
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      const antes = await snapshotWorkspace(base);
      const frio = await executar(base, "fresh");
      const quente = await executar(base, "cache");
      const depois = await snapshotWorkspace(base);

      assert.equal(frio.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(frio.resultado.escopo_aplicado.cache?.schema, "sema.drift-cache/v3");
      assert.equal(frio.resultado.escopo_aplicado.cache?.metricas.gravacoes, 1);
      assert.equal(quente.resultado.escopo_aplicado.cache?.origem, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.schema, "sema.drift-cache/v3");
      assert.equal(quente.resultado.escopo_aplicado.cache?.metricas.hits, 1);
      assert.ok(frio.eventos.filter((evento) => evento.tipo === "ast.create").length > 0);
      assert.equal(quente.eventos.filter((evento) => evento.tipo === "ast.create").length, 0);
      assert.deepEqual(semMetricasCache(quente.resultado), semMetricasCache(frio.resultado));
      assert.deepEqual(depois, antes);

      const objetos = (await readdir(cache, { recursive: true, withFileTypes: true }))
        .filter((entrada) => entrada.isFile() && entrada.name.endsWith(".json"));
      assert.equal(objetos.length, 1);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("mudança de conteúdo com tamanho e mtime preservados invalida o cache", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-content-"));
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      await executar(base, "fresh");
      const arquivo = path.join(base, "src", "service.ts");
      const original = await readFile(arquivo, "utf8");
      const info = await stat(arquivo);
      const alterado = original.replace("valor.length > 0", "valor.length > 1");
      assert.equal(Buffer.byteLength(alterado), Buffer.byteLength(original));
      await writeFile(arquivo, alterado, "utf8");
      await utimes(arquivo, info.atime, info.mtime);

      const resultado = await executar(base, "cache");
      assert.equal(resultado.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(resultado.resultado.escopo_aplicado.cache?.metricas.misses, 1);
      assert.ok(resultado.eventos.filter((evento) => evento.tipo === "ast.create").length > 0);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("escopo projeto invalida cache ao editar fonte caminhada não vinculada", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-project-dirty-"));
  const lateral = path.join(base, "src", "lateral.ts");
  try {
    await writeFile(lateral, "export const lateral = 'AAAA';\n", "utf8");
    await comCacheUsuarioIsolado(cache, async () => {
      const frio = await executar(base, "fresh", "projeto");
      assert.equal(frio.resultado.escopo_aplicado.cache?.origem, "calculado");

      const quente = await executar(base, "cache", "projeto");
      assert.equal(quente.resultado.escopo_aplicado.cache?.origem, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.metricas.hits, 1);

      const original = await readFile(lateral, "utf8");
      const info = await stat(lateral);
      const alterado = original.replace("AAAA", "BBBB");
      assert.equal(Buffer.byteLength(alterado), Buffer.byteLength(original));
      await writeFile(lateral, alterado, "utf8");
      await utimes(lateral, info.atime, info.mtime);

      const dirty = await executar(base, "cache", "projeto");
      assert.equal(dirty.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(dirty.resultado.escopo_aplicado.cache?.metricas.misses, 1);
      assert.ok(dirty.eventos.filter((evento) => evento.tipo === "ast.create").length > 0);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("objeto truncado vira miss recuperável e é reparado atomicamente", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-corrupt-"));
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      await executar(base, "fresh");
      const arquivos = await readdir(cache, { recursive: true, withFileTypes: true });
      const objeto = arquivos.find((entrada) => entrada.isFile() && entrada.name.endsWith(".json"));
      assert.ok(objeto);
      const absoluto = path.join(objeto.parentPath, objeto.name);
      await writeFile(absoluto, "{json truncado", "utf8");

      const recuperado = await executar(base, "cache");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.corruptos, 1);
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.gravacoes, 1);

      const quente = await executar(base, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.origem, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.metricas.hits, 1);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("surgimento de LICENSE explícito sem extensão invalida estado ausente", async () => {
  const base = await criarWorkspaceCache({ vinculosExtras: ["LICENSE"] });
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-license-create-"));
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      const ausente = await executar(base, "fresh");
      assert.equal(ausente.resultado.escopo_aplicado.arquivosAusentes?.includes("LICENSE"), true);

      await writeFile(
        path.join(base, "LICENSE"),
        Buffer.from([0x00, 0xff, 0xfe, 0x53, 0x45, 0x4d, 0x41]),
      );
      const presente = await executar(base, "cache");
      assert.equal(presente.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(presente.resultado.escopo_aplicado.cache?.metricas.misses, 1);
      assert.equal(presente.resultado.escopo_aplicado.arquivosAusentes?.includes("LICENSE"), false);

      const quente = await executar(base, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.origem, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.metricas.hits, 1);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("remoção de LICENSE explícito sem extensão invalida digest presente", async () => {
  const base = await criarWorkspaceCache({ vinculosExtras: ["LICENSE"] });
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-license-remove-"));
  try {
    await writeFile(
      path.join(base, "LICENSE"),
      Buffer.from([0x00, 0xff, 0xfe, 0x43, 0x41, 0x43, 0x48, 0x45]),
    );
    await comCacheUsuarioIsolado(cache, async () => {
      const presente = await executar(base, "fresh");
      assert.equal(presente.resultado.escopo_aplicado.arquivosAusentes?.includes("LICENSE"), false);

      await rm(path.join(base, "LICENSE"));
      const ausente = await executar(base, "cache");
      assert.equal(ausente.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(ausente.resultado.escopo_aplicado.cache?.metricas.misses, 1);
      assert.equal(ausente.resultado.escopo_aplicado.arquivosAusentes?.includes("LICENSE"), true);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("troca do HEAD invalida cache mesmo sem mudança dos arquivos catalogados", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-head-"));
  const referencia = path.join(base, ".git", "refs", "heads", "main");
  try {
    await mkdir(path.dirname(referencia), { recursive: true });
    await writeFile(path.join(base, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
    await writeFile(referencia, `${"a".repeat(40)}\n`, "utf8");
    await comCacheUsuarioIsolado(cache, async () => {
      await executar(base, "fresh");
      await writeFile(referencia, `${"b".repeat(40)}\n`, "utf8");

      const novoHead = await executar(base, "cache");
      assert.equal(novoHead.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(novoHead.resultado.escopo_aplicado.cache?.metricas.misses, 1);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("consumerSurface A:b adulterada falha fechada e não vaza caminho ou sentinela", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-consumer-path-"));
  const sentinela = "SENTINELA_CONSUMER_CACHE_NAO_VAZAR";
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      await executar(base, "fresh");
      const objeto = await localizarObjetoCache(cache);
      await adulterarPayloadCache(objeto, (payload) => {
        obterIndicePayload(payload, "indexTs").consumerSurfaces = [{
          rota: sentinela,
          arquivo: "A:b",
          tipoArquivo: "page",
        }];
      });

      const recuperado = await executar(base, "cache");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.corruptos, 1);
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.gravacoes, 1);
      const publico = JSON.stringify(recuperado.resultado);
      for (const segredo of [
        sentinela,
        "A:b",
        cache,
        cache.replace(/\\/g, "/"),
        JSON.stringify(cache).slice(1, -1),
      ]) {
        assert.equal(publico.includes(segredo), false, `vazou no envelope público: ${segredo}`);
      }

      const quente = await executar(base, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.origem, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.metricas.hits, 1);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("consumerSurface interna ausente do catálogo é rejeitada e reparada", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-consumer-absent-"));
  const sentinela = "SENTINELA_CONSUMER_AUSENTE_NAO_VAZAR";
  const arquivoAusente = "src/inexistente.ts";
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      await executar(base, "fresh");
      const objeto = await localizarObjetoCache(cache);
      await adulterarPayloadCache(objeto, (payload) => {
        obterIndicePayload(payload, "indexTs").consumerSurfaces = [{
          rota: sentinela,
          arquivo: arquivoAusente,
          tipoArquivo: "page",
        }];
      });

      const recuperado = await executar(base, "cache");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.corruptos, 1);
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.gravacoes, 1);
      const publico = JSON.stringify(recuperado.resultado);
      assert.equal(publico.includes(sentinela), false);
      assert.equal(publico.includes(arquivoAusente), false);

      const quente = await executar(base, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.origem, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.metricas.hits, 1);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("payload com campo futuro autoconsistente é rejeitado pela allowlist exata", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-extra-field-"));
  const sentinela = "SENTINELA_CAMPO_FUTURO_NAO_VAZAR";
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      await executar(base, "fresh");
      const objeto = await localizarObjetoCache(cache);
      await adulterarPayloadCache(objeto, (payload) => {
        payload.campoFuturo = sentinela;
      });

      const recuperado = await executar(base, "cache");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.corruptos, 1);
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.gravacoes, 1);
      assert.equal(JSON.stringify(recuperado.resultado).includes(sentinela), false);

      const quente = await executar(base, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.origem, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.metricas.hits, 1);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("adulteração semântica shape-valid com payloadDigest recalculado vira miss e preserva o fresh", async () => {
  const base = await criarWorkspaceCache();
  const cache = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cache-semantic-tamper-"));
  const sentinela = "simboloFantasmaCache";
  try {
    await comCacheUsuarioIsolado(cache, async () => {
      const fresh = await executar(base, "fresh");
      const objeto = await localizarObjetoCache(cache);
      await adulterarPayloadCache(objeto, (payload) => {
        assert.equal(Object.prototype.hasOwnProperty.call(payload, "todosSimbolos"), false);
        const indexTs = obterIndicePayload(payload, "indexTs");
        assert.ok(Array.isArray(indexTs.simbolos));
        const simbolo = (indexTs.simbolos as Array<Record<string, unknown>>)[0];
        assert.ok(simbolo);
        simbolo.caminho = `src.service.${sentinela}`;
        simbolo.simbolo = sentinela;
      });

      const recuperado = await executar(base, "cache");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.origem, "calculado");
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.corruptos, 1);
      assert.equal(recuperado.resultado.escopo_aplicado.cache?.metricas.gravacoes, 1);
      assert.ok(recuperado.eventos.some((evento) => evento.tipo === "ast.create"));
      assert.deepEqual(semMetricasCache(recuperado.resultado), semMetricasCache(fresh.resultado));
      assert.equal(JSON.stringify(recuperado.resultado).includes(sentinela), false);

      const quente = await executar(base, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.origem, "cache");
      assert.equal(quente.resultado.escopo_aplicado.cache?.metricas.hits, 1);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});
