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

test("carregamento fisico adiado usa raizes logicas sem detectar fontes legadas", async () => {
  const base = await criarWorkspaceCarregamento();
  try {
    const contexto = await carregarProjeto("contratos/alvo.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });

    assert.equal(contexto.diretoriosCodigo.includes(path.resolve(base, "src")), true);
    assert.deepEqual(contexto.fontesLegado, []);
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
    assert.equal(contexto.diretoriosCodigo.some((diretorio) => path.basename(diretorio) === "src"), true);
    assert.equal(contexto.fontesLegado.includes("typescript"), true);
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

test("diretorio de codigo externo na configuracao falha antes da inferencia legada", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-codigo-confinado-"));
  const externa = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-codigo-externo-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await writeFile(path.join(base, "contratos", "alvo.sema"), "module app.alvo {}\n", "utf8");
    await writeFile(path.join(externa, "app.py"), "from fastapi import FastAPI\napp = FastAPI()\n", "utf8");
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: [externa],
    }), "utf8");

    for (const escopo of ["modulo", "projeto"] as const) {
      await assert.rejects(
        carregarProjeto("contratos/alvo.sema", base, { escopo }),
        (erro: unknown) => {
          const mensagem = String((erro as Error).message);
          return /fora da base do projeto/u.test(mensagem) && !mensagem.includes(externa);
        },
      );
    }
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externa, { recursive: true, force: true });
  }
});

test("junction de codigo para fora da base falha antes da inferencia legada", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-codigo-link-"));
  const externa = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-codigo-link-externo-"));
  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await writeFile(path.join(base, "contratos", "alvo.sema"), "module app.alvo {}\n", "utf8");
    await writeFile(path.join(externa, "app.py"), "from fastapi import FastAPI\n", "utf8");
    try {
      await symlink(externa, path.join(base, "codigo-link"), process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "ENOTSUP", "UNKNOWN"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("Ambiente nao permite criar junction/symlink para testar diretorio de codigo.");
        return;
      }
      throw erro;
    }
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./codigo-link"],
    }), "utf8");

    await assert.rejects(
      carregarProjeto("contratos/alvo.sema", base, {
        escopo: "modulo",
        adiarDescobertaCodigo: true,
      }),
      /resolve fora da base do projeto/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externa, { recursive: true, force: true });
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
    const nomeArmadilha = "segredo-que-nao-pode-ser-enumerado.sema";
    await writeFile(path.join(externa, nomeArmadilha), "module externo.contrato {}\n", "utf8");
    try {
      await symlink(externa, path.join(base, "contratos-link"), process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("Ambiente nao permite criar junction/symlink para testar confinamento.");
        return;
      }
      throw erro;
    }

    await assert.rejects(carregarProjeto(undefined, base), (erro: unknown) => {
      const mensagem = String((erro as Error).message);
      return /origens\[0\] resolve fora da base do projeto/u.test(mensagem)
        && !mensagem.includes(externa)
        && !mensagem.includes(nomeArmadilha);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externa, { recursive: true, force: true });
  }
});

test("origem absoluta externa falha antes de enumerar e sem revelar caminho", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-origem-base-"));
  const externa = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-origem-externa-"));
  const nomeArmadilha = "contrato-secreto-nao-enumerado.sema";
  try {
    await writeFile(path.join(externa, nomeArmadilha), "module externo.segredo {}\n", "utf8");
    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({ origens: [externa] }, null, 2),
      "utf8",
    );

    await assert.rejects(carregarProjeto(undefined, base), (erro: unknown) => {
      const mensagem = String((erro as Error).message);
      return /origens\[0\] aponta para fora da base do projeto/u.test(mensagem)
        && !mensagem.includes(externa)
        && !mensagem.includes(nomeArmadilha);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externa, { recursive: true, force: true });
  }
});

test("entrada em junction externa nao contorna o confinamento das origens", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-entrada-base-"));
  const externa = await mkdtemp(path.join(os.tmpdir(), "sema-projeto-entrada-externa-"));
  const nomeArmadilha = "entrada-secreta-nao-enumerada.sema";
  try {
    await writeFile(path.join(base, "sema.config.json"), "{}\n", "utf8");
    await writeFile(path.join(externa, nomeArmadilha), "module externo.entrada {}\n", "utf8");
    try {
      await symlink(externa, path.join(base, "entrada-link"), process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "ENOTSUP", "UNKNOWN"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("Ambiente nao permite criar junction/symlink para testar entrada externa.");
        return;
      }
      throw erro;
    }

    await assert.rejects(carregarProjeto("entrada-link", base), (erro: unknown) => {
      const mensagem = String((erro as Error).message);
      return /origens\[0\] resolve fora da base do projeto/u.test(mensagem)
        && !mensagem.includes(externa)
        && !mensagem.includes(nomeArmadilha);
    });
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externa, { recursive: true, force: true });
  }
});
