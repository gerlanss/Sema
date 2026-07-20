// SEMA-GOVERNED: sema.produto.sistemas_interativos.cli
// Descricao: schema para IA, allowlists estritas, renderer honesto e CLI read-only.

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS,
  CATALOGO_PIPELINES_INTERATIVOS,
  comandoSistemasInterativos,
  executarComandoSistemasInterativos,
  planejarSistemaInterativo,
  renderizarResultadoSistemasInterativos,
  validarDefinicaoSistemaInterativo,
  type BundleEvidenciasSistemaInterativo,
  type DefinicaoSistemaInterativo,
} from "../../pacotes/cli/src/sistemasInterativos/index.js";

const DIGEST = `sha256:${"c".repeat(64)}`;

function definicao(): DefinicaoSistemaInterativo {
  const base: DefinicaoSistemaInterativo = {
    schemaVersion: "1.0",
    systemId: "cli.headless",
    version: "1.0.0",
    kind: "SIMULATION",
    spatialModel: "NON_SPATIAL",
    renderMode: "HEADLESS",
    visualProfile: "NONE",
    fidelity: "SYSTEMIC",
    controlModes: ["SCRIPTED"],
    timeModel: "FIXED_STEP",
    determinism: "NONE",
    capabilities: ["interactive.control.scripted"],
    pipelines: ["interactive.prototype"],
    adapterTargets: ["runtime.headless.generic"],
    world: {
      identity: "counter",
      state: { tick: 0 },
      time: { stepMs: 16 },
      events: ["tick"],
      initialConditions: ["tick zero"],
      model: "bounded counter",
      assumptions: ["fixed clock"],
      boundaryConditions: ["tick at most ten"],
      outputs: ["tick"],
      validation: { method: "range check", invariants: ["tick from zero to ten"] },
    },
    acceptance: { criteria: ["tick reaches ten"] },
  };
  return { ...base, capabilities: validarDefinicaoSistemaInterativo(base).capabilitiesRequeridas };
}

function bundleCompleto(def: DefinicaoSistemaInterativo): BundleEvidenciasSistemaInterativo {
  const planejamento = planejarSistemaInterativo(def);
  assert.deepEqual(planejamento.bloqueios, []);
  let contador = 0;
  return {
    schemaVersion: "1.0",
    runId: "run.cli.1",
    systemId: def.systemId,
    definitionDigest: planejamento.plano.definitionDigest,
    planDigest: planejamento.plano.planDigest,
    observations: planejamento.plano.stages.flatMap((stage) => {
      const provider = planejamento.plano.stageProviderMap.find((item) => item.stageInstanceId === stage.stageInstanceId);
      const producerAdapterId = provider?.selectedAdapterIds[0];
      assert.ok(producerAdapterId);
      const producer = CATALOGO_ADAPTADORES_INTERATIVOS.find((item) => item.adapterId === producerAdapterId);
      assert.ok(producer);
      return stage.requiredEvidence.map((evidenceType) => ({
        evidenceId: `evidence.cli.${++contador}`,
        evidenceType,
        stageId: stage.stageInstanceId,
        semanticTargetId: "target.cli.headless",
        producerAdapterId,
        producerAdapterVersion: producer.version,
        artifactDigest: DIGEST,
        observedAt: "2026-07-20T01:00:00.000Z",
        source: "external-observer",
        data: { observed: true },
      }));
    }),
  };
}

test("schema e capabilities sao superficies read-only para descoberta pela IA", async () => {
  const schema = await executarComandoSistemasInterativos(["schema"]);
  assert.equal(schema.exitCode, 0);
  assert.equal(schema.payload.schemaVersion, "sema.interativo.schema/v1");
  assert.equal(schema.payload.readOnly, true);
  assert.equal(schema.payload.executed, false);
  assert.equal(schema.payload.workspaceMutated, false);
  assert.equal(schema.payload.authoritative, false);
  const shape = schema.payload.definitionSchema as {
    schemaVersion: string;
    requiredFields: string[];
    constraints: string[];
    fields: Record<string, unknown>;
  };
  assert.equal(shape.schemaVersion, "1.0");
  assert.ok(shape.requiredFields.includes("spatialModel"));
  assert.ok(shape.requiredFields.includes("renderMode"));
  assert.ok(shape.requiredFields.includes("adapterTargets"));
  assert.ok(shape.constraints.some((item) => item.includes("THREE_D")));
  assert.equal("representation" in shape.fields, false);
  assert.ok(Array.isArray(schema.payload.examplePaths));

  const capabilities = await executarComandoSistemasInterativos(["capabilities"]);
  assert.equal(capabilities.exitCode, 0);
  assert.equal((capabilities.payload.pipelineIds as string[]).length, CATALOGO_PIPELINES_INTERATIVOS.length);
  assert.equal((capabilities.payload.adapterIds as string[]).length, CATALOGO_ADAPTADORES_INTERATIVOS.length);
});

