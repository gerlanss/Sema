// SEMA-GOVERNED: sema.produto.cli_verificacao
// Descricao: prova o cache incremental de verificacao e o aviso de escopo por stack.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  calcularChaveVerificacao,
  carregarCacheVerificacao,
  gravarCacheVerificacao,
  SCHEMA_CACHE_VERIFICACAO,
} from "../../pacotes/cli/src/verificacaoCache.js";
import { avisoEscopoStackVerificacao } from "../../pacotes/cli/src/index.part07.js";

const bases = {
  versaoCli: "3.3.0",
  versaoNode: "v22",
  modulo: "demo.modulo",
  alvo: "typescript",
  framework: "base",
  estrutura: "modulos",
};

test("chave de verificacao e deterministica e sensivel ao conteudo do contrato", () => {
  const a = calcularChaveVerificacao({ ...bases, conteudoContrato: "entity A {}" });
  const b = calcularChaveVerificacao({ ...bases, conteudoContrato: "entity A {}" });
  const c = calcularChaveVerificacao({ ...bases, conteudoContrato: "entity B {}" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("cache hit reusa resultado com arquivos presentes e invalida com arquivo removido", async () => {
  const raiz = await mkdtemp(path.join(tmpdir(), "sema-verif-cache-"));
  const pastaAlvo = path.join(raiz, "saida", "typescript", "demo");
  await mkdir(pastaAlvo, { recursive: true });
  await writeFile(path.join(pastaAlvo, "demo.ts"), "export {};\n");

  const chave = calcularChaveVerificacao({ ...bases, conteudoContrato: "entity A {}" });
  await gravarCacheVerificacao({
    schemaVersion: SCHEMA_CACHE_VERIFICACAO,
    chave,
    versaoCli: bases.versaoCli,
    alvo: bases.alvo,
    modulo: bases.modulo,
    sucesso: true,
    quantidadeTestes: 4,
    testesExecutados: true,
    arquivosGerados: ["demo.ts"],
    geradoEm: new Date().toISOString(),
  }, raiz);

  const hit = await carregarCacheVerificacao(chave, pastaAlvo, raiz);
  assert.ok(hit);
  assert.equal(hit.sucesso, true);
  assert.equal(hit.quantidadeTestes, 4);

  await rm(path.join(pastaAlvo, "demo.ts"), { force: true });
  const aposRemocao = await carregarCacheVerificacao(chave, pastaAlvo, raiz);
  assert.equal(aposRemocao, undefined);

  await rm(raiz, { recursive: true, force: true });
});

test("cache e gravado fora do workspace do projeto", async () => {
  const raiz = await mkdtemp(path.join(tmpdir(), "sema-verif-raiz-"));
  const chave = calcularChaveVerificacao({ ...bases, conteudoContrato: "entity C {}" });
  await gravarCacheVerificacao({
    schemaVersion: SCHEMA_CACHE_VERIFICACAO,
    chave,
    versaoCli: bases.versaoCli,
    alvo: bases.alvo,
    modulo: bases.modulo,
    sucesso: true,
    quantidadeTestes: 1,
    testesExecutados: true,
    arquivosGerados: [],
    geradoEm: new Date().toISOString(),
  }, raiz);
  const caminhoManifesto = path.join(raiz, "verificacao", `${chave}.json`);
  const lido = await carregarCacheVerificacao(chave, path.join(raiz, "saida"), raiz);
  assert.ok(lido, `manifesto esperado em ${caminhoManifesto}`);
  await rm(raiz, { recursive: true, force: true });
});

test("aviso de escopo acusa alvos fora da stack e respeita alvo unico", () => {
  const aviso = avisoEscopoStackVerificacao(["typescript", "express"], ["typescript", "python", "dart", "lua", "html"]);
  assert.ok(aviso);
  assert.ok(aviso!.includes("python"));
  assert.ok(aviso!.includes("dart"));
  assert.ok(!aviso!.includes("html"));

  const semAviso = avisoEscopoStackVerificacao(["typescript", "express"], ["typescript"]);
  assert.equal(semAviso, undefined);

  const semFontes = avisoEscopoStackVerificacao(undefined, ["lua"]);
  assert.equal(semFontes, undefined);
});

test("template base do iniciar declara apenas typescript e javascript", async () => {
  const { arquivosTemplateIniciar } = await import("../../pacotes/cli/src/initTemplatesBase.js");
  const config = arquivosTemplateIniciar("base").find((arquivo) => arquivo.caminhoRelativo === "sema.config.json");
  assert.ok(config);
  const parsed = JSON.parse(config!.conteudo);
  assert.deepEqual(parsed.alvos, ["typescript", "javascript"]);
});
