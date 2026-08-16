// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: prova que drift dirigido planeja antes de catalogar e nao toca codigo lateral.

import assert from "node:assert/strict";
import { renameSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analisarDriftLegado } from "../../pacotes/cli/src/drift.part11.js";
import type { EventoOperacaoDrift } from "../../pacotes/cli/src/driftCatalogo.js";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";

async function criarWorkspaceEscopo(): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-escopo-io-"));
  for (const diretorio of ["contratos", "app", "firecrawl-local", "training", "dumps"]) {
    await mkdir(path.join(base, diretorio), { recursive: true });
  }
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    diretoriosCodigo: ["./app", "./firecrawl-local", "./training", "./dumps"],
    fontesLegado: ["python"],
  }, null, 2), "utf8");
  await writeFile(path.join(base, "app", "social_copy_rules.py"), [
    "def validar_copy(texto):",
    "    return bool(texto)",
    "",
  ].join("\n"), "utf8");
  await writeFile(path.join(base, "app", "social_distribution.py"), [
    "def distribuir(texto):",
    "    return {'ok': bool(texto)}",
    "",
  ].join("\n"), "utf8");
  await writeFile(path.join(base, "firecrawl-local", "crawler.ts"), "export const lateral = true;\n", "utf8");
  await writeFile(path.join(base, "training", "modelo.py"), "MODELO_LATERAL = True\n", "utf8");
  await writeFile(path.join(base, "dumps", "hospedagem.sql"), "INSERT INTO lateral VALUES ('nao abrir');\n", "utf8");
  await writeFile(path.join(base, "contratos", "lateral.sema"), "module app.lateral { type Lateral { valor: Texto } }\n", "utf8");
  await writeFile(path.join(base, "contratos", "social_copywriting.sema"), `module app.social_copywriting {
  vinculos {
    arquivo: "app/social_copy_rules.py"
    arquivo: "app/social_distribution.py"
  }

  task validar_copy {
    input { texto: Texto required }
    output { valido: Booleano }
    impl { py: app.social_copy_rules.validar_copy }
    guarantees { valido existe }
  }

  task distribuir_copy {
    input { texto: Texto required }
    output { ok: Booleano }
    impl { py: app.social_distribution.distribuir }
    guarantees { ok existe }
  }
}
`, "utf8");
  await writeFile(path.join(base, "contratos", "sem_ancora.sema"), `module app.sem_ancora {
  task descrever { output { ok: Booleano } guarantees { ok existe } }
}
`, "utf8");
  return base;
}

