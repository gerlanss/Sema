// SEMA-GOVERNED: sema.produto.sistemas_interativos.extensoes_cli
// Descricao: cobertura da superficie CLI avancada, allowlists e fronteira operacional externa.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  SCHEMA_EXTENSOES_CLI_INTERATIVAS,
  SUBCOMANDOS_EXTENSAO_INTERATIVA,
  executarComandoSistemasInterativos,
} from "../../pacotes/cli/src/sistemasInterativos/index.js";

const FRONTEIRA = {
  readOnly: true,
  executed: false,
  workspaceMutated: false,
  authoritative: false,
  externalExecutionRequired: true,
} as const;

function verificarFronteira(payload: Record<string, unknown>): void {
  for (const [campo, valor] of Object.entries(FRONTEIRA)) assert.equal(payload[campo], valor, campo);
}

test("schema e capabilities expoem os 20 subcomandos avancados para agentes", async () => {
  assert.equal(SUBCOMANDOS_EXTENSAO_INTERATIVA.length, 20);
  assert.equal(new Set(SUBCOMANDOS_EXTENSAO_INTERATIVA).size, 20);
  assert.deepEqual(
    Object.keys(SCHEMA_EXTENSOES_CLI_INTERATIVAS.commands),
    [...SUBCOMANDOS_EXTENSAO_INTERATIVA],
  );
  assert.equal(Object.keys(SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemas).length, 29);
  assert.deepEqual(
    Object.keys(SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemaShapes),
    Object.keys(SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemas),
  );
  for (const [key, shape] of Object.entries(SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemaShapes)) {
    assert.equal(shape.schemaVersion, SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemas[key as keyof typeof SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemas]);
    assert.equal(shape.type, "object");
    assert.ok(shape.requiredTopLevelFields.length > 0, key);
  }
  for (const [command, metadata] of Object.entries(SCHEMA_EXTENSOES_CLI_INTERATIVAS.commands)) {
    assert.ok(Array.isArray(metadata.inputSchemaKeys), command);
    assert.ok(Array.isArray(metadata.outputSchemaKeys), command);
    assert.ok(metadata.outputSchemaKeys.length > 0, command);
    assert.deepEqual(metadata.outputSchemaKeys, Object.keys(metadata.outputTargets), command);
    assert.equal(Object.values(metadata.outputTargets).every((segments) => segments[0] === "resultado"), true, command);
    assert.ok(Array.isArray(metadata.officialFixturePaths), command);
    for (const key of [...metadata.inputSchemaKeys, ...metadata.outputSchemaKeys]) {
      assert.ok(key in SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemaShapes, `${command}:${key}`);
    }
    if (command !== "descrever-ir") assert.ok(metadata.officialFixturePaths.length > 0, command);
    if (command === "operar-acceptance") {
      assert.deepEqual(metadata.contextRequiredTopLevelFields, ["artifactDigest", "sceneId", "timeRange"]);
    } else {
      assert.equal("contextRequiredTopLevelFields" in metadata, false, command);
    }
  }

  const schema = await executarComandoSistemasInterativos(["schema"]);
  assert.equal(schema.exitCode, 0);
  assert.deepEqual(schema.payload.interactiveExtensions, SCHEMA_EXTENSOES_CLI_INTERATIVAS);
  verificarFronteira(schema.payload);

  const capabilities = await executarComandoSistemasInterativos(["capabilities"]);
  assert.equal(capabilities.exitCode, 0);
  assert.deepEqual(capabilities.payload.extensionCommands, [...SUBCOMANDOS_EXTENSAO_INTERATIVA]);
  assert.equal(capabilities.payload.extensionSchemaVersion, SCHEMA_EXTENSOES_CLI_INTERATIVAS.schemaVersion);
  verificarFronteira(capabilities.payload);
});

