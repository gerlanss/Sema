// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: cobre planejamento fisico estreito e fechamento local de dependencias sem caminhada global.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { criarCatalogoDrift } from "../../pacotes/cli/src/driftCatalogo.js";
import {
  expandirDependenciasPlanoDrift,
  extrairReferenciasLocaisDrift,
  planejarEscopoDrift,
} from "../../pacotes/cli/src/driftEscopo.js";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";

async function criarWorkspace(codigoEntrada: string): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-escopo-deps-"));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await mkdir(path.join(base, "src"), { recursive: true });
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    diretoriosCodigo: ["./src"],
    fontesLegado: ["typescript", "python"],
  }, null, 2), "utf8");
  await writeFile(path.join(base, "contratos", "app.sema"), `module app.dependencias {
  vinculos { arquivo: "src/entrada.ts" }
  task executar {
    output { ok: Booleano }
    impl { ts: src.entrada.executar }
    guarantees { ok existe }
  }
}
`, "utf8");
  await writeFile(path.join(base, "src", "entrada.ts"), codigoEntrada, "utf8");
  return base;
}

test("extrator preserva import dinamico com template literal estatico e mascara templates falsos", () => {
  const referencias = extrairReferenciasLocaisDrift([
    'import { direto } from "./direto.js";',
    "const dinamico = import(`./dinamico.js`);",
    "const texto = `exemplo import(\"./falso.js\")`;",
    "const nome = 'variavel';",
    "const interpolado = import(`./${nome}.js`);",
    '// import "./comentado.js";',
    "/* require('./comentado-tambem.js') */",
    "",
  ].join("\n"));

  assert.deepEqual(referencias.sort(), ["./dinamico.js", "./direto.js"]);
});

