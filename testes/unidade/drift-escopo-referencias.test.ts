// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: cobre extracao estatica e candidatos locais deterministas do resolvedor de drift.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ContextoProjetoCarregado } from "../../pacotes/cli/src/projeto.js";
import {
  candidatosReferenciaLocalDrift,
  extrairReferenciasLocaisDrift,
} from "../../pacotes/cli/src/driftEscopoReferencias.js";

function criarContexto(base: string, diretoriosCodigo = [path.join(base, "src")]): ContextoProjetoCarregado {
  return {
    baseProjeto: base,
    diretoriosCodigo,
  } as ContextoProjetoCarregado;
}

test("extrai todos styleUrls e ignora require/import dentro de strings comuns", () => {
  const referencias = extrairReferenciasLocaisDrift([
    "@Component({",
    "  templateUrl: './painel.html',",
    "  styleUrls: ['./base.css', \"./tema.css\", `./mobile.css`],",
    "})",
    "const falsoRequire = \"require('./falso.js')\";",
    "const falsoImport = 'import(\"./falso-import.js\")';",
    "const real = require('./real.js');",
    "",
  ].join("\n"));

  assert.deepEqual(referencias.sort(), [
    "./base.css",
    "./mobile.css",
    "./painel.html",
    "./real.js",
    "./tema.css",
  ]);
});

test("template interpolado com template interno nao produz caminho fantasma", () => {
  const referencias = extrairReferenciasLocaisDrift([
    'const codigoGerado = `import x from "./${normalizarNomeModulo(modulo.nome).replace(/_/g, `-`)}.js";`;',
    'const outro = `require("./${nome}.js")`;',
    "",
  ].join("\n"));

  assert.deepEqual(referencias, []);
});

test("paths de tsconfig resolvem aliases e mantem alias ausente auditavel", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-alias-"));
  try {
    await mkdir(path.join(base, "src", "componentes"), { recursive: true });
    await writeFile(path.join(base, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@app/*": ["src/*"],
          "ui/*": ["src/componentes/*"],
        },
      },
    }), "utf8");
    const origem = path.join(base, "src", "entrada.ts");
    await writeFile(origem, "", "utf8");
    await writeFile(path.join(base, "src", "util.ts"), "export const util = true;\n", "utf8");
    const contexto = criarContexto(base);
    const referencias = extrairReferenciasLocaisDrift([
      'import { util } from "@app/util.js";',
      'import { botao } from "ui/botao";',
      'import React from "react";',
      'import pacote from "@scope/pacote";',
      "",
    ].join("\n"), { contexto, arquivoOrigem: origem });

    assert.deepEqual(referencias.sort(), ["@app/util.js", "ui/botao"]);
    assert.equal(
      candidatosReferenciaLocalDrift(contexto, origem, "@app/util.js")[0],
      path.join(base, "src", "util.ts"),
    );
    assert.equal(
      candidatosReferenciaLocalDrift(contexto, origem, "ui/botao").includes(path.join(base, "src", "componentes", "botao.ts")),
      true,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("substituicao NodeNext prioriza fonte TypeScript para import com extensao js", () => {
  const base = path.resolve(os.tmpdir(), "sema-drift-nodenext");
  const origem = path.join(base, "src", "entrada.ts");
  const candidatos = candidatosReferenciaLocalDrift(
    criarContexto(base),
    origem,
    "./servico.js",
  );

  assert.deepEqual(candidatos.slice(0, 4), [
    path.join(base, "src", "servico.ts"),
    path.join(base, "src", "servico.tsx"),
    path.join(base, "src", "servico.d.ts"),
    path.join(base, "src", "servico.js"),
  ]);
});

test("Rust inclui somente referencias deterministicas de mod, path e include", () => {
  const base = path.resolve(os.tmpdir(), "sema-drift-rust");
  const origem = path.join(base, "src", "lib.rs");
  const contexto = criarContexto(base);
  const referencias = extrairReferenciasLocaisDrift([
    "mod api;",
    "#[path = \"infra/adaptador.rs\"]",
    "pub(crate) mod adaptador;",
    "use crate::dominio::Entidade;",
    "const SQL: &str = include_str!(\"./schema.sql\");",
    "",
  ].join("\n"));

  assert.deepEqual(referencias.sort(), [
    "./schema.sql",
    "rust-mod:api",
    "rust-path:infra/adaptador.rs",
  ]);
  assert.deepEqual(candidatosReferenciaLocalDrift(contexto, origem, "rust-mod:api"), [
    path.join(base, "src", "api.rs"),
    path.join(base, "src", "api", "mod.rs"),
  ]);
  assert.deepEqual(candidatosReferenciaLocalDrift(contexto, origem, "rust-path:infra/adaptador.rs"), [
    path.join(base, "src", "infra", "adaptador.rs"),
  ]);
});

test("import Python absoluto vira dependencia local somente quando ha candidato no projeto", () => {
  const base = path.resolve(os.tmpdir(), "sema-drift-python-local");
  const origem = path.join(base, "src", "worker.py");
  const contexto = criarContexto(base);
  const referencias = extrairReferenciasLocaisDrift([
    "from app.servico import executar",
    "import pacote_externo",
    "",
  ].join("\n"));

  assert.equal(referencias.includes("python:app.servico"), true);
  assert.equal(referencias.includes("python:pacote_externo"), true);
  assert.equal(
    candidatosReferenciaLocalDrift(contexto, origem, "python:app.servico").includes(
      path.join(base, "src", "app", "servico.py"),
    ),
    true,
  );
});