test("fixtures e resultados oficiais permanecem alinhados aos shapes anunciados", async () => {
  const shapes: Readonly<Record<string, {
    readonly schemaVersion: string;
    readonly requiredTopLevelFields: readonly string[];
    readonly officialFixturePaths: readonly string[];
  }>> = SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemaShapes;

  for (const [schemaKey, shape] of Object.entries(shapes)) {
    for (const fixturePath of shape.officialFixturePaths) {
      const fixtureValue = JSON.parse(await readFile(path.resolve(fixturePath), "utf8")) as Record<string, unknown>;
      for (const field of shape.requiredTopLevelFields) {
        assert.ok(Object.prototype.hasOwnProperty.call(fixtureValue, field), `${schemaKey}:${field}`);
      }
      if (shape.requiredTopLevelFields.includes("schemaVersion")) {
        assert.equal(fixtureValue.schemaVersion, shape.schemaVersion, `${schemaKey}:schemaVersion`);
      }
    }
  }
  const acceptanceMetadata = SCHEMA_EXTENSOES_CLI_INTERATIVAS.commands["operar-acceptance"];
  const acceptanceContext = JSON.parse(await readFile(path.resolve(acceptanceMetadata.officialFixturePaths[1]), "utf8")) as Record<string, unknown>;
  for (const field of acceptanceMetadata.contextRequiredTopLevelFields) {
    assert.ok(Object.prototype.hasOwnProperty.call(acceptanceContext, field), `operar-acceptance:${field}`);
  }

  const fixture = (name: string): string => path.resolve("exemplos/sistemas-interativos/advanced", name);
  const ir = path.resolve("exemplos/sistemas-interativos/experience-ir-valid.json");
  const snapshotBefore = fixture("engine-snapshot-before-valid.json");
  const snapshotAfter = fixture("engine-snapshot-after-valid.json");
  const acceptanceLock = fixture("acceptance-lock-valid.json");
  const temporal = fixture("temporal-valid.json");
  const cases: readonly {
    readonly args: readonly string[];
    readonly outputTargets: Readonly<Record<string, readonly string[]>>;
  }[] = [
    { args: ["validar-ir", ir], outputTargets: { experienceIrValidationResult: ["resultado"] } },
    { args: ["indexar-ir", ir], outputTargets: { experienceIrIndex: ["resultado", "indice"] } },
    { args: ["consultar-ir", ir, "--semantic-id", "scene.main"], outputTargets: { experienceIrIndexEntry: ["resultado", "entry"] } },
    { args: ["chunk-ir", ir, "--semantic-id", "entity.player"], outputTargets: { experienceIrChunk: ["resultado", "chunk"] } },
    { args: ["descrever-ir"], outputTargets: { experienceIrSerialization: ["resultado", "descriptor"] } },
    { args: ["validar-engine-snapshot", snapshotBefore], outputTargets: { operationResult: ["resultado"] } },
    { args: ["diff-engine-snapshots", snapshotBefore, snapshotAfter], outputTargets: { operationResult: ["resultado"], engineDiff: ["resultado", "value"] } },
    { args: ["validar-asset-provenance", fixture("asset-provenance-valid.json")], outputTargets: { operationResult: ["resultado"] } },
    { args: ["validar-editor-state", fixture("editor-state-valid.json")], outputTargets: { operationResult: ["resultado"] } },
    { args: ["planejar-jobs", fixture("job-orchestration-valid.json")], outputTargets: { operationResult: ["resultado"], jobOrchestrationPlan: ["resultado", "value"] } },
    { args: ["validar-acceptance", acceptanceLock], outputTargets: { operationResult: ["resultado"] } },
    {
      args: ["operar-acceptance", acceptanceLock, "--operation", "EVALUATE", "--context-file", fixture("acceptance-context-evaluate-valid.json")],
      outputTargets: { operationResult: ["resultado"] },
    },
    { args: ["validar-multimodal", fixture("multimodal-evidence-valid.json")], outputTargets: { operationResult: ["resultado"] } },
    { args: ["validar-temporal", temporal], outputTargets: { temporalValidationResult: ["resultado"] } },
    {
      args: ["validar-evidencia-temporal", temporal, "--bundle-arquivo", fixture("temporal-evidence-valid.json")],
      outputTargets: { temporalEvidenceValidationResult: ["resultado"] },
    },
    { args: ["validar-autonomia", fixture("autonomy-repair-valid.json")], outputTargets: { autonomyValidationResult: ["resultado"] } },
    { args: ["validar-playtest-fuzz", fixture("playtest-fuzz-valid.json")], outputTargets: { playtestFuzzValidationResult: ["resultado"] } },
    { args: ["validar-multiplayer", fixture("multiplayer-authority-valid.json")], outputTargets: { multiplayerValidationResult: ["resultado"] } },
    { args: ["analisar-portabilidade", fixture("portability-valid.json")], outputTargets: { portabilityAnalysisResult: ["resultado"] } },
    { args: ["validar-workers", fixture("distributed-workers-valid.json")], outputTargets: { distributedWorkersValidationResult: ["resultado"] } },
  ];

  assert.deepEqual(cases.map(({ args }) => args[0]), [...SUBCOMANDOS_EXTENSAO_INTERATIVA]);
  for (const testCase of cases) {
    const command = testCase.args[0] as keyof typeof SCHEMA_EXTENSOES_CLI_INTERATIVAS.commands;
    const metadata = SCHEMA_EXTENSOES_CLI_INTERATIVAS.commands[command];
    assert.deepEqual(metadata.outputSchemaKeys, Object.keys(testCase.outputTargets), command);
    assert.deepEqual(metadata.outputTargets, testCase.outputTargets, command);
    const response = await executarComandoSistemasInterativos(testCase.args);
    assert.equal(response.exitCode, 0, command);
    const result = response.payload.resultado;
    assert.ok(result !== null && typeof result === "object" && !Array.isArray(result), command);
    for (const [schemaKey, segments] of Object.entries(testCase.outputTargets)) {
      let output: unknown = response.payload;
      for (const segment of segments) {
        assert.ok(output !== null && typeof output === "object" && !Array.isArray(output), `${command}:${schemaKey}`);
        output = (output as Record<string, unknown>)[segment];
      }
      assert.ok(output !== null && typeof output === "object" && !Array.isArray(output), `${command}:${schemaKey}`);
      const shape = shapes[schemaKey];
      assert.ok(shape, `${command}:${schemaKey}:shape`);
      for (const field of shape.requiredTopLevelFields) {
        assert.ok(Object.prototype.hasOwnProperty.call(output, field), `${command}:${schemaKey}:${field}`);
      }
      if (shape.requiredTopLevelFields.includes("schemaVersion")) {
        assert.equal((output as Record<string, unknown>).schemaVersion, shape.schemaVersion, `${command}:${schemaKey}:schemaVersion`);
      }
    }
    if (command === "planejar-jobs") {
      const queue = ((result as Record<string, unknown>).value as Record<string, unknown>).queue;
      assert.ok(Array.isArray(queue) && queue.length > 0, "planejar-jobs:queue");
      for (const assignment of queue) {
        for (const field of ["position", "jobId", "kind", "priority", "adapter"]) {
          assert.ok(Object.prototype.hasOwnProperty.call(assignment, field), `planejar-jobs:queue:${field}`);
        }
      }
    }
  }
});