test("fechamento inclui dependencias locais uma vez e marca referencia ausente como cobertura parcial", async () => {
  const base = await criarWorkspace([
    'import { dep } from "./dep.js";',
    'import { alias } from "@/alias.js";',
    "const lazy = import(`./lazy.js`);",
    'import "./ausente.js";',
    "export function executar() { return { ok: dep && alias && lazy }; }",
    "",
  ].join("\n"));
  try {
    await writeFile(path.join(base, "src", "dep.ts"), "export const dep = true;\n", "utf8");
    await writeFile(path.join(base, "src", "alias.ts"), "export const alias = true;\n", "utf8");
    await writeFile(path.join(base, "src", "lazy.ts"), "export default true;\n", "utf8");
    const contexto = await carregarProjeto("contratos/app.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });
    const catalogo = await criarCatalogoDrift({
      baseDiretorio: base,
      arquivos: plano.arquivos,
    });
    const expandido = await expandirDependenciasPlanoDrift(contexto, plano, catalogo);
    const relativos = expandido.arquivos
      .map((arquivo) => path.relative(base, arquivo).replace(/\\/g, "/"))
      .sort();
    const ausentes = expandido.arquivosAusentes
      .map((arquivo) => path.relative(base, arquivo).replace(/\\/g, "/"));

    assert.deepEqual(relativos, ["src/alias.ts", "src/dep.ts", "src/entrada.ts", "src/lazy.ts"]);
    assert.equal(new Set(relativos).size, relativos.length);
    assert.equal(expandido.cobertura, "parcial");
    assert.equal(ausentes.some((arquivo) => arquivo === "src/ausente.ts"), true);
    assert.deepEqual(
      expandido.dependencias[path.join(base, "src", "entrada.ts")]?.map((arquivo) =>
        path.relative(base, arquivo).replace(/\\/g, "/"),
      ),
      ["src/alias.ts", "src/dep.ts", "src/lazy.ts"],
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("plano completo resolve alias arbitrario de tsconfig e falha fechado no alvo ausente", async () => {
  const base = await criarWorkspace([
    'import { presente } from "ui/presente.js";',
    'import { ausente } from "ui/ausente.js";',
    "export function executar() { return { ok: presente && ausente }; }",
    "",
  ].join("\n"));
  try {
    await mkdir(path.join(base, "src", "ui"), { recursive: true });
    await writeFile(path.join(base, "src", "ui", "presente.ts"), "export const presente = true;\n", "utf8");
    await writeFile(path.join(base, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: { "ui/*": ["src/ui/*"] },
      },
    }), "utf8");
    const contexto = await carregarProjeto("contratos/app.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });
    const catalogo = await criarCatalogoDrift({ baseDiretorio: base, arquivos: plano.arquivos });
    const expandido = await expandirDependenciasPlanoDrift(contexto, plano, catalogo);
    const arquivos = expandido.arquivos.map((arquivo) => path.relative(base, arquivo).replace(/\\/g, "/"));
    const ausentes = expandido.arquivosAusentes.map((arquivo) => path.relative(base, arquivo).replace(/\\/g, "/"));

    assert.equal(arquivos.includes("src/ui/presente.ts"), true);
    assert.equal(ausentes.includes("src/ui/ausente.ts"), true);
    assert.equal(expandido.cobertura, "parcial");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("contrato declarativo somente de tipos nao exige ancora de codigo", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-escopo-tipos-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "src"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
    }), "utf8");
    await writeFile(path.join(base, "contratos", "modelo.sema"), [
      "module app.modelo {",
      "  type Registro { id: Texto }",
      "}",
      "",
    ].join("\n"), "utf8");

    const contexto = await carregarProjeto("contratos/modelo.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });

    assert.deepEqual(plano.arquivos, []);
    assert.deepEqual(plano.bloqueios, []);
    assert.equal(plano.cobertura, "completa");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("implementacao usa o candidato de arquivo mais especifico sem abrir barrel superior", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-escopo-especifico-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "pacotes", "cli", "src"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./pacotes"],
    }), "utf8");
    await writeFile(path.join(base, "contratos", "docs.sema"), [
      "module app.docs {",
      "  task publicar {",
      "    output { ok: Booleano }",
      "    impl { ts: cli.src.docs.publicar }",
      "    guarantees { ok existe }",
      "  }",
      "}",
      "",
    ].join("\n"), "utf8");
    await writeFile(
      path.join(base, "pacotes", "cli", "src", "docs.ts"),
      "export function publicar() { return { ok: true }; }\n",
      "utf8",
    );
    await writeFile(
      path.join(base, "pacotes", "cli", "src", "index.ts"),
      'export * from "./lateral.js";\n',
      "utf8",
    );
    await writeFile(
      path.join(base, "pacotes", "cli", "src", "lateral.ts"),
      "export const lateral = true;\n",
      "utf8",
    );

    const contexto = await carregarProjeto("contratos/docs.sema", base, { escopo: "arquivo", adiarDescobertaCodigo: true });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "arquivo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });

    assert.deepEqual(
      plano.arquivos.map((arquivo) => path.relative(base, arquivo).replace(/\\/g, "/")),
      ["pacotes/cli/src/docs.ts"],
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("segmento semantico snake_case resolve diretorio camelCase declarado", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-escopo-camel-"));
  try {
    const arquivoRelativo = "pacotes/cli/src/pipelineConteudo/adapters.ts";
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "pacotes", "cli", "src", "pipelineConteudo"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./pacotes"],
    }), "utf8");
    await writeFile(path.join(base, "contratos", "pipeline.sema"), `module app.pipeline {
  task executar {
    output { ok: Booleano }
    impl { ts: cli.src.pipeline_conteudo.adapters.executar }
    vinculos {
      arquivo: "${arquivoRelativo}"
      simbolo: cli.src.pipeline_conteudo.adapters.executar
    }
    guarantees { ok existe }
  }
}
`, "utf8");
    await writeFile(
      path.join(base, ...arquivoRelativo.split("/")),
      "export function executar() { return { ok: true }; }\n",
      "utf8",
    );

    const contexto = await carregarProjeto("contratos/pipeline.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });
    const relativos = (arquivos: readonly string[]) => arquivos
      .map((arquivo) => path.relative(base, arquivo).replace(/\\/g, "/"));

    assert.deepEqual(relativos(plano.arquivos), [arquivoRelativo]);
    assert.deepEqual(relativos(plano.arquivosDeclarados), [arquivoRelativo]);
    assert.deepEqual(plano.arquivosInferidos, []);
    assert.deepEqual(plano.arquivosAusentes, []);
    assert.equal(plano.cobertura, "completa");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("vinculo absoluto externo e redigido sem expor o caminho fisico", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-escopo-redacao-"));
  const externo = await mkdtemp(path.join(os.tmpdir(), "sema-drift-segredo-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "src"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
    }), "utf8");
    const segredo = path.join(externo, "segredo.ts");
    await writeFile(segredo, "export const segredo = true;\n", "utf8");
    await writeFile(path.join(base, "contratos", "externo.sema"), [
      "module app.externo {",
      `  vinculos { arquivo: "${segredo.replace(/\\/g, "/")}" }`,
      "}",
      "",
    ].join("\n"), "utf8");

    const contexto = await carregarProjeto("contratos/externo.sema", base, { escopo: "arquivo", adiarDescobertaCodigo: true });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "arquivo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });
    const serializado = JSON.stringify(plano);

    assert.deepEqual(plano.arquivos, []);
    assert.deepEqual(plano.arquivosAusentes, ["[fora_do_workspace]/segredo.ts"]);
    assert.deepEqual(plano.bloqueios, ["escopo_estreito_sem_vinculos"]);
    assert.equal(serializado.includes(externo), false);
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externo, { recursive: true, force: true });
  }
});

test("inferencia de rota fica na raiz da ancora e nao visita consumidor lateral homonimo", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-escopo-raiz-ancora-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "app", "routes"), { recursive: true });
    await mkdir(path.join(base, "firecrawl-local", "routes"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app", "./firecrawl-local"],
    }), "utf8");
    await writeFile(path.join(base, "app", "anchor.ts"), "export const anchor = true;\n", "utf8");
    await writeFile(path.join(base, "app", "routes", "health.ts"), "export const health = true;\n", "utf8");
    await writeFile(path.join(base, "firecrawl-local", "routes", "health.ts"), "export const lateral = true;\n", "utf8");
    await writeFile(path.join(base, "contratos", "health.sema"), `module app.health {
  vinculos { arquivo: "app/anchor.ts" }
  task consultar { output { ok: Booleano } guarantees { ok existe } }
  route health {
    metodo: GET
    caminho: /health
    task: consultar
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/health.sema", base, {
      escopo: "arquivo",
      adiarDescobertaCodigo: true,
    });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "arquivo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: ["health"],
    });

    assert.deepEqual(
      plano.arquivos.map((arquivo) => path.relative(base, arquivo).replace(/\\/g, "/")),
      ["app/anchor.ts", "app/routes/health.ts"],
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

async function criarWorkspacePython(codigo: string, comPacoteLocal: boolean): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-python-deps-"));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await mkdir(path.join(base, "src", "app"), { recursive: true });
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    diretoriosCodigo: ["./src"],
    fontesLegado: ["python"],
  }), "utf8");
  await writeFile(path.join(base, "contratos", "worker.sema"), `module app.worker {
  vinculos { arquivo: "src/worker.py" }
  task executar {
    output { ok: Booleano }
    impl { py: src.worker.executar }
    guarantees { ok existe }
  }
}
`, "utf8");
  await writeFile(path.join(base, "src", "worker.py"), `${codigo}\ndef executar():\n    return {'ok': True}\n`, "utf8");
  if (comPacoteLocal) {
    await writeFile(path.join(base, "src", "app", "__init__.py"), "# pacote local\n", "utf8");
  }
  return base;
}

test("from app import simbolo nao inventa modulo filho ausente quando app e pacote local", async () => {
  const base = await criarWorkspacePython("from app import missing", true);
  try {
    const contexto = await carregarProjeto("contratos/worker.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });
    const catalogo = await criarCatalogoDrift({ baseDiretorio: base, arquivos: plano.arquivos });
    const expandido = await expandirDependenciasPlanoDrift(contexto, plano, catalogo);
    const ausentes = expandido.arquivosAusentes.map((arquivo) =>
      path.relative(base, arquivo).replace(/\\/g, "/"),
    );

    assert.equal(expandido.cobertura, "completa");
    assert.equal(ausentes.includes("src/app/missing.py"), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("from modulo import funcao resolve arquivo real sem inventar caminho da funcao", async () => {
  const base = await criarWorkspacePython(
    [
      "try:",
      "    from .editorial_accountability import assess_editorial_accountability",
      "except ImportError:",
      "    from editorial_accountability import assess_editorial_accountability",
    ].join("\n"),
    false,
  );
  try {
    await writeFile(
      path.join(base, "src", "editorial_accountability.py"),
      "def assess_editorial_accountability():\n    return True\n",
      "utf8",
    );
    const contexto = await carregarProjeto("contratos/worker.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });
    const catalogo = await criarCatalogoDrift({ baseDiretorio: base, arquivos: plano.arquivos });
    const expandido = await expandirDependenciasPlanoDrift(contexto, plano, catalogo);
    const arquivos = expandido.arquivos.map((arquivo) => path.relative(base, arquivo).replace(/\\/g, "/"));
    const ausentes = expandido.arquivosAusentes.map((arquivo) =>
      path.relative(base, arquivo).replace(/\\/g, "/"),
    );

    assert.equal(arquivos.includes("src/editorial_accountability.py"), true);
    assert.equal(ausentes.includes("src/editorial_accountability/assess_editorial_accountability.py"), false);
    assert.equal(expandido.cobertura, "completa");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("import third-party sem pacote local nao reduz cobertura", async () => {
  const base = await criarWorkspacePython("import pacote_terceiro", false);
  try {
    const contexto = await carregarProjeto("contratos/worker.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });
    const catalogo = await criarCatalogoDrift({ baseDiretorio: base, arquivos: plano.arquivos });
    const expandido = await expandirDependenciasPlanoDrift(contexto, plano, catalogo);

    assert.equal(expandido.cobertura, "completa");
    assert.deepEqual(expandido.arquivosAusentes, []);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("dependencia que escapa por junction ou symlink nao entra no plano", async (t) => {
  const base = await criarWorkspace('import "./escape/segredo.js";\nexport function executar() { return { ok: true }; }\n');
  const externo = await mkdtemp(path.join(os.tmpdir(), "sema-drift-deps-externo-"));
  try {
    await writeFile(path.join(externo, "segredo.js"), "export const segredo = true;\n", "utf8");
    try {
      await symlink(externo, path.join(base, "src", "escape"), process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "UNKNOWN"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente nao permite criar junction/symlink");
        return;
      }
      throw erro;
    }

    const contexto = await carregarProjeto("contratos/app.sema", base, { escopo: "modulo", adiarDescobertaCodigo: true });
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });
    const catalogo = await criarCatalogoDrift({ baseDiretorio: base, arquivos: plano.arquivos });
    const expandido = await expandirDependenciasPlanoDrift(contexto, plano, catalogo);

    assert.equal(expandido.arquivos.some((arquivo) => arquivo.startsWith(externo)), false);
    assert.equal(expandido.arquivosAusentes.some((arquivo) => arquivo.includes(`escape${path.sep}segredo.ts`)), true);
    assert.equal(expandido.cobertura, "parcial");
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externo, { recursive: true, force: true });
  }
});
