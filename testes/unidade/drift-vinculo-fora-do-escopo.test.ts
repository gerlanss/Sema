// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: cobre vinculo de simbolo cujo codigo-ancora do dono existe no workspace
// fora dos diretoriosCodigo — informativo com diretorio sugerido, nunca vinculo_quebrado.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analisarDriftLegado } from "../../pacotes/cli/src/drift.part11.js";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";

const CONTRATO = `module app.ponte {
  vinculos {
    arquivo: "backend/servico.py"
  }

  task servir_ranking {
    input { pagina: Texto required }
    output { payload: Texto }
    execucao {
      idempotencia: verdadeiro
    }
    impl { py: backend.servico.servir_ranking }
    vinculos {
      arquivo: "backend/servico.py"
      SIMBOLO_PLACEHOLDER
      arquivo: "app_consumer/lib/ponte.dart"
    }
    guarantees { payload existe }
  }
}
`;

const COM_SIMBOLO_FORA = CONTRATO.replace(
  "SIMBOLO_PLACEHOLDER",
  'simbolo: app_consumer.lib.ponte.atualizarPainel',
);
const COM_SIMBOLO_SEM_ANCORA = CONTRATO
  .replace("SIMBOLO_PLACEHOLDER", "simbolo: app_outro.lib.outra_coisa")
  .replace('      arquivo: "app_consumer/lib/ponte.dart"\n', "");
const SEM_SIMBOLO = CONTRATO.replace("      SIMBOLO_PLACEHOLDER\n", "");
const ARQUIVO_AUSENTE = CONTRATO.replace(
  'arquivo: "app_consumer/lib/ponte.dart"',
  'arquivo: "app_consumer/lib/inexistente.dart"',
).replace("      SIMBOLO_PLACEHOLDER\n", "");

async function criarWorkspace(contrato: string): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-fora-do-escopo-"));
  for (const diretorio of ["contratos", "backend", path.join("app_consumer", "lib")]) {
    await mkdir(path.join(base, diretorio), { recursive: true });
  }
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    diretoriosCodigo: ["./backend"],
  }, null, 2), "utf8");
  await writeFile(
    path.join(base, "backend", "servico.py"),
    "def servir_ranking(pagina):\n    return 'payload'\n",
    "utf8",
  );
  await writeFile(
    path.join(base, "app_consumer", "lib", "ponte.dart"),
    "Future<Map<String, dynamic>> atualizarPainel() async => {};\n",
    "utf8",
  );
  await writeFile(path.join(base, "contratos", "ponte.sema"), contrato, "utf8");
  return base;
}

async function analisar(base: string, modoCache: "none" | "cache" | "fresh" = "none") {
  const contexto = await carregarProjeto("contratos/ponte.sema", base, { escopo: "projeto" });
  return analisarDriftLegado(contexto, {
    escopo: "projeto",
    modoCache,
  });
}

test("vinculo de simbolo com ancora de dono fora dos diretoriosCodigo vira informativo com diretorio sugerido", async (t) => {
  const base = await criarWorkspace(COM_SIMBOLO_FORA);
  t.after(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const resultado = await analisar(base);

  assert.equal(resultado.impls_quebrados.length, 0, "impl declarado dentro do escopo deve resolver");
  assert.equal(resultado.vinculos_quebrados.length, 0, "simbolo com codigo real fora do escopo nao e vinculo quebrado");
  assert.equal(resultado.vinculos_fora_do_escopo.length, 1, "deve aparecer exatamente uma vez como fora do escopo");
  const registro = resultado.vinculos_fora_do_escopo[0]!;
  assert.equal(registro.status, "fora_do_escopo");
  assert.equal(registro.valor, "app_consumer.lib.ponte.atualizarPainel");
  assert.ok(
    registro.arquivo?.replaceAll("\\", "/").endsWith("app_consumer/lib/ponte.dart"),
    "o registro aponta o arquivo-ancora real encontrado no disco",
  );
  assert.equal(registro.diretorioSugerido, "./app_consumer/lib");
  assert.ok(
    resultado.diagnosticos.some((diagnostico) =>
      diagnostico.tipo === "vinculo_fora_do_escopo"
      && diagnostico.severidade === "aviso"
      && diagnostico.mensagem.includes("./app_consumer/lib")),
    "diagnostico informativo precisa sugerir o diretorio para o sema.config.json",
  );
  assert.equal(resultado.sucesso, true, "vinculo fora do escopo nao bloqueia fechamento");
});

test("vinculo de simbolo sem ancora fora do escopo continua bloqueante", async (t) => {
  const base = await criarWorkspace(COM_SIMBOLO_SEM_ANCORA);
  t.after(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const resultado = await analisar(base);

  assert.equal(resultado.vinculos_fora_do_escopo.length, 0, "sem arquivo real fora do escopo nao ha informativo");
  assert.equal(resultado.vinculos_quebrados.length, 1, "simbolo sem codigo correspondente e erro honesto");
  assert.equal(resultado.vinculos_quebrados[0]!.status, "nao_encontrado");
  assert.ok(
    resultado.diagnosticos.some((diagnostico) => diagnostico.tipo === "vinculo_quebrado"),
    "diagnostico bloqueante permanece",
  );
  assert.equal(resultado.sucesso, false);
});

test("vinculo de arquivo existente fora do escopo resolve pelo catalogo de declarados sem bloquear", async (t) => {
  const base = await criarWorkspace(SEM_SIMBOLO);
  t.after(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const resultado = await analisar(base);

  assert.equal(resultado.vinculos_quebrados.length, 0);
  assert.equal(resultado.vinculos_fora_do_escopo.length, 0);
  const declaradoFora = resultado.vinculos_validos.find((vinculo) => vinculo.valor === "app_consumer/lib/ponte.dart");
  assert.ok(declaradoFora, "arquivo declarado existente entra nos validos via catalogo");
  assert.equal(declaradoFora!.status, "parcial");
  assert.equal(resultado.sucesso, true);
});

test("vinculo de arquivo realmente ausente continua bloqueante", async (t) => {
  const base = await criarWorkspace(ARQUIVO_AUSENTE);
  t.after(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const resultado = await analisar(base);

  assert.equal(resultado.vinculos_fora_do_escopo.length, 0, "arquivo inexistente nao e fora_do_escopo");
  assert.equal(resultado.vinculos_quebrados.length, 1, "promessa quebrada continua sendo erro honesto");
  assert.equal(resultado.vinculos_quebrados[0]!.status, "nao_encontrado");
  assert.equal(resultado.sucesso, false);
});

test("resultado de vinculos fora do escopo e equivalente com e sem cache de extracao", async (t) => {
  const base = await criarWorkspace(COM_SIMBOLO_FORA);
  t.after(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const semCache = await analisar(base, "fresh");
  const comCache = await analisar(base, "cache");

  assert.deepEqual(comCache.vinculos_fora_do_escopo, semCache.vinculos_fora_do_escopo);
  assert.equal(comCache.vinculos_quebrados.length, semCache.vinculos_quebrados.length);
  assert.equal(comCache.sucesso, semCache.sucesso);
});