test("Experience IR valida, indexa, consulta, recorta e descreve sem executar", async () => {
  const arquivo = path.resolve("exemplos/sistemas-interativos/experience-ir-valid.json");
  const comandos: readonly (readonly string[])[] = [
    ["validar-ir", arquivo],
    ["indexar-ir", arquivo],
    ["consultar-ir", arquivo, "--semantic-id", "scene.main"],
    ["chunk-ir", arquivo, "--semantic-id", "entity.player"],
    ["chunk-ir", arquivo, "--semantic-id", "entity.player", "--raso"],
    ["descrever-ir"],
  ];
  for (const args of comandos) {
    const resposta = await executarComandoSistemasInterativos(args);
    assert.equal(resposta.exitCode, 0, args.join(" "));
    assert.equal(resposta.payload.sucesso, true, args.join(" "));
    verificarFronteira(resposta.payload);
  }
});

test("E2E valido executa os 20 subcomandos avancados com fixtures publicas", async () => {
  const ir = path.resolve("exemplos/sistemas-interativos/experience-ir-valid.json");
  const fixture = (nome: string): string =>
    path.resolve("exemplos/sistemas-interativos/advanced", nome);
  const snapshotAntes = fixture("engine-snapshot-before-valid.json");
  const snapshotDepois = fixture("engine-snapshot-after-valid.json");
  const acceptanceLock = fixture("acceptance-lock-valid.json");
  const temporal = fixture("temporal-valid.json");
  const casos: readonly (readonly string[])[] = [
    ["validar-ir", ir],
    ["indexar-ir", ir],
    ["consultar-ir", ir, "--semantic-id", "scene.main"],
    ["chunk-ir", ir, "--semantic-id", "entity.player"],
    ["descrever-ir"],
    ["validar-engine-snapshot", snapshotAntes],
    ["diff-engine-snapshots", snapshotAntes, snapshotDepois],
    ["validar-asset-provenance", fixture("asset-provenance-valid.json")],
    ["validar-editor-state", fixture("editor-state-valid.json")],
    ["planejar-jobs", fixture("job-orchestration-valid.json")],
    ["validar-acceptance", acceptanceLock],
    [
      "operar-acceptance",
      acceptanceLock,
      "--operation",
      "EVALUATE",
      "--context-file",
      fixture("acceptance-context-evaluate-valid.json"),
    ],
    ["validar-multimodal", fixture("multimodal-evidence-valid.json")],
    ["validar-temporal", temporal],
    [
      "validar-evidencia-temporal",
      temporal,
      "--bundle-arquivo",
      fixture("temporal-evidence-valid.json"),
    ],
    ["validar-autonomia", fixture("autonomy-repair-valid.json")],
    ["validar-playtest-fuzz", fixture("playtest-fuzz-valid.json")],
    ["validar-multiplayer", fixture("multiplayer-authority-valid.json")],
    ["analisar-portabilidade", fixture("portability-valid.json")],
    ["validar-workers", fixture("distributed-workers-valid.json")],
  ];

  assert.equal(casos.length, SUBCOMANDOS_EXTENSAO_INTERATIVA.length);
  assert.deepEqual(
    casos.map(([comando]) => comando),
    [...SUBCOMANDOS_EXTENSAO_INTERATIVA],
  );

  for (const args of casos) {
    const resposta = await executarComandoSistemasInterativos(args);
    const contexto = args.join(" ");
    assert.equal(resposta.exitCode, 0, contexto);
    assert.equal(resposta.payload.sucesso, true, contexto);
    assert.equal(resposta.payload.comando, args[0], contexto);
    assert.equal(resposta.payload.errorCode, undefined, contexto);
    assert.equal(typeof resposta.payload.resultado, "object", contexto);
    verificarFronteira(resposta.payload);
  }
});

