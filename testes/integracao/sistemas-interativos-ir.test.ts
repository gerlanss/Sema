// SEMA-GOVERNED: sema.produto.sistemas_interativos.ir
// Contratos: contratos/sema/sistemas_interativos_ir.sema e sistemas_interativos_ir_semantica.sema
// Descrição: provas focadas e adversariais do Experience IR v1 declarativo e não autoritativo.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  consultarIndiceExperienceIr,
  criarChunkExperienceIr,
  descreverSerializacaoExperienceIr,
  indexarExperienceIr,
  validarSemanticaExperienceIr,
  validarExperienceIr,
} from "../../pacotes/cli/src/sistemasInterativos/experienceIr.js";

const FIXTURE = path.resolve("exemplos/sistemas-interativos/experience-ir-valid.json");
const KINDS = [
  "PROJECT", "WORLD", "SCENE", "ENTITY", "COMPONENT", "TRANSFORM", "CAMERA", "LIGHT",
  "MATERIAL", "TEXTURE", "AUDIO", "PHYSICS", "CONSTRAINT", "ANIMATION", "VFX", "TIMELINE",
  "INPUT", "SAVE", "NETWORK", "BUILD",
];
const SEMANTIC_ROLES = [
  "LEVEL", "PIVOT", "COLLIDER", "EMITTER", "TRACK", "CLIP", "EVENT", "GAME_STATE",
];

function fixture(): Record<string, any> {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, any>;
}

function assertBoundary(value: Record<string, any>): void {
  assert.equal(value.executed, false);
  assert.equal(value.workspaceMutated, false);
  assert.equal(value.authoritative, false);
}

function reorderKeys(value: any): any {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reorderKeys(child)]));
  }
  return value;
}

test("fixture cobre todos os kinds e produz digest canônico estável", () => {
  const source = fixture();
  const first = validarExperienceIr(source);
  const reordered = validarExperienceIr(reorderKeys(source));
  assert.equal(first.valido, true, JSON.stringify(first.issues));
  assert.deepEqual(first.issues, []);
  assert.match(first.documentDigest ?? "", /^sha256:[a-f0-9]{64}$/u);
  assert.equal(reordered.documentDigest, first.documentDigest);
  assertBoundary(first);

  const indexed = indexarExperienceIr(source);
  assert.equal(indexed.sucesso, true, JSON.stringify(indexed.issues));
  assert.ok(indexed.indice);
  assert.equal(indexed.indice.entries.length, 20);
  assert.deepEqual([...new Set(indexed.indice.entries.map((entry) => entry.kind))].sort(), [...KINDS].sort());
  assert.deepEqual(
    [...new Set(indexed.indice.entries.flatMap((entry) => entry.semanticRoles))].sort(),
    [...SEMANTIC_ROLES].sort(),
  );
  assert.ok(indexed.indice.entries.every((entry) => entry.path.startsWith("/")));
  assert.ok(indexed.indice.entries.every((entry) => /^sha256:[a-f0-9]{64}$/u.test(entry.contentDigest)));
  assertBoundary(indexed);
});

test("índice é consultável sem ecoar consulta ausente", () => {
  const indexed = indexarExperienceIr(fixture());
  assert.ok(indexed.indice);
  const found = consultarIndiceExperienceIr(indexed.indice, "scene.main");
  assert.equal(found.encontrado, true);
  assert.equal(found.entry?.kind, "SCENE");
  assert.deepEqual(found.entry?.semanticRoles, ["LEVEL"]);
  assert.equal(found.entry?.path, "/scenes/0");
  assertBoundary(found);

  const sensitiveValue = "entity.secret_token_90125";
  const missing = consultarIndiceExperienceIr(indexed.indice, sensitiveValue);
  assert.equal(missing.encontrado, false);
  assert.equal(missing.entry, null);
  assert.doesNotMatch(JSON.stringify(missing), new RegExp(sensitiveValue, "u"));
  assertBoundary(missing);
});