test("allowlist rejeita flag desconhecida, duplicata, valor ausente, enum invalido e posicional extra", async () => {
  const casos: readonly [readonly string[], string][] = [
    [["capabilities", "--qualquer"], "INTERATIVO_ARGUMENTOS_INVALIDOS"],
    [["schema", "extra.json"], "INTERATIVO_ARGUMENTOS_INVALIDOS"],
    [["adapters", "--kind", "GAME", "--kind", "GAME"], "INTERATIVO_ARGUMENTOS_INVALIDOS"],
    [["adapters", "--render-mode"], "INTERATIVO_ARGUMENTOS_INVALIDOS"],
    [["adapters", "--spatial-model", "CUBO_MAGICO"], "INTERATIVO_FILTRO_INVALIDO"],
    [["pipelines", "--render-mode", "CRT_VERDE"], "INTERATIVO_FILTRO_INVALIDO"],
    [["validar"], "INTERATIVO_ARGUMENTOS_INVALIDOS"],
  ];
  for (const [args, errorCode] of casos) {
    const resultado = await executarComandoSistemasInterativos(args);
    assert.equal(resultado.exitCode, 1, args.join(" "));
    assert.equal(resultado.payload.sucesso, false, args.join(" "));
    assert.equal(resultado.payload.errorCode, errorCode, args.join(" "));
    assert.equal(resultado.payload.executed, false);
    assert.equal(resultado.payload.workspaceMutated, false);
  }
});

test("filtros validos usam os dois eixos sem sucesso vazio acidental", async () => {
  const resultado = await executarComandoSistemasInterativos([
    "adapters", "--spatial-model", "THREE_D", "--render-mode", "HEADLESS",
  ]);
  assert.equal(resultado.exitCode, 0);
  const adapters = resultado.payload.adapters as { adapterId: string }[];
  assert.ok(adapters.length > 0);
  assert.ok(adapters.some((item) => item.adapterId === "runtime.headless.generic"));
  assert.ok(adapters.some((item) => item.adapterId === "editor.blender"));
});

test("evidencias recompõem plano e status permanece estrutural e nao autoritativo", async () => {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), "sema-interativo-command-"));
  try {
    const def = definicao();
    const plano = planejarSistemaInterativo(def).plano;
    const bundle = bundleCompleto(def);
    const definicaoArquivo = path.join(diretorio, "definition.json");
    const planoArquivo = path.join(diretorio, "plan.json");
    const bundleArquivo = path.join(diretorio, "evidence.json");
    await Promise.all([
      writeFile(definicaoArquivo, JSON.stringify(def), "utf8"),
      writeFile(planoArquivo, JSON.stringify(plano), "utf8"),
      writeFile(bundleArquivo, JSON.stringify(bundle), "utf8"),
    ]);

    const recomputado = await executarComandoSistemasInterativos([
      "validar-evidencias", definicaoArquivo, "--evidencias-arquivo", bundleArquivo,
    ]);
    assert.equal(recomputado.exitCode, 0, JSON.stringify(recomputado.payload));

    const explicito = await executarComandoSistemasInterativos([
      "status", definicaoArquivo, "--plano-arquivo", planoArquivo, "--bundle-arquivo", bundleArquivo,
    ]);
    assert.equal(explicito.exitCode, 0, JSON.stringify(explicito.payload));
    const estado = explicito.payload.estado as {
      status: string;
      completed: boolean;
      localCoverageComplete: boolean;
      awaitingExternalAttestation: boolean;
      authoritative: boolean;
    };
    assert.equal(estado.status, "STRUCTURALLY_COMPLETE");
    assert.equal(estado.completed, false);
    assert.equal(estado.localCoverageComplete, true);
    assert.equal(estado.awaitingExternalAttestation, true);
    assert.equal(estado.authoritative, false);
  } finally {
    await rm(diretorio, { recursive: true, force: true });
  }
});