test("todos os dispatches avancados reconhecem o comando e preservam falha estrutural", async () => {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), "sema-interactive-extension-"));
  try {
    const vazio = path.join(diretorio, "empty.json");
    await writeFile(vazio, "{}", "utf8");
    const casos: readonly (readonly string[])[] = [
      ["validar-ir", vazio],
      ["indexar-ir", vazio],
      ["consultar-ir", vazio, "--semantic-id", "scene.main"],
      ["chunk-ir", vazio, "--semantic-id", "scene.main"],
      ["validar-engine-snapshot", vazio],
      ["diff-engine-snapshots", vazio, vazio],
      ["validar-asset-provenance", vazio],
      ["validar-editor-state", vazio],
      ["planejar-jobs", vazio],
      ["validar-acceptance", vazio],
      ["operar-acceptance", vazio, "--operation", "VALIDATE", "--context-file", vazio],
      ["validar-multimodal", vazio],
      ["validar-temporal", vazio],
      ["validar-evidencia-temporal", vazio, "--bundle-arquivo", vazio],
      ["validar-autonomia", vazio],
      ["validar-playtest-fuzz", vazio],
      ["validar-multiplayer", vazio],
      ["analisar-portabilidade", vazio],
      ["validar-workers", vazio],
    ];
    for (const args of casos) {
      const resposta = await executarComandoSistemasInterativos(args);
      assert.equal(resposta.exitCode, 1, args.join(" "));
      assert.equal(resposta.payload.sucesso, false, args.join(" "));
      assert.equal(resposta.payload.comando, args[0], args.join(" "));
      assert.equal(resposta.payload.errorCode, undefined, args.join(" "));
      assert.equal(typeof resposta.payload.resultado, "object", args.join(" "));
      verificarFronteira(resposta.payload);
    }
  } finally {
    await rm(diretorio, { recursive: true, force: true });
  }
});

