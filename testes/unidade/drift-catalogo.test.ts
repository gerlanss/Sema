// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: prova deduplicacao, leitura fisica unica e confinamento real do catalogo efemero.

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  criarCatalogoDrift,
  type EventoOperacaoDrift,
} from "../../pacotes/cli/src/driftCatalogo.js";

test("catalogo deduplica caminhos e compartilha uma unica leitura fisica concorrente", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-"));
  try {
    await mkdir(path.join(base, "src"), { recursive: true });
    const arquivo = path.join(base, "src", "modulo.ts");
    await writeFile(arquivo, "export const valor = 1;\n", "utf8");
    const eventos: EventoOperacaoDrift[] = [];
    const duplicados = process.platform === "win32"
      ? [arquivo, arquivo.toUpperCase(), path.join(base, "src", ".", "modulo.ts")]
      : [arquivo, path.join(base, "src", ".", "modulo.ts")];
    const catalogo = await criarCatalogoDrift({
      baseDiretorio: base,
      arquivos: duplicados,
      observador: (evento) => eventos.push(evento),
    });

    const [texto, digest, conteudo] = await Promise.all([
      catalogo.lerTexto(arquivo),
      catalogo.digest(arquivo),
      catalogo.ler(arquivo),
    ]);

    assert.equal(texto, "export const valor = 1;\n");
    assert.equal(digest, conteudo.digest);
    assert.deepEqual(catalogo.arquivosCatalogados(), [arquivo]);
    assert.equal(eventos.filter((evento) => evento.tipo === "content.read").length, 1);
    assert.equal(catalogo.metricas().leiturasConteudo, 1);
    assert.equal(catalogo.metricas().acertosMemoriaConteudo, 2);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("catalogo falha fechado quando arquivo muda entre abertura e leitura", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-toctou-"));
  try {
    const arquivo = path.join(base, "alvo.ts");
    await writeFile(arquivo, "export const valor = 1;\n", "utf8");
    let alterou = false;
    const catalogo = await criarCatalogoDrift({
      baseDiretorio: base,
      arquivos: [arquivo],
      observador: (evento) => {
        if (!alterou && evento.tipo === "content.open") {
          alterou = true;
          writeFileSync(arquivo, "export const valor = 'conteudo alterado durante abertura';\n", "utf8");
        }
      },
    });

    await assert.rejects(
      catalogo.lerTexto(arquivo),
      /mudou durante (?:abertura|leitura) segura/u,
    );
    assert.equal(alterou, true);
    assert.equal(catalogo.metricas().leiturasConteudo, 0);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("catalogo guarda identidade ate a primeira leitura", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-baseline-"));
  try {
    const arquivo = path.join(base, "alvo.ts");
    await writeFile(arquivo, "export const valor = 1;\n", "utf8");
    const catalogo = await criarCatalogoDrift({ baseDiretorio: base, arquivos: [arquivo] });
    await writeFile(arquivo, "export const valor = 'alterado depois do catalogo';\n", "utf8");

    await assert.rejects(
      catalogo.lerTexto(arquivo),
      /mudou entre catalogacao e primeira leitura/u,
    );
    assert.equal(catalogo.metricas().leiturasConteudo, 0);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("catalogo rejeita hardlink que pode ter alias fora do workspace", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-hardlink-workspace-"));
  const externo = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-hardlink-externo-"));
  try {
    const original = path.join(externo, "segredo.ts");
    const alias = path.join(base, "alias.ts");
    await writeFile(original, "export const segredo = 'NAO_LER_FORA';\n", "utf8");
    try {
      await link(original, alias);
    } catch (erro) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("filesystem nao permite hardlink");
        return;
      }
      throw erro;
    }
    const eventos: EventoOperacaoDrift[] = [];
    const catalogo = await criarCatalogoDrift({
      baseDiretorio: base,
      arquivos: [alias],
      observador: (evento) => eventos.push(evento),
    });

    assert.equal(catalogo.arquivosCatalogados().length, 0);
    assert.equal(catalogo.contem(alias), false);
    assert.equal(eventos.filter((evento) => evento.tipo === "content.read").length, 0);
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externo, { recursive: true, force: true });
  }
});

test("catalogo deduplica alias interno por realpath", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-realpath-"));
  try {
    const real = path.join(base, "real");
    const atalho = path.join(base, "atalho");
    await mkdir(real, { recursive: true });
    const direto = path.join(real, "modulo.ts");
    await writeFile(direto, "export const valor = 1;\n", "utf8");
    try {
      await symlink(real, atalho, process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "UNKNOWN"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente nao permite junction/symlink");
        return;
      }
      throw erro;
    }
    const logico = path.join(atalho, "modulo.ts");
    const catalogo = await criarCatalogoDrift({ baseDiretorio: base, arquivos: [direto, logico] });

    assert.equal(catalogo.arquivosCatalogados().length, 1);
    assert.equal(catalogo.contem(direto), true);
    assert.equal(catalogo.contem(logico), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("catalogo nao segue junction ou symlink para fora do workspace", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-base-"));
  const externo = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-externo-"));
  try {
    const segredo = path.join(externo, "segredo.ts");
    await writeFile(segredo, "export const segredo = true;\n", "utf8");
    const atalho = path.join(base, "escape");
    try {
      await symlink(externo, atalho, process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "UNKNOWN"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente nao permite criar junction/symlink");
        return;
      }
      throw erro;
    }
    const logico = path.join(atalho, "segredo.ts");
    const eventos: EventoOperacaoDrift[] = [];
    const catalogo = await criarCatalogoDrift({
      baseDiretorio: base,
      arquivos: [logico],
      raizes: [atalho],
      observador: (evento) => eventos.push(evento),
    });

    assert.deepEqual(catalogo.arquivosCatalogados(), []);
    await assert.rejects(catalogo.lerTexto(logico), /fora do plano explicito/u);
    assert.equal(eventos.some((evento) => evento.caminho?.startsWith(externo)), false);
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externo, { recursive: true, force: true });
  }
});

test("raizes sobrepostas visitam cada diretorio e catalogam cada arquivo uma vez", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-raizes-"));
  try {
    await mkdir(path.join(base, "src", "sub"), { recursive: true });
    await writeFile(path.join(base, "src", "um.ts"), "export const um = 1;\n", "utf8");
    await writeFile(path.join(base, "src", "sub", "dois.ts"), "export const dois = 2;\n", "utf8");
    const eventos: EventoOperacaoDrift[] = [];
    const catalogo = await criarCatalogoDrift({
      baseDiretorio: base,
      raizes: ["src", "src/sub", "src"],
      extensoes: [".ts"],
      observador: (evento) => eventos.push(evento),
    });
    const visitas = eventos.filter((evento) =>
      evento.tipo === "catalog.visit" && evento.categoria === "diretorio",
    );

    assert.equal(visitas.length, 2);
    assert.equal(new Set(visitas.map((evento) => evento.caminho?.toLowerCase())).size, 2);
    assert.equal(catalogo.arquivosCatalogados().length, 2);
    assert.equal(catalogo.metricas().arquivosCatalogados, 2);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("catalogo inclui vinculos explicitos fora do filtro sem ampliar a caminhada", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-explicitos-"));
  try {
    await mkdir(path.join(base, "src"), { recursive: true });
    await mkdir(path.join(base, "assets"), { recursive: true });
    const codigo = path.join(base, "src", "modulo.ts");
    const lateralIgnorado = path.join(base, "src", "lateral.png");
    const licenca = path.join(base, "LICENSE");
    const logo = path.join(base, "assets", "logo.png");
    await writeFile(codigo, "export const valor = 1;\n", "utf8");
    await writeFile(lateralIgnorado, "nao catalogar por caminhada\n", "utf8");
    await writeFile(licenca, "licenca de teste\n", "utf8");
    await writeFile(logo, "asset declarado\n", "utf8");

    const catalogo = await criarCatalogoDrift({
      baseDiretorio: base,
      arquivos: [licenca, logo],
      raizes: ["src"],
      extensoes: [".ts"],
    });

    assert.equal(catalogo.contem(codigo), true);
    assert.equal(catalogo.contem(licenca), true);
    assert.equal(catalogo.contem(logo), true);
    assert.equal(catalogo.contem(lateralIgnorado), false);
    assert.equal(catalogo.metricas().diretoriosVisitados, 1);
    assert.equal(catalogo.metricas().arquivosCatalogados, 3);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