test("renderer textual expoe schema, proximos passos e fronteira operacional", async () => {
  const resultado = await executarComandoSistemasInterativos(["capabilities"]);
  const texto = renderizarResultadoSistemasInterativos(resultado.payload);
  assert.match(texto, /^SISTEMAS INTERATIVOS · CAPABILITIES/m);
  assert.match(texto, /^STATUS · OK$/m);
  assert.match(texto, /^COMANDO · capabilities$/m);
  assert.match(texto, /^BLOQUEIOS · 0$/m);
  assert.match(texto, new RegExp(`^PIPELINES · ${CATALOGO_PIPELINES_INTERATIVOS.length}$`, "m"));
  assert.match(texto, /^- interactive\.prototype$/m);
  assert.match(texto, /^ADAPTERS CANDIDATOS COMPATÍVEIS · /m);
  assert.match(texto, /^PRÓXIMOS PASSOS · 1$/m);
  assert.match(texto, /^FRONTEIRA OPERACIONAL$/m);
  assert.match(texto, /nenhum engine, editor ou runner foi iniciado/);
  assert.match(texto, /saída local e não autoritativa/);

  const schema = await executarComandoSistemasInterativos(["schema"]);
  const schemaTexto = renderizarResultadoSistemasInterativos(schema.payload);
  assert.match(schemaTexto, /^CAMPOS OBRIGATÓRIOS DO SHAPE V1 · /m);
  assert.match(schemaTexto, /^- spatialModel$/m);
  assert.match(schemaTexto, /^- renderMode$/m);
});

test("handler textual envia erro seguro ao stderr e --json preserva payload", async () => {
  const logs: string[] = [];
  const erros: string[] = [];
  const logOriginal = console.log;
  const erroOriginal = console.error;
  console.log = (valor?: unknown) => logs.push(String(valor));
  console.error = (valor?: unknown) => erros.push(String(valor));
  try {
    const exitCodeTexto = await comandoSistemasInterativos([], ["subcomando-que-nao-existe"], false);
    assert.equal(exitCodeTexto, 1);
    assert.equal(logs.length, 0);
    assert.equal(erros.length, 1);
    assert.match(erros[0]!, /^STATUS · ERRO$/m);
    assert.match(erros[0]!, /INTERATIVO_SUBCOMANDO_DESCONHECIDO/);
    assert.doesNotMatch(erros[0]!, /stack|C:\\/i);

    const esperado = await executarComandoSistemasInterativos(["pipelines"]);
    const exitCodeJson = await comandoSistemasInterativos([], ["pipelines", "--json"], false);
    assert.equal(exitCodeJson, 0);
    assert.deepEqual(JSON.parse(logs[0]!), esperado.payload);
  } finally {
    console.log = logOriginal;
    console.error = erroOriginal;
  }
});

test("JSON e texto nao ecoam caminho, Bearer ou chave controlados", async () => {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), "sema-interativo-no-echo-"));
  const caminhoControlado = "C:\\private\\operator\\secret.txt";
  const bearer = "Bearer abcdefghijklmnopqrstuvwxyz";
  const chave = "sk_proibido_abcdefghijklmnop";
  try {
    const maliciosa: DefinicaoSistemaInterativo = {
      ...definicao(),
      systemId: caminhoControlado,
      world: { ...definicao().world, identity: bearer },
      acceptance: { criteria: [chave] },
    };
    const arquivo = path.join(diretorio, "definition.json");
    await writeFile(arquivo, JSON.stringify(maliciosa), "utf8");
    const resultado = await executarComandoSistemasInterativos(["planejar", arquivo]);
    assert.equal(resultado.exitCode, 1);
    const json = JSON.stringify(resultado.payload);
    const texto = renderizarResultadoSistemasInterativos(resultado.payload);
    for (const valor of [caminhoControlado, bearer, chave]) {
      assert.equal(json.includes(valor), false);
      assert.equal(texto.includes(valor), false);
    }

    const arquivoInexistente = path.join(diretorio, bearer, chave, "nao-existe.json");
    const erro = await executarComandoSistemasInterativos(["validar", arquivoInexistente]);
    assert.equal(erro.payload.errorCode, "INTERATIVO_ENTRADA_INVALIDA");
    assert.equal(JSON.stringify(erro.payload).includes(arquivoInexistente), false);
    assert.equal(renderizarResultadoSistemasInterativos(erro.payload).includes(arquivoInexistente), false);
  } finally {
    await rm(diretorio, { recursive: true, force: true });
  }
});