test("allowlist avancada rejeita ausencias, duplicatas, flags e enums invalidos", async () => {
  const casos: readonly (readonly string[])[] = [
    ["consultar-ir", "ir.json"],
    ["consultar-ir", "ir.json", "--semantic-id", "scene.main", "--semantic-id", "scene.other"],
    ["validar-ir", "ir.json", "--raso"],
    ["chunk-ir", "ir.json", "--semantic-id"],
    ["operar-acceptance", "lock.json", "--operation", "EXECUTE", "--context-file", "context.json"],
    ["validar-evidencia-temporal", "contract.json", "--bundle-arquivo", "a.json", "--evidencias-arquivo", "b.json"],
  ];
  for (const args of casos) {
    const resposta = await executarComandoSistemasInterativos(args);
    assert.equal(resposta.exitCode, 1, args.join(" "));
    assert.equal(resposta.payload.sucesso, false, args.join(" "));
    assert.ok(
      resposta.payload.errorCode === "INTERATIVO_ARGUMENTOS_INVALIDOS"
        || resposta.payload.errorCode === "INTERATIVO_FILTRO_INVALIDO",
      args.join(" "),
    );
    assert.equal(resposta.payload.resultado, undefined, args.join(" "));
    verificarFronteira(resposta.payload);
  }
});

test("schema anuncia e o parser aceita o alias temporal publico isoladamente", async () => {
  assert.deepEqual(
    SCHEMA_EXTENSOES_CLI_INTERATIVAS.commands["validar-evidencia-temporal"].options,
    ["--bundle-arquivo", "--evidencias-arquivo"],
  );
  const resposta = await executarComandoSistemasInterativos([
    "validar-evidencia-temporal",
    "exemplos/sistemas-interativos/advanced/temporal-valid.json",
    "--evidencias-arquivo",
    "exemplos/sistemas-interativos/advanced/temporal-evidence-valid.json",
    "--json",
  ]);
  assert.equal(resposta.exitCode, 0);
  assert.equal(resposta.payload.sucesso, true);
  verificarFronteira(resposta.payload);
});

test("erro de arquivo nao ecoa path, token, semantic ID ou stack", async () => {
  const segredo = "Bearer segredo-super-controlado";
  const semanticId = "scene.secretissima";
  const arquivo = path.join(os.tmpdir(), segredo, semanticId, "nao-existe.json");
  const resposta = await executarComandoSistemasInterativos([
    "consultar-ir", arquivo, "--semantic-id", semanticId,
  ]);
  assert.equal(resposta.exitCode, 1);
  assert.equal(resposta.payload.errorCode, "INTERATIVO_ENTRADA_INVALIDA");
  const serializado = JSON.stringify(resposta.payload);
  for (const valor of [segredo, semanticId, arquivo, "stack"]) {
    assert.equal(serializado.includes(valor), false, valor);
  }
  verificarFronteira(resposta.payload);
});
