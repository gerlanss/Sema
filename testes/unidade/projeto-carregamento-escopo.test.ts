// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descricao: prova que o carregamento estreito compila apenas alvo e uses transitivos.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";

async function criarWorkspaceCarregamento(): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-escopo-"));
  const contratos = path.join(base, "contratos");
  const src = path.join(base, "src");
  await mkdir(contratos, { recursive: true });
  await mkdir(src, { recursive: true });
  await writeFile(path.join(src, "servico.ts"), "export const executar = () => true;\n", "utf8");
  await writeFile(
    path.join(contratos, "alvo.sema"),
    `module app.alvo {
  use compartilhado

  task executar {
    output { ok: Booleano }
    guarantees { ok existe }
  }
}
`,
    "utf8",
  );
  await writeFile(
    path.join(contratos, "compartilhado.sema"),
    `module app.compartilhado {
  use app.base

  type ResultadoCompartilhado {
    ok: Booleano
  }
}
`,
    "utf8",
  );
  await writeFile(
    path.join(contratos, "base.sema"),
    `module app.base {
  use app.alvo

  type IdentificadorBase {
    valor: Texto
  }
}
`,
    "utf8",
  );
  await writeFile(
    path.join(contratos, "lateral.sema"),
    `module app.lateral {
  task fora_do_escopo {
    output { ok: Booleano }
  }
}
`,
    "utf8",
  );
  return base;
}

test("arquivo .sema carrega alvo e fechamento use relativo sem compilar contrato lateral", async () => {
  const base = await criarWorkspaceCarregamento();
  try {
    const contexto = await carregarProjeto("contratos/alvo.sema", base, { escopo: "modulo" });
    const carregados = contexto.arquivosProjeto.map((arquivo) => path.basename(arquivo)).sort();
    const descobertos = contexto.arquivosDescobertos.map((arquivo) => path.basename(arquivo)).sort();

    assert.deepEqual(carregados, ["alvo.sema", "base.sema", "compartilhado.sema"]);
    assert.deepEqual(descobertos, ["alvo.sema", "base.sema", "compartilhado.sema", "lateral.sema"]);
    assert.equal(contexto.modulosCarregados.length, 3);
    assert.deepEqual(contexto.modulosSelecionados.map((item) => item.resultado.modulo?.nome), ["app.alvo"]);
    assert.equal(contexto.diretoriosCodigo.some((diretorio) => path.basename(diretorio) === "src"), true);
    assert.equal(contexto.fontesLegado.includes("typescript"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("escopo projeto forca carregamento de todos os contratos descobertos", async () => {
  const base = await criarWorkspaceCarregamento();
  try {
    const contexto = await carregarProjeto("contratos/alvo.sema", base, { escopo: "projeto" });
    const carregados = contexto.arquivosProjeto.map((arquivo) => path.basename(arquivo)).sort();

    assert.deepEqual(carregados, ["alvo.sema", "base.sema", "compartilhado.sema", "lateral.sema"]);
    assert.equal(contexto.modulosCarregados.length, 4);
    assert.equal(contexto.modulosSelecionados.length, 4);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("dependencia ausente permanece visivel como SEM019 no contrato alvo", async () => {
  const base = await criarWorkspaceCarregamento();
  try {
    await writeFile(
      path.join(base, "contratos", "incompleto.sema"),
      `module app.incompleto {
  use app.ausente

  task executar {
    output { ok: Booleano }
    guarantees { ok existe }
  }
}
`,
      "utf8",
    );

    const contexto = await carregarProjeto("contratos/incompleto.sema", base, { escopo: "modulo" });
    assert.equal(
      contexto.modulosSelecionados[0]?.resultado.diagnosticos.some((item) => item.codigo === "SEM019"),
      true,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("modulo duplicado usado pelo alvo falha fechado em vez de escolher por ordem", async () => {
  const base = await criarWorkspaceCarregamento();
  try {
    const contratos = path.join(base, "contratos");
    await mkdir(path.join(contratos, "duplicado"), { recursive: true });
    await writeFile(
      path.join(contratos, "duplicado", "compartilhado.sema"),
      `module app.compartilhado {
  type OutroResultado { ok: Booleano }
}
`,
      "utf8",
    );

    await assert.rejects(
      carregarProjeto("contratos/alvo.sema", base, { escopo: "modulo" }),
      /Modulo Sema ambiguo "app\.compartilhado"/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("arquivo de codigo nao e compilado acidentalmente como contrato Sema", async () => {
  const base = await criarWorkspaceCarregamento();
  try {
    await assert.rejects(
      carregarProjeto("src/servico.ts", base, { escopo: "arquivo" }),
      /precisa terminar em \.sema/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("origem junction fora da base do projeto e rejeitada", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-confinado-"));
  const externa = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-externo-"));
  try {
    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({ origens: ["./contratos-link"] }, null, 2),
      "utf8",
    );
    await writeFile(path.join(externa, "externo.sema"), "module externo.contrato {}\n", "utf8");
    try {
      await symlink(externa, path.join(base, "contratos-link"), process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("Ambiente nao permite criar junction/symlink para testar confinamento.");
        return;
      }
      throw erro;
    }

    await assert.rejects(
      carregarProjeto(undefined, base),
      /resolve fora da base do projeto/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externa, { recursive: true, force: true });
  }
});