test("chunk transitivo fecha dependências e chunk raso declara referências externas", () => {
  const source = fixture();
  const transitive = criarChunkExperienceIr(source, ["scene.main"], true);
  const repeated = criarChunkExperienceIr(reorderKeys(source), ["scene.main"], true);
  assert.equal(transitive.sucesso, true, JSON.stringify(transitive.issues));
  assert.ok(transitive.chunk);
  assert.deepEqual(transitive.chunk.entries.map((entry) => entry.semanticId), [
    "camera.main", "component.player_state", "entity.player", "light.sun", "scene.main", "transform.origin",
  ]);
  assert.deepEqual(
    transitive.chunk.entries.flatMap((entry) => entry.semanticRoles).sort(),
    ["LEVEL", "PIVOT"],
  );
  assert.deepEqual(transitive.chunk.externalReferences, []);
  assert.equal(repeated.chunk?.chunkDigest, transitive.chunk.chunkDigest);
  assert.match(transitive.chunk.chunkDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.notEqual(transitive.chunk.requestedSemanticIdDigests[0], "scene.main");
  assertBoundary(transitive);

  const shallow = criarChunkExperienceIr(source, ["scene.main"], false);
  assert.equal(shallow.sucesso, true);
  assert.deepEqual(shallow.chunk?.entries.map((entry) => entry.semanticId), ["scene.main"]);
  assert.deepEqual(shallow.chunk?.entries[0]?.semanticRoles, ["LEVEL"]);
  assert.deepEqual(shallow.chunk?.externalReferences, ["camera.main", "entity.player", "light.sun"]);
  assertBoundary(shallow);
});

test("descritor assume JSON v1 nativo e deixa CBOR explicitamente externo e não codificado", () => {
  const result = descreverSerializacaoExperienceIr();
  assert.equal(result.sucesso, true);
  assert.equal(result.descriptor?.json.native, true);
  assert.equal(result.descriptor?.json.version, "1");
  assert.equal(result.descriptor?.cbor.support, "EXTERNAL");
  assert.equal(result.descriptor?.cbor.installed, false);
  assert.equal(result.descriptor?.cbor.encoded, false);
  assert.equal(result.descriptor?.cbor.codec, null);
  assert.equal(result.descriptor?.semanticRoles.nodeKindCount, 20);
  assert.equal(result.descriptor?.semanticRoles.compatibility, "OPTIONAL_TYPED_ROLES");
  assert.deepEqual(
    result.descriptor?.semanticRoles.mappings.map((mapping) => mapping.role),
    SEMANTIC_ROLES,
  );
  assert.equal("bytes" in (result.descriptor?.cbor ?? {}), false);
  assertBoundary(result);

  const invalid = descreverSerializacaoExperienceIr("sema.experience-ir/v999");
  assert.equal(invalid.sucesso, false);
  assert.equal(invalid.descriptor, null);
  assertBoundary(invalid);
});

test("papéis tipados permanecem explícitos e falham fechados quando malformados", () => {
  const source = fixture();
  assert.equal(source.scenes[0].semanticRole, "LEVEL");
  assert.equal(source.transforms[0].semanticRole, "PIVOT");
  assert.equal(source.physics[0].colliders[0].semanticRole, "COLLIDER");
  assert.equal(source.vfx[0].emitters[0].semanticRole, "EMITTER");
  assert.equal(source.timelines[0].tracks[0].semanticRole, "TRACK");
  assert.equal(source.timelines[0].tracks[0].clips[0].semanticRole, "CLIP");
  assert.equal(source.timelines[0].tracks[0].events[0].semanticRole, "EVENT");
  assert.equal(source.saves[0].semanticRole, "GAME_STATE");

  const wrongRole = fixture();
  wrongRole.scenes[0].semanticRole = "PIVOT";
  const roleResult = validarExperienceIr(wrongRole);
  assert.equal(roleResult.valido, false);
  assert.ok(roleResult.issues.some((issue) => issue.code === "IR_SEMANTIC_ROLE"));

  const invalidClip = fixture();
  invalidClip.timelines[0].tracks[0].clips[0].endSeconds = 3;
  const clipResult = validarExperienceIr(invalidClip);
  assert.equal(clipResult.valido, false);
  assert.ok(clipResult.issues.some((issue) => issue.code === "IR_CLIP_TIME"));

  const mixedCollider = fixture();
  mixedCollider.physics[0].colliders[0].halfExtentsMeters = [1, 1, 1];
  const colliderResult = validarExperienceIr(mixedCollider);
  assert.equal(colliderResult.valido, false);
  assert.ok(colliderResult.issues.some((issue) => issue.code === "IR_COLLIDER_SHAPE"));
});

test("rejeita IDs duplicados, referências declaradas divergentes, dangling e kind errado", () => {
  const duplicate = fixture();
  duplicate.worlds[0].semanticId = "project.demo";
  const duplicateResult = validarExperienceIr(duplicate);
  assert.equal(duplicateResult.valido, false);
  assert.ok(duplicateResult.issues.some((issue) => issue.code === "IR_DUPLICATE_SEMANTIC_ID"));

  const mismatch = fixture();
  mismatch.project.references = ["world.main"];
  const mismatchResult = validarExperienceIr(mismatch);
  assert.equal(mismatchResult.valido, false);
  assert.ok(mismatchResult.issues.some((issue) => issue.code === "IR_REFERENCE_DECLARATION"));

  const dangling = fixture();
  dangling.transforms[0].parentTransformId = "transform.missing";
  dangling.transforms[0].references = ["transform.missing"];
  const danglingResult = validarExperienceIr(dangling);
  assert.equal(danglingResult.valido, false);
  assert.ok(danglingResult.issues.some((issue) => issue.code === "IR_DANGLING_REFERENCE"));

  const wrongKind = fixture();
  wrongKind.scenes[0].cameraId = "entity.player";
  wrongKind.scenes[0].references = ["entity.player", "light.sun"];
  const wrongKindResult = validarExperienceIr(wrongKind);
  assert.equal(wrongKindResult.valido, false);
  assert.ok(wrongKindResult.issues.some((issue) => issue.code === "IR_REFERENCE_KIND"));
});

test("rejeita eixos ou escala inválidos e provenance opaca ou incoerente", () => {
  const coordinates = fixture();
  coordinates.coordinateSystem.axes.up = "Z";
  coordinates.coordinateSystem.axes.forward = "NEGATIVE_Z";
  coordinates.coordinateSystem.worldScaleMetersPerUnit = 0;
  const coordinateResult = validarExperienceIr(coordinates);
  assert.equal(coordinateResult.valido, false);
  assert.ok(coordinateResult.issues.some((issue) => issue.code === "IR_AXES_COLLINEAR"));
  assert.ok(coordinateResult.issues.some((issue) => issue.path === "$.coordinateSystem.worldScaleMetersPerUnit"));

  const opaque = fixture();
  delete opaque.textures[0].provenance.license;
  const opaqueResult = validarExperienceIr(opaque);
  assert.equal(opaqueResult.valido, false);
  assert.ok(opaqueResult.issues.some((issue) => issue.path.endsWith(".provenance.license")));

  const derived = fixture();
  derived.animations[0].provenance.derivations[0].outputHash = `sha256:${"9".repeat(64)}`;
  const derivedResult = validarExperienceIr(derived);
  assert.equal(derivedResult.valido, false);
  assert.ok(derivedResult.issues.some((issue) => issue.code === "IR_DERIVATION_FINAL_HASH"));
});

test("falha fechada para grafos hostis, números não JSON e chaves perigosas", () => {
  const cyclic = fixture();
  cyclic.extensions = { cycle: cyclic };
  const cyclicResult = validarExperienceIr(cyclic);
  assert.equal(cyclicResult.valido, false);
  assert.ok(cyclicResult.issues.some((issue) => issue.code === "IR_JSON_GRAPH"));

  const nonFinite = fixture();
  nonFinite.coordinateSystem.worldScaleMetersPerUnit = Number.POSITIVE_INFINITY;
  const numberResult = validarExperienceIr(nonFinite);
  assert.equal(numberResult.valido, false);
  assert.ok(numberResult.issues.some((issue) => issue.code === "IR_JSON_NUMBER"));

  const unsafe = fixture();
  unsafe.extensions = JSON.parse('{"__proto__":"hidden"}');
  const unsafeResult = validarExperienceIr(unsafe);
  assert.equal(unsafeResult.valido, false);
  assert.ok(unsafeResult.issues.some((issue) => issue.code === "IR_JSON_UNSAFE_KEY"));
});

test("rejeita valores sensíveis sob chaves neutras sem ecoar valor ou path controlado", () => {
  const valores = [
    "Bearer ultra-secret-value-1234567890",
    "sk_abcdefghijklmnopqrstuv",
    "ghp_abcdefghijklmnopqrstuv",
    "github_pat_abcdefghijklmnopqrstuv",
    ["-----BEGIN", "PRIVATE", "KEY-----"].join(" "),
  ];
  for (const segredo of valores) {
    const source = fixture();
    const chaveControlada = "neutral.operator.selected.path";
    source.components[0].properties = { [chaveControlada]: segredo };
    const result = validarExperienceIr(source);
    assert.equal(result.valido, false);
    assert.ok(result.issues.some((issue) => issue.code === "IR_SENSITIVE_VALUE"));
    const serializado = JSON.stringify(result);
    assert.equal(serializado.includes(segredo), false);
    assert.equal(serializado.includes(chaveControlada), false);

    const chunk = criarChunkExperienceIr(source, ["component.player_state"], false);
    assert.equal(chunk.sucesso, false);
    assert.equal(chunk.chunk, null);
    assert.equal(JSON.stringify(chunk).includes(segredo), false);
  }

  const caminhoControlado = "operator.path.with-secret-name";
  const direct = validarSemanticaExperienceIr([{
    kind: "SCENE",
    path: caminhoControlado,
    value: { semanticId: "scene.safe", semanticRole: "LEVEL", notes: valores[0] },
  }]);
  assert.equal(direct.valido, false);
  assert.ok(direct.issues.some((issue) => issue.code === "IR_SENSITIVE_VALUE"));
  assert.equal(JSON.stringify(direct).includes(valores[0]), false);
  assert.equal(JSON.stringify(direct).includes(caminhoControlado), false);
});

test("rejeita URI assinada ou credenciada antes que índice ou chunk possam ecoá-la", () => {
  const source = fixture();
  const uriAssinada = "https://assets.example.invalid/model.glb?X-Amz-Signature=never-echo-58291";
  source.textures[0].provenance.source.uri = uriAssinada;
  const validation = validarExperienceIr(source);
  assert.equal(validation.valido, false);
  assert.ok(validation.issues.some((issue) => issue.code === "IR_SENSITIVE_VALUE"));
  assert.equal(JSON.stringify(validation).includes(uriAssinada), false);

  const indexed = indexarExperienceIr(source);
  assert.equal(indexed.sucesso, false);
  assert.equal(indexed.indice, null);
  assert.equal(JSON.stringify(indexed).includes(uriAssinada), false);

  const chunk = criarChunkExperienceIr(source, ["texture.player_albedo"], false);
  assert.equal(chunk.sucesso, false);
  assert.equal(chunk.chunk, null);
  assert.equal(JSON.stringify(chunk).includes(uriAssinada), false);
});

test("rejeita self-parent e ciclos multi-nó em entity e transform sem ecoar IDs", () => {
  const entitySelf = fixture();
  entitySelf.entities[0].parentEntityId = "entity.player";
  entitySelf.entities[0].references.push("entity.player");
  const entitySelfResult = validarExperienceIr(entitySelf);
  assert.equal(entitySelfResult.valido, false);
  assert.ok(entitySelfResult.issues.some((issue) => issue.code === "IR_ENTITY_HIERARCHY_CYCLE"));

  const entityCycle = fixture();
  entityCycle.entities[0].parentEntityId = "entity.rival";
  entityCycle.entities[0].references.push("entity.rival");
  entityCycle.entities.push({
    ...structuredClone(entityCycle.entities[0]),
    semanticId: "entity.rival",
    name: "Rival",
    parentEntityId: "entity.player",
    references: ["component.player_state", "entity.player", "transform.origin"],
  });
  const entityCycleResult = validarExperienceIr(entityCycle);
  assert.equal(entityCycleResult.valido, false);
  assert.ok(entityCycleResult.issues.some((issue) => issue.code === "IR_ENTITY_HIERARCHY_CYCLE"));

  const transformSelf = fixture();
  transformSelf.transforms[0].parentTransformId = "transform.origin";
  transformSelf.transforms[0].references = ["transform.origin"];
  const transformSelfResult = validarExperienceIr(transformSelf);
  assert.equal(transformSelfResult.valido, false);
  assert.ok(transformSelfResult.issues.some((issue) => issue.code === "IR_TRANSFORM_HIERARCHY_CYCLE"));

  const transformCycle = fixture();
  transformCycle.transforms[0].parentTransformId = "transform.child";
  transformCycle.transforms[0].references = ["transform.child"];
  transformCycle.transforms.push({
    ...structuredClone(transformCycle.transforms[0]),
    semanticId: "transform.child",
    parentTransformId: "transform.origin",
    references: ["transform.origin"],
  });
  const transformCycleResult = validarExperienceIr(transformCycle);
  assert.equal(transformCycleResult.valido, false);
  assert.ok(transformCycleResult.issues.some((issue) => issue.code === "IR_TRANSFORM_HIERARCHY_CYCLE"));

  const serializado = JSON.stringify({ entitySelfResult, entityCycleResult, transformSelfResult, transformCycleResult });
  for (const id of ["entity.player", "entity.rival", "transform.origin", "transform.child"]) {
    assert.equal(serializado.includes(id), false);
  }
});

test("network aplica política coerente de mode, authority, replicação e tick", () => {
  const online = (mode: string, authority: string): Record<string, any> => {
    const source = fixture();
    source.networks[0].mode = mode;
    source.networks[0].authority = authority;
    source.networks[0].replicatedSemanticIds = ["entity.player"];
    source.networks[0].references = ["entity.player"];
    source.networks[0].tickRateHz = 60;
    return source;
  };
  for (const source of [
    fixture(),
    online("CLIENT_SERVER", "SERVER"),
    online("PEER_TO_PEER", "OWNER"),
    online("PEER_TO_PEER", "DISTRIBUTED"),
    online("LOCKSTEP", "DISTRIBUTED"),
  ]) {
    const result = validarExperienceIr(source);
    assert.equal(result.valido, true, JSON.stringify(result.issues));
  }

  const offlineReplication = fixture();
  offlineReplication.networks[0].replicatedSemanticIds = ["entity.player"];
  offlineReplication.networks[0].references = ["entity.player"];
  const offlineTick = fixture();
  offlineTick.networks[0].tickRateHz = 60;
  for (const source of [
    offlineReplication,
    offlineTick,
    online("CLIENT_SERVER", "NONE"),
    online("PEER_TO_PEER", "SERVER"),
    online("LOCKSTEP", "OWNER"),
  ]) {
    const result = validarExperienceIr(source);
    assert.equal(result.valido, false);
    assert.ok(result.issues.some((issue) => issue.code === "IR_NETWORK_POLICY"));
  }
});

test("extensions aceitam apenas descritores públicos content-addressed e nunca payload inline", () => {
  const valido = fixture();
  valido.scenes[0].extensions = {
    "vendor.navigation": {
      schemaVersion: "vendor.navigation/v1",
      payloadDigest: `sha256:${"8".repeat(64)}`,
      mediaType: "application/json",
    },
  };
  const validacao = validarExperienceIr(valido);
  assert.equal(validacao.valido, true, JSON.stringify(validacao.issues));
  const chunk = criarChunkExperienceIr(valido, ["scene.main"], false);
  assert.equal(chunk.sucesso, true, JSON.stringify(chunk.issues));
  assert.equal((chunk.chunk?.entries[0]?.value as any).extensions["vendor.navigation"].payloadDigest, `sha256:${"8".repeat(64)}`);

  const segredo = "nao-ecoar-extension-74921";
  const sensivel = fixture();
  sensivel.scenes[0].extensions = { apiToken: segredo };
  const resultado = validarExperienceIr(sensivel);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.issues.some((issue) => issue.code === "IR_SENSITIVE_KEY"));
  assert.doesNotMatch(JSON.stringify(resultado), new RegExp(segredo, "u"));
  const chunkBloqueado = criarChunkExperienceIr(sensivel, ["scene.main"], false);
  assert.equal(chunkBloqueado.sucesso, false);
  assert.equal(chunkBloqueado.chunk, null);
  assert.doesNotMatch(JSON.stringify(chunkBloqueado), new RegExp(segredo, "u"));

  const inline = fixture();
  inline.scenes[0].extensions = { "vendor.navigation": { schemaVersion: "vendor.navigation/v1", payload: { enabled: true } } };
  const inlineResultado = validarExperienceIr(inline);
  assert.equal(inlineResultado.valido, false);
  assert.ok(inlineResultado.issues.some((issue) => issue.code === "IR_UNKNOWN_FIELD"));
  assert.ok(inlineResultado.issues.some((issue) => issue.code === "IR_REQUIRED_STRING"));
});

test("erros e consultas de chunk não ecoam IDs, paths ou tokens recebidos", () => {
  const source = fixture();
  const sensitiveValue = "entity.secret_token_4f7138";
  const chunk = criarChunkExperienceIr(source, [sensitiveValue], true);
  assert.equal(chunk.sucesso, false);
  assert.equal(chunk.chunk, null);
  assert.doesNotMatch(JSON.stringify(chunk), new RegExp(sensitiveValue, "u"));
  assertBoundary(chunk);

  const invalid = fixture();
  const privateValue = "project.secret/path?token=NeverEchoThis";
  invalid.project.semanticId = privateValue;
  const result = validarExperienceIr(invalid);
  assert.equal(result.valido, false);
  assert.equal(result.documentDigest, null);
  assert.doesNotMatch(JSON.stringify(result), /NeverEchoThis/u);
  assert.doesNotMatch(JSON.stringify(result), /secret\/path/u);
  assertBoundary(result);
});