test("drift de contrato focado nao visita codigo lateral nem dump SQL", async () => {
  const base = await criarWorkspaceEscopo();
  try {
    const contexto = await carregarProjeto("contratos/social_copywriting.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const eventos: EventoOperacaoDrift[] = [];
    const resultado = await analisarDriftLegado(contexto, {
      escopo: "modulo",
      observador: (evento) => eventos.push(evento),
    });

    assert.equal(contexto.arquivosProjeto.length, 1);
    assert.equal(resultado.escopo_aplicado.estrategia, "arquivos_vinculados");
    assert.deepEqual(resultado.escopo_aplicado.arquivosPlanejados, [
      "app/social_copy_rules.py",
      "app/social_distribution.py",
    ]);
    assert.equal(resultado.escopo_aplicado.catalogo?.diretoriosVisitados, 0);
    assert.equal(resultado.escopo_aplicado.catalogo?.arquivosCatalogados, 2);
    assert.equal(resultado.escopo_aplicado.catalogo?.leiturasConteudo, 2);
    assert.equal(resultado.impls_quebrados.length, 0);
    assert.equal(resultado.impls_validos.length, 2);

    const caminhosTocados = eventos.map((evento) => evento.caminho ?? "").join("\n");
    assert.doesNotMatch(caminhosTocados, /firecrawl-local|training|hospedagem\.sql/u);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("escopo projeto caminha uma vez e compartilha uma leitura por arquivo", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-catalogo-projeto-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "app", "dados"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app"],
      fontesLegado: ["typescript", "python"],
    }, null, 2), "utf8");
    await writeFile(path.join(base, "contratos", "projeto.sema"), [
      "module app.projeto {",
      "  type Registro { id: Texto }",
      "}",
      "",
    ].join("\n"), "utf8");
    await writeFile(path.join(base, "app", "api.ts"), "export function listar() { return []; }\n", "utf8");
    await writeFile(path.join(base, "app", "worker.py"), "def executar():\n    return True\n", "utf8");
    await writeFile(path.join(base, "app", "dados", "schema.sql"), "CREATE TABLE registros (id TEXT PRIMARY KEY);\n", "utf8");

    const contexto = await carregarProjeto("contratos/projeto.sema", base, { escopo: "projeto" });
    const eventos: EventoOperacaoDrift[] = [];
    const resultado = await analisarDriftLegado(contexto, {
      escopo: "projeto",
      observador: (evento) => eventos.push(evento),
    });
    const visitas = eventos
      .filter((evento) => evento.tipo === "catalog.visit" && evento.categoria === "diretorio")
      .map((evento) => path.relative(base, evento.caminho ?? "").replace(/\\/g, "/"));
    const leituras = eventos
      .filter((evento) => evento.tipo === "content.read")
      .map((evento) => path.relative(base, evento.caminho ?? "").replace(/\\/g, "/"))
      .sort();

    assert.deepEqual(visitas.sort(), ["app", "app/dados"]);
    assert.equal(new Set(visitas).size, visitas.length);
    assert.equal(resultado.escopo_aplicado.catalogo?.origem, "caminhada");
    assert.equal(resultado.escopo_aplicado.catalogo?.diretoriosVisitados, 2);
    assert.deepEqual(leituras, ["app/api.ts", "app/dados/schema.sql", "app/worker.py"]);
    assert.equal(new Set(leituras).size, leituras.length);
    assert.equal(resultado.escopo_aplicado.catalogo?.leiturasConteudo, 3);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("escopo projeto resolve arquivos declarados fora das raizes de codigo sem caminhar seus diretorios", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-projeto-vinculos-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "app"), { recursive: true });
    await mkdir(path.join(base, "assets"), { recursive: true });
    await mkdir(path.join(base, "fixtures"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app"],
      fontesLegado: ["typescript"],
    }, null, 2), "utf8");
    await writeFile(path.join(base, "app", "modulo.ts"), "export const modulo = true;\n", "utf8");
    await writeFile(path.join(base, "LICENSE"), "licenca de teste\n", "utf8");
    await writeFile(path.join(base, "assets", "logo.png"), "asset de teste\n", "utf8");
    await writeFile(path.join(base, "fixtures", "payload.json"), "{}\n", "utf8");
    await writeFile(path.join(base, "contratos", "projeto.sema"), `module app.projeto {
  vinculos {
    arquivo: "LICENSE"
    arquivo: "assets/logo.png"
    arquivo: "fixtures/payload.json"
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/projeto.sema", base, { escopo: "projeto" });
    const eventos: EventoOperacaoDrift[] = [];
    const resultado = await analisarDriftLegado(contexto, {
      escopo: "projeto",
      observador: (evento) => eventos.push(evento),
    });
    const vinculos = resultado.vinculos_validos
      .map((vinculo) => vinculo.valor)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const diretoriosVisitados = eventos
      .filter((evento) => evento.tipo === "catalog.visit" && evento.categoria === "diretorio")
      .map((evento) => path.relative(base, evento.caminho ?? "").replace(/\\/g, "/"));

    assert.deepEqual(resultado.vinculos_quebrados, []);
    assert.deepEqual(vinculos, ["assets/logo.png", "fixtures/payload.json", "LICENSE"]);
    assert.deepEqual(diretoriosVisitados, ["app"]);
    assert.equal(resultado.escopo_aplicado.catalogo?.arquivosCatalogados, 4);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("orcamento reutiliza bytes catalogados sem reabrir a fonte", async () => {
  const base = await criarWorkspaceEscopo();
  const arquivo = path.join(base, "app", "social_copy_rules.py");
  const movido = `${arquivo}.movido`;
  try {
    await writeFile(arquivo, [
      "def validar_copy(texto):",
      "    return bool(texto)",
      ...Array.from({ length: 2_010 }, (_, indice) => `# linha de carga ${indice + 1}`),
      "",
    ].join("\n"), "utf8");
    const contexto = await carregarProjeto("contratos/social_copywriting.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    let removeuDepoisDaLeitura = false;
    const resultado = await analisarDriftLegado(contexto, {
      escopo: "modulo",
      observador: (evento) => {
        if (!removeuDepoisDaLeitura
          && evento.tipo === "content.read"
          && evento.caminho
          && path.resolve(evento.caminho) === path.resolve(arquivo)) {
          renameSync(arquivo, movido);
          removeuDepoisDaLeitura = true;
        }
      },
    });

    assert.equal(removeuDepoisDaLeitura, true);
    assert.equal(resultado.impls_quebrados.length, 0);
    assert.equal(resultado.diagnosticos.some((diagnostico) =>
      diagnostico.tipo === "codigo_monolitico"
      && diagnostico.arquivo === "app/social_copy_rules.py"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("escopo estreito sem ancora falha antes de caminhar codigo", async () => {
  const base = await criarWorkspaceEscopo();
  try {
    const contexto = await carregarProjeto("contratos/sem_ancora.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const eventos: EventoOperacaoDrift[] = [];
    const resultado = await analisarDriftLegado(contexto, {
      escopo: "modulo",
      observador: (evento) => eventos.push(evento),
    });

    assert.equal(resultado.sucesso, false);
    assert.deepEqual(resultado.escopo_aplicado.bloqueios, ["escopo_estreito_sem_vinculos"]);
    assert.equal(resultado.escopo_aplicado.catalogo?.diretoriosVisitados, 0);
    assert.equal(resultado.escopo_aplicado.catalogo?.arquivosCatalogados, 0);
    assert.equal(eventos.length, 0);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("origem js planeja arquivo TypeScript aceito pelo resolvedor", async () => {
  const base = await criarWorkspaceEscopo();
  try {
    await writeFile(path.join(base, "app", "typed_impl.ts"), [
      "export function executar() {",
      "  return { ok: true };",
      "}",
      "",
    ].join("\n"), "utf8");
    await writeFile(path.join(base, "contratos", "typed_impl.sema"), `module app.typed_impl {
  task executar {
    output { ok: Booleano }
    impl { js: app.typed_impl.executar }
    guarantees { ok existe }
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/typed_impl.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const resultado = await analisarDriftLegado(contexto, { escopo: "modulo" });

    assert.deepEqual(resultado.escopo_aplicado.arquivosPlanejados, ["app/typed_impl.ts"]);
    assert.equal(resultado.escopo_aplicado.cobertura, "completa");
    assert.equal(resultado.impls_quebrados.length, 0);
    assert.equal(resultado.impls_validos.length, 1);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("drift focado sem config encontra src por raiz logica sem caminhada previa", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-sem-config-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "src"), { recursive: true });
    await writeFile(path.join(base, "src", "app.ts"), "export function executar() { return { ok: true }; }\n", "utf8");
    await writeFile(path.join(base, "contratos", "app.sema"), `module app.servico {
  task executar {
    output { ok: Booleano }
    impl { ts: app.executar }
    vinculos { simbolo: app.executar }
    guarantees { ok existe }
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/app.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const resultado = await analisarDriftLegado(contexto, { escopo: "modulo" });

    assert.deepEqual(contexto.fontesLegado, []);
    assert.equal(contexto.diretoriosCodigo.includes(path.resolve(base, "src")), true);
    assert.deepEqual(resultado.escopo_aplicado.arquivosPlanejados, ["src/app.ts"]);
    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.impls_validos.length, 1);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("implementacao sem candidato deixa cobertura parcial e preserva ancora valida", async () => {
  const base = await criarWorkspaceEscopo();
  try {
    await writeFile(path.join(base, "app", "ancora.py"), "def ancora():\n    return True\n", "utf8");
    await writeFile(path.join(base, "contratos", "parcial.sema"), `module app.parcial {
  vinculos { arquivo: "app/ancora.py" }
  task executar {
    output { ok: Booleano }
    impl { py: app.inexistente.executar }
    guarantees { ok existe }
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/parcial.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const resultado = await analisarDriftLegado(contexto, { escopo: "modulo" });

    assert.deepEqual(resultado.escopo_aplicado.arquivosPlanejados, ["app/ancora.py"]);
    assert.deepEqual(resultado.escopo_aplicado.arquivosAusentes, ["app/inexistente.py"]);
    assert.equal(resultado.escopo_aplicado.cobertura, "parcial");
    assert.deepEqual(resultado.escopo_aplicado.bloqueios, []);
    assert.equal(resultado.impls_quebrados.length, 1);
    assert.equal(resultado.sucesso, false);
    assert.equal(resultado.diagnosticos.some((diagnostico) =>
      diagnostico.tipo === "vinculo_quebrado"
      && diagnostico.arquivo === "app/inexistente.py"
      && diagnostico.severidade === "erro"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("vinculo declarado prevalece sobre inferencia do mesmo arquivo", async () => {
  const base = await criarWorkspaceEscopo();
  try {
    await writeFile(path.join(base, "app", "declarado.py"), "def executar():\n    return {'ok': True}\n", "utf8");
    await writeFile(path.join(base, "contratos", "declarado.sema"), `module app.declarado {
  vinculos { arquivo: "app/declarado.py" }
  task executar {
    output { ok: Booleano }
    impl { py: app.declarado.executar }
    guarantees { ok existe }
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/declarado.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const resultado = await analisarDriftLegado(contexto, { escopo: "modulo" });

    assert.deepEqual(resultado.escopo_aplicado.arquivosPlanejados, ["app/declarado.py"]);
    assert.deepEqual(resultado.escopo_aplicado.arquivosDeclarados, ["app/declarado.py"]);
    assert.deepEqual(resultado.escopo_aplicado.arquivosInferidos, []);
    assert.equal(resultado.impls_validos.length, 1);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("vinculo explicito impede que simbolo homonimo lateral sobrescreva a implementacao", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-homonimo-explicito-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "app"), { recursive: true });
    await mkdir(path.join(base, "other"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app", "./other"],
    }), "utf8");
    await writeFile(path.join(base, "app", "health.ts"), "export function executar() { return { ok: true }; }\n", "utf8");
    await writeFile(path.join(base, "other", "health.ts"), "export function executar() { return { ok: false }; }\n", "utf8");
    await writeFile(path.join(base, "contratos", "health.sema"), `module app.health {
  vinculos { arquivo: "app/health.ts" }
  task executar {
    output { ok: Booleano }
    impl { ts: health.executar }
    vinculos { simbolo: health.executar }
    guarantees { ok existe }
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/health.sema", base, { escopo: "projeto", adiarDescobertaCodigo: true });
    const resultado = await analisarDriftLegado(contexto, { escopo: "projeto" });

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.escopo_aplicado.estrategia, "projeto");
    assert.equal(resultado.escopo_aplicado.catalogo?.origem, "caminhada");
    assert.equal((resultado.escopo_aplicado.catalogo?.arquivosCatalogados ?? 0) >= 2, true);
    assert.equal(
      path.resolve(resultado.impls_validos[0]?.arquivo ?? ""),
      path.resolve(base, "app", "health.ts"),
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("implementacao homonima sem vinculo falha como escopo ambiguo antes da leitura", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-homonimo-ambiguo-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "app"), { recursive: true });
    await mkdir(path.join(base, "other"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app", "./other"],
    }), "utf8");
    await writeFile(path.join(base, "app", "health.ts"), "export function executar() { return { ok: true }; }\n", "utf8");
    await writeFile(path.join(base, "other", "health.ts"), "export function executar() { return { ok: false }; }\n", "utf8");
    await writeFile(path.join(base, "contratos", "health.sema"), `module app.health {
  task executar {
    output { ok: Booleano }
    impl { ts: health.executar }
    guarantees { ok existe }
  }
}
`, "utf8");
    const eventos: EventoOperacaoDrift[] = [];

    const contexto = await carregarProjeto("contratos/health.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const resultado = await analisarDriftLegado(contexto, {
      escopo: "modulo",
      observador: (evento) => eventos.push(evento),
    });

    assert.equal(resultado.sucesso, false);
    assert.deepEqual(resultado.escopo_aplicado.arquivosPlanejados, []);
    assert.deepEqual(resultado.escopo_aplicado.bloqueios, ["escopo_estreito_ambiguo"]);
    assert.equal(resultado.diagnosticos.some(({ tipo }) => tipo === "escopo_estreito_ambiguo"), true);
    assert.deepEqual(eventos, []);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("escopo projeto preserva candidatos homonimos e falha sem escolher o ultimo", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-homonimo-projeto-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "app"), { recursive: true });
    await mkdir(path.join(base, "other"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app", "./other"],
    }), "utf8");
    await writeFile(path.join(base, "app", "health.ts"), "export function executar() { return { ok: true }; }\n", "utf8");
    await writeFile(path.join(base, "other", "health.ts"), "export function executar() { return { ok: false }; }\n", "utf8");
    await writeFile(path.join(base, "contratos", "health.sema"), `module app.health {
  task executar {
    output { ok: Booleano }
    impl { ts: health.executar }
    guarantees { ok existe }
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/health.sema", base, {
      escopo: "projeto",
      adiarDescobertaCodigo: true,
    });
    const resultado = await analisarDriftLegado(contexto, { escopo: "projeto" });
    const arquivosCandidatos = resultado.impls_quebrados[0]?.candidatos
      ?.map((candidato) => path.relative(base, candidato.arquivo).replace(/\\/g, "/"))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    assert.equal(resultado.sucesso, false);
    assert.equal(resultado.impls_validos.length, 0);
    assert.equal(resultado.impls_quebrados.length, 1);
    assert.deepEqual(arquivosCandidatos, ["app/health.ts", "other/health.ts"]);
    assert.equal(resultado.escopo_aplicado.bloqueios?.includes("escopo_estreito_ambiguo"), true);
    assert.equal(resultado.diagnosticos.some((diagnostico) =>
      diagnostico.tipo === "escopo_estreito_ambiguo"
      && diagnostico.task === "executar"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("origens diferentes com o mesmo caminho semantico resolvem sem misturar candidatos", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-origens-homonimas-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "ts"), { recursive: true });
    await mkdir(path.join(base, "py"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./ts", "./py"],
    }), "utf8");
    await writeFile(path.join(base, "ts", "health.ts"), "export function executar() { return true; }\n", "utf8");
    await writeFile(path.join(base, "py", "health.py"), "def executar():\n    return True\n", "utf8");
    await writeFile(path.join(base, "contratos", "health.sema"), `module app.health {
  task executar_ts {
    output { ok: Booleano }
    impl { ts: health.executar }
    vinculos { arquivo: "ts/health.ts" }
    guarantees { ok existe }
  }
  task executar_py {
    output { ok: Booleano }
    impl { py: health.executar }
    vinculos { arquivo: "py/health.py" }
    guarantees { ok existe }
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/health.sema", base, {
      escopo: "projeto",
      adiarDescobertaCodigo: true,
    });
    const resultado = await analisarDriftLegado(contexto, { escopo: "projeto" });
    const arquivosPorOrigem = new Map(resultado.impls_validos.map((impl) => [
      impl.origem,
      path.relative(base, impl.arquivo ?? "").replace(/\\/g, "/"),
    ]));

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.impls_quebrados.length, 0);
    assert.equal(resultado.impls_validos.length, 2);
    assert.equal(arquivosPorOrigem.get("ts"), "ts/health.ts");
    assert.equal(arquivosPorOrigem.get("py"), "py/health.py");
    assert.equal(resultado.diagnosticos.some(({ tipo }) => tipo === "escopo_estreito_ambiguo"), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("planejador rejeita vinculo que escapa por junction ou symlink", async (t) => {
  const base = await criarWorkspaceEscopo();
  const externo = await mkdtemp(path.join(os.tmpdir(), "sema-drift-escopo-externo-"));
  try {
    const atalho = path.join(base, "app", "escape");
    await writeFile(path.join(externo, "segredo.py"), "SEGREDO = True\n", "utf8");
    try {
      await symlink(externo, atalho, process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "UNKNOWN"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente nao permite criar junction/symlink para a regressao de realpath");
        return;
      }
      throw erro;
    }
    await writeFile(path.join(base, "contratos", "escape.sema"), `module app.escape {
  vinculos { arquivo: "app/escape/segredo.py" }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/escape.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const eventos: EventoOperacaoDrift[] = [];
    const resultado = await analisarDriftLegado(contexto, {
      escopo: "modulo",
      observador: (evento) => eventos.push(evento),
    });

    assert.equal(resultado.escopo_aplicado.cobertura, "parcial");
    assert.deepEqual(resultado.escopo_aplicado.arquivosPlanejados, []);
    assert.deepEqual(resultado.escopo_aplicado.arquivosAusentes, ["app/escape/segredo.py"]);
    assert.deepEqual(resultado.escopo_aplicado.bloqueios, ["escopo_estreito_sem_vinculos"]);
    assert.equal(eventos.length, 0);
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externo, { recursive: true, force: true });
  }
});
