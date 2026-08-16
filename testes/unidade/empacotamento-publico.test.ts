// SEMA-GOVERNED: sema.produto.fronteira_repositorios.empacotamento
// Descrição: prova a rota pública única, o stage isolado e a publicação atômica do tarball.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  capturarControleDestinoSeguro,
  copiarArvoreFonteSegura,
  main,
  publicarTarballNoReplace,
} from "../../scripts/empacotar-cli-publica.mjs";
import {
  validarArtefatosDistribuicaoContraFonte,
  validarManifestSemDependenciasFile,
  validarRuntimeLocalDireto,
} from "../../scripts/cli-publico/fronteira-publica.mjs";
import { fingerprintCaminhos } from "../../scripts/cli-publico/distribuicao-global.mjs";

const raiz = path.resolve(".");
const packer = path.join(raiz, "scripts", "empacotar-cli-publica.mjs");

function resolverNpmExecpath(): string {
  const candidatos = [
    process.env.npm_execpath?.trim(),
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter((valor): valor is string => Boolean(valor));
  const encontrado = candidatos.find((caminho) => path.isAbsolute(caminho) && existsSync(caminho));
  assert.ok(encontrado, "npm_execpath absoluto não encontrado para o teste");
  return encontrado;
}

function ambienteIsolado(base: string): NodeJS.ProcessEnv {
  const home = path.join(base, "home");
  const cache = path.join(base, "npm-cache");
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    ZDOTDIR: home,
    npm_execpath: resolverNpmExecpath(),
    npm_config_cache: cache,
    NPM_CONFIG_CACHE: cache,
    npm_config_global: "false",
    NPM_CONFIG_GLOBAL: "false",
  };
}

function executarNodeAsync(argumentos: string[], env: NodeJS.ProcessEnv) {
  const filho = spawn(process.execPath, argumentos, {
    cwd: raiz,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  return new Promise<{ codigo: number | null; saida: string }>((resolve, reject) => {
    let saida = "";
    filho.stdout.setEncoding("utf8");
    filho.stderr.setEncoding("utf8");
    filho.stdout.on("data", (parte) => { saida += parte; });
    filho.stderr.on("data", (parte) => { saida += parte; });
    filho.once("error", reject);
    filho.once("exit", (codigo) => resolve({ codigo, saida }));
  });
}

async function listarStagesPublicos(): Promise<string[]> {
  try {
    return (await readdir(path.join(raiz, ".tmp")))
      .filter((nome) => nome.startsWith("cli-npm-stage-"))
      .sort();
  } catch {
    return [];
  }
}

async function criarTemporarioEmSegundoVolume(referencia: string): Promise<string | null> {
  const volumeReferencia = (await stat(referencia, { bigint: true })).dev;
  const candidatos = process.platform === "win32"
    ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letra) => `${letra}:\\`)
    : ["/dev/shm", "/var/tmp", "/tmp"];
  for (const candidato of candidatos) {
    if (!existsSync(candidato)) continue;
    try {
      if ((await stat(candidato, { bigint: true })).dev === volumeReferencia) continue;
      return await mkdtemp(path.join(candidato, "sema-pack-cross-volume-"));
    } catch {
      // Volume ausente, somente leitura ou sem permissão para materializar o probe.
    }
  }
  return null;
}

test("npm pack do workspace falha antes de qualquer mutação", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-guard-"));
  const saida = path.join(base, "saida");
  await mkdir(saida);
  const alvosWorkspace = [
    path.join(raiz, "pacotes", "cli", "exemplos"),
    path.join(raiz, "pacotes", "cli", "skills"),
    path.join(raiz, "pacotes", "cli", "node_modules", "@sema"),
    path.join(raiz, "pacotes", "cli", ".sema-prepack-transaction.json"),
  ];
  try {
    const antes = await fingerprintCaminhos(alvosWorkspace);
    const npmExecpath = resolverNpmExecpath();
    const resultado = spawnSync(process.execPath, [
      npmExecpath,
      "pack",
      "--workspace",
      "@semacode/cli",
      "--pack-destination",
      saida,
      "--cache",
      path.join(base, "cache"),
    ], {
      cwd: raiz,
      env: ambienteIsolado(base),
      encoding: "utf8",
      windowsHide: true,
    });
    const texto = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;
    assert.notEqual(resultado.status, 0);
    assert.match(texto, /PACK_WORKSPACE_NAO_SUPORTADO/u);
    assert.match(texto, /npm run cli:empacotar-publica/u);
    assert.deepEqual(await readdir(saida), []);
    assert.equal(await fingerprintCaminhos(alvosWorkspace), antes);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("copiador público rejeita junction ou symlink na origem", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-junction-"));
  try {
    const fontes = path.join(base, "fontes");
    const real = path.join(fontes, "real");
    const reparse = path.join(fontes, "reparse");
    await mkdir(real, { recursive: true });
    const destinoRaiz = path.join(base, "destinos");
    await mkdir(destinoRaiz);
    const controleDestino = await capturarControleDestinoSeguro(destinoRaiz);
    await writeFile(path.join(real, "segredo.txt"), "nao publicar\n", "utf8");
    await symlink(real, reparse, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(
      copiarArvoreFonteSegura(reparse, path.join(destinoRaiz, "destino"), fontes, controleDestino),
      /FONTE_REPARSE_POINT/u,
    );
    assert.equal(existsSync(path.join(destinoRaiz, "destino")), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("saída sob junction falha antes de criar diretório externo", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-output-junction-"));
  const stagesAntes = await listarStagesPublicos();
  try {
    const externo = path.join(base, "externo");
    const alias = path.join(base, "alias");
    await mkdir(externo);
    await symlink(externo, alias, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(main({ saidaDir: path.join(alias, "saida") }), /DIRETORIO_DESTINO_(?:INSEGURO|REPARSE)/u);
    assert.equal(existsSync(path.join(externo, "saida")), false);
    assert.deepEqual(await listarStagesPublicos(), stagesAntes);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("copiador rejeita junction no destino sem escrita externa", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-copy-dest-junction-"));
  try {
    const fonteRaiz = path.join(base, "fontes");
    const fonte = path.join(fonteRaiz, "publico");
    const destinoRaiz = path.join(base, "destinos");
    const externo = path.join(base, "externo");
    await mkdir(fonte, { recursive: true });
    await mkdir(destinoRaiz);
    await mkdir(externo);
    await writeFile(path.join(fonte, "arquivo.txt"), "publico\n", "utf8");
    const controleDestino = await capturarControleDestinoSeguro(destinoRaiz);
    await symlink(externo, path.join(destinoRaiz, "alias"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(
      copiarArvoreFonteSegura(
        fonte,
        path.join(destinoRaiz, "alias", "copia"),
        fonteRaiz,
        controleDestino,
      ),
      /DIRETORIO_DESTINO_(?:INSEGURO|REPARSE)/u,
    );
    assert.equal(existsSync(path.join(externo, "copia")), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("publicação rejeita parent junction sem criar arquivo externo", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-publish-junction-"));
  try {
    const saida = path.join(base, "saida");
    const externo = path.join(base, "externo");
    const candidato = path.join(base, "candidato.tgz");
    await mkdir(saida);
    await mkdir(externo);
    await writeFile(candidato, "pacote", "utf8");
    const controleSaida = await capturarControleDestinoSeguro(saida);
    await symlink(externo, path.join(saida, "alias"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(
      publicarTarballNoReplace(candidato, path.join(saida, "alias", "final.tgz"), controleSaida),
      /DIRETORIO_DESTINO_(?:INSEGURO|REPARSE)/u,
    );
    assert.deepEqual(await readdir(externo), []);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("publicação por hardlink é no-replace sob concorrência", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-publish-"));
  try {
    const a = path.join(base, "a.tgz");
    const b = path.join(base, "b.tgz");
    const final = path.join(base, "final.tgz");
    await writeFile(a, "pacote-a", "utf8");
    await writeFile(b, "pacote-b", "utf8");
    const controleSaida = await capturarControleDestinoSeguro(base);
    const resultados = await Promise.allSettled([
      publicarTarballNoReplace(a, final, controleSaida),
      publicarTarballNoReplace(b, final, controleSaida),
    ]);
    assert.equal(resultados.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(resultados.filter((item) => item.status === "rejected").length, 1);
    assert.ok(["pacote-a", "pacote-b"].includes(await readFile(final, "utf8")));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("fault após temp local não deixa parcial nem temporário", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-publish-fault-"));
  const faultAnterior = process.env.SEMA_PUBLIC_PACK_FAULT;
  try {
    const saida = path.join(base, "saida");
    const candidato = path.join(base, "candidato.tgz");
    await mkdir(saida);
    await writeFile(candidato, "pacote-completo", "utf8");
    const controleSaida = await capturarControleDestinoSeguro(saida);
    process.env.SEMA_PUBLIC_PACK_FAULT = "publish-temp-before-link";
    await assert.rejects(
      publicarTarballNoReplace(candidato, path.join(saida, "final.tgz"), controleSaida),
      /SEMA_PUBLIC_PACK_FAULT_PUBLISH_TEMP_BEFORE_LINK/u,
    );
    assert.deepEqual(await readdir(saida), []);
  } finally {
    if (faultAnterior === undefined) delete process.env.SEMA_PUBLIC_PACK_FAULT;
    else process.env.SEMA_PUBLIC_PACK_FAULT = faultAnterior;
    await rm(base, { recursive: true, force: true });
  }
});

test("publicação funciona entre volumes quando há segundo volume gravável", async (contextoTeste) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-cross-source-"));
  let saida: string | null = null;
  try {
    saida = await criarTemporarioEmSegundoVolume(base);
    if (!saida) {
      contextoTeste.skip("nenhum segundo volume gravável disponível");
      return;
    }
    const candidato = path.join(base, "candidato.tgz");
    const final = path.join(saida, "final.tgz");
    await writeFile(candidato, "pacote-cross-volume", "utf8");
    const controleSaida = await capturarControleDestinoSeguro(saida);
    assert.equal(await publicarTarballNoReplace(candidato, final, controleSaida), "publicado");
    assert.equal(await readFile(final, "utf8"), "pacote-cross-volume");
    assert.deepEqual((await readdir(saida)).filter((nome) => nome.includes(".sema-publish-")), []);
  } finally {
    if (saida) await rm(saida, { recursive: true, force: true });
    await rm(base, { recursive: true, force: true });
  }
});

test("falha durante contexto parcial limpa o runRoot por identidade", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-context-fault-"));
  const saida = path.join(base, "saida");
  await mkdir(saida);
  const stagesAntes = await listarStagesPublicos();
  try {
    const resultado = await executarNodeAsync([packer], {
      ...ambienteIsolado(base),
      SEMA_PUBLIC_PACK_OUTPUT_DIR: saida,
      SEMA_PUBLIC_PACK_FAULT: "context-package-collision",
    });
    assert.notEqual(resultado.codigo, 0);
    assert.match(resultado.saida, /DESTINO_JA_EXISTE/u);
    assert.deepEqual(await listarStagesPublicos(), stagesAntes);
    assert.deepEqual(await readdir(saida), []);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("falha antes da publicação não deixa tgz parcial nem stage", { timeout: 120_000 }, async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-fault-"));
  const saida = path.join(base, "saida");
  await mkdir(saida);
  const stagesAntes = await listarStagesPublicos();
  try {
    const resultado = await executarNodeAsync([packer], {
      ...ambienteIsolado(base),
      SEMA_PUBLIC_PACK_OUTPUT_DIR: saida,
      SEMA_PUBLIC_PACK_FAULT: "before-publish",
    });
    assert.notEqual(resultado.codigo, 0);
    assert.match(resultado.saida, /SEMA_PUBLIC_PACK_FAULT_BEFORE_PUBLISH/u);
    assert.deepEqual(await readdir(saida), []);
    assert.deepEqual(await listarStagesPublicos(), stagesAntes);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("dois packs públicos não contaminam stage e o tarball instala", { timeout: 180_000 }, async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-pack-concorrente-"));
  const saida = path.join(base, "saida");
  await mkdir(saida);
  const stagesAntes = await listarStagesPublicos();
  try {
    const env = { ...ambienteIsolado(base), SEMA_PUBLIC_PACK_OUTPUT_DIR: saida };
    const resultados = await Promise.all([
      executarNodeAsync([packer], env),
      executarNodeAsync([packer], env),
    ]);
    assert.ok(resultados.some((item) => item.codigo === 0), resultados.map((item) => item.saida).join("\n"));
    for (const resultado of resultados.filter((item) => item.codigo !== 0)) {
      assert.match(resultado.saida, /PACOTE_FINAL_JA_EXISTE_DIVERGENTE/u);
    }
    const pacotes = (await readdir(saida)).filter((nome) => nome.endsWith(".tgz"));
    assert.equal(pacotes.length, 1);
    const manifestoFonte = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
    const tarball = path.join(saida, pacotes[0]);
    validarManifestSemDependenciasFile(tarball, manifestoFonte.version, raiz);
    await validarArtefatosDistribuicaoContraFonte(tarball, raiz);
    validarRuntimeLocalDireto(tarball, raiz);

    const sandbox = path.join(base, "instalacao");
    await mkdir(sandbox);
    await writeFile(path.join(sandbox, "package.json"), "{\"name\":\"smoke\",\"private\":true}\n", "utf8");
    const npmExecpath = resolverNpmExecpath();
    const instalacao = spawnSync(process.execPath, [
      npmExecpath,
      "install",
      tarball,
      path.join(raiz, "node_modules", "typescript"),
      "--no-audit",
      "--no-fund",
      "--offline",
      "--cache",
      path.join(base, "cache-install"),
    ], {
      cwd: sandbox,
      env: ambienteIsolado(path.join(base, "install-env")),
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(instalacao.status, 0, instalacao.stderr || instalacao.stdout);
    const versao = spawnSync(process.execPath, [
      path.join(sandbox, "node_modules", "@semacode", "cli", "dist", "index.js"),
      "--version",
    ], { cwd: sandbox, encoding: "utf8", windowsHide: true });
    assert.equal(versao.status, 0, versao.stderr);
    assert.equal(versao.stdout.trim(), manifestoFonte.version);
    assert.deepEqual(await listarStagesPublicos(), stagesAntes);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
