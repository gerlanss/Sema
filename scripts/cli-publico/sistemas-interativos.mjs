// SEMA-GOVERNED: sema.produto.sistemas_interativos.distribuicao
// Consulte contratos/sema/sistemas_interativos_distribuicao.sema antes de editar.
// Descricao: exercita a superficie declarativa interativa do pacote instalado sem executar runtimes externos.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SCHEMA_CONTROLE_CLI_V1,
  SCHEMA_RESULTADO_CLI_V1,
} from "./resultado-cli.mjs";

export const EXEMPLOS_INTERATIVOS_PUBLICOS = [
  "exemplos/sistemas-interativos/README.md",
  "exemplos/sistemas-interativos/game-pixel-16-bit.json",
  "exemplos/sistemas-interativos/simulation-3d-calibrated-autonomous.json",
  "exemplos/sistemas-interativos/simulation-headless-autonomous-batch.json",
  "exemplos/sistemas-interativos/protocol-read-only-valid.json",
  "exemplos/sistemas-interativos/experience-ir-valid.json",
  "exemplos/sistemas-interativos/advanced/acceptance-context-evaluate-valid.json",
  "exemplos/sistemas-interativos/advanced/acceptance-lock-valid.json",
  "exemplos/sistemas-interativos/advanced/asset-provenance-valid.json",
  "exemplos/sistemas-interativos/advanced/autonomy-repair-valid.json",
  "exemplos/sistemas-interativos/advanced/control-run-definition-valid.json",
  "exemplos/sistemas-interativos/advanced/control-run-valid.json",
  "exemplos/sistemas-interativos/advanced/distributed-workers-valid.json",
  "exemplos/sistemas-interativos/advanced/editor-state-valid.json",
  "exemplos/sistemas-interativos/advanced/engine-snapshot-after-valid.json",
  "exemplos/sistemas-interativos/advanced/engine-snapshot-before-valid.json",
  "exemplos/sistemas-interativos/advanced/job-orchestration-valid.json",
  "exemplos/sistemas-interativos/advanced/multimodal-evidence-valid.json",
  "exemplos/sistemas-interativos/advanced/multiplayer-authority-valid.json",
  "exemplos/sistemas-interativos/advanced/playtest-fuzz-valid.json",
  "exemplos/sistemas-interativos/advanced/portability-valid.json",
  "exemplos/sistemas-interativos/advanced/temporal-evidence-valid.json",
  "exemplos/sistemas-interativos/advanced/temporal-valid.json",
];

function validarFronteiraInterativa(payload, comando) {
  if (
    payload.sucesso !== true ||
    payload.readOnly !== true ||
    payload.executed !== false ||
    payload.workspaceMutated !== false ||
    payload.authoritative !== false ||
    payload.externalExecutionRequired !== true
  ) {
    throw new Error(`The installed public CLI broke the declarative interactive boundary for ${comando}.`);
  }
}

function exigirPayloadParaFixture(valor, referencia) {
  if (
    valor
    && typeof valor === "object"
    && (valor.schemaVersion === SCHEMA_RESULTADO_CLI_V1 || valor.schemaVersion === SCHEMA_CONTROLE_CLI_V1)
  ) {
    throw new Error(`The installed-package fixture ${referencia} received a CLI envelope instead of its payload.`);
  }
  return valor;
}

export async function validarSistemasInterativosInstalados({
  semaBin,
  sandbox,
  projetoCodex,
  executarJsonCliInstalada,
}) {
  const schemaInterativo = executarJsonCliInstalada(semaBin, ["interativo", "schema"], sandbox);
  validarFronteiraInterativa(schemaInterativo, "interativo schema");
  if (
    schemaInterativo.readOnly !== true ||
    schemaInterativo.schemaVersion !== "sema.interativo.schema/v1" ||
    schemaInterativo.definitionSchema?.schemaVersion !== "1.0" ||
    !schemaInterativo.definitionSchema?.requiredFields?.includes("spatialModel") ||
    !schemaInterativo.definitionSchema?.requiredFields?.includes("renderMode") ||
    !schemaInterativo.definitionSchema?.fields?.spatialModel ||
    !schemaInterativo.definitionSchema?.fields?.renderMode ||
    !schemaInterativo.matrix?.spatialModels?.includes("THREE_D") ||
    !schemaInterativo.matrix?.renderModes?.includes("VISUAL") ||
    !schemaInterativo.examplePaths?.includes("exemplos/sistemas-interativos/simulation-3d-calibrated-autonomous.json") ||
    schemaInterativo.interactiveExtensions?.schemaVersion !== "sema.interactive.cli-extensions/v1" ||
    Object.keys(schemaInterativo.interactiveExtensions?.commands ?? {}).length !== 20 ||
    Object.keys(schemaInterativo.interactiveExtensions?.dataSchemaShapes ?? {}).length !== Object.keys(schemaInterativo.interactiveExtensions?.dataSchemas ?? {}).length ||
    !Object.values(schemaInterativo.interactiveExtensions?.commands ?? {}).every((command) => (
      Array.isArray(command.inputSchemaKeys) &&
      Array.isArray(command.outputSchemaKeys) &&
      command.outputTargets && typeof command.outputTargets === "object" &&
      command.outputSchemaKeys.every((key) => Array.isArray(command.outputTargets[key]) && command.outputTargets[key][0] === "resultado") &&
      Array.isArray(command.officialFixturePaths)
    )) ||
    !Object.values(schemaInterativo.interactiveExtensions?.dataSchemaShapes ?? {}).every((shape) => (
      shape.type === "object" &&
      typeof shape.schemaVersion === "string" &&
      Array.isArray(shape.requiredTopLevelFields) &&
      shape.requiredTopLevelFields.length > 0
    )) ||
    schemaInterativo.interactiveExtensions?.dataSchemas?.experienceIr !== "sema.experience-ir/v1" ||
    schemaInterativo.interactiveExtensions?.dataSchemas?.multiplayerAuthority !== "sema.interactive.multiplayer-authority/v1" ||
    schemaInterativo.interactiveExtensions?.dataSchemas?.distributedWorkers !== "sema.interactive.distributed-jobs/v1"
  ) {
    throw new Error("The installed public CLI exposed an incomplete interactive definition schema.");
  }

  const capabilitiesInterativas = executarJsonCliInstalada(
    semaBin,
    ["interativo", "capabilities"],
    sandbox,
  );
  validarFronteiraInterativa(capabilitiesInterativas, "interativo capabilities");
  if (
    !capabilitiesInterativas.capabilities?.length ||
    !capabilitiesInterativas.pipelineIds?.includes("simulation.calibrate") ||
    !capabilitiesInterativas.pipelineIds?.includes("interactive.portability") ||
    capabilitiesInterativas.extensionCommands?.length !== 20 ||
    !capabilitiesInterativas.extensionCommands?.includes("validar-ir") ||
    !capabilitiesInterativas.extensionCommands?.includes("validar-workers")
  ) {
    throw new Error("The installed public CLI exposed an incomplete interactive capability catalog.");
  }

  const pipelinesInterativas = executarJsonCliInstalada(
    semaBin,
    ["interativo", "pipelines"],
    sandbox,
  );
  validarFronteiraInterativa(pipelinesInterativas, "interativo pipelines");
  if (
    !pipelinesInterativas.pipelines?.some((item) => item.pipelineId === "simulation.safety") ||
    !pipelinesInterativas.pipelines?.some((item) => item.pipelineId === "interactive.experience_ir") ||
    !pipelinesInterativas.pipelines?.some((item) => item.pipelineId === "interactive.distributed_jobs") ||
    !pipelinesInterativas.pipelines?.every((item) => (
      Array.isArray(item.spatialModels) &&
      Array.isArray(item.renderModes) &&
      !("representations" in item)
    ))
  ) {
    throw new Error("The installed public CLI exposed an outdated interactive pipeline catalog.");
  }

  const adaptersInterativos = executarJsonCliInstalada(
    semaBin,
    [
      "interativo",
      "adapters",
      "--spatial-model",
      "THREE_D",
      "--render-mode",
      "VISUAL",
      "--role",
      "ENGINE",
    ],
    sandbox,
  );
  validarFronteiraInterativa(adaptersInterativos, "interativo adapters");
  if (
    !adaptersInterativos.adapters?.length ||
    !adaptersInterativos.adapters?.every((item) => (
      item.role === "ENGINE" &&
      item.spatialModels?.includes("THREE_D") &&
      item.renderModes?.includes("VISUAL") &&
      !("representations" in item)
    ))
  ) {
    throw new Error("The installed public CLI did not apply the spatial/render adapter filters.");
  }

  const definicaoInterativa = path.join(
    projetoCodex,
    "exemplos",
    "sistemas-interativos",
    "simulation-3d-calibrated-autonomous.json",
  );
  const protocoloInterativo = path.join(
    projetoCodex,
    "exemplos",
    "sistemas-interativos",
    "protocol-read-only-valid.json",
  );
  const experienceIrInterativa = path.join(
    projetoCodex,
    "exemplos",
    "sistemas-interativos",
    "experience-ir-valid.json",
  );
  const validacaoInterativa = executarJsonCliInstalada(
    semaBin,
    ["interativo", "validar", definicaoInterativa],
    sandbox,
  );
  validarFronteiraInterativa(validacaoInterativa, "interativo validar");
  if (validacaoInterativa.valida !== true || validacaoInterativa.bloqueios?.length !== 0) {
    throw new Error("The installed public CLI rejected its official calibrated 3D simulation example.");
  }

  const planoInterativo = executarJsonCliInstalada(
    semaBin,
    ["interativo", "planejar", definicaoInterativa],
    sandbox,
  );
  validarFronteiraInterativa(planoInterativo, "interativo planejar");
  if (
    planoInterativo.bloqueios?.length !== 0 ||
    planoInterativo.plano?.executed !== false ||
    !Array.isArray(planoInterativo.plano?.adaptersSelecionados) ||
    planoInterativo.plano?.adapterSelectionExplicit !== true ||
    planoInterativo.plano?.adapterCoverageComplete !== true ||
    planoInterativo.plano?.capabilitiesSemAdapter?.length !== 0 ||
    !planoInterativo.plano?.stageProviderMap?.length ||
    !planoInterativo.plano.stageProviderMap.every((item) => item.coveredBySelection === true)
  ) {
    throw new Error("The installed public CLI emitted an incomplete declarative interactive plan.");
  }

  const protocoloValidado = executarJsonCliInstalada(
    semaBin,
    ["interativo", "validar-protocolo", protocoloInterativo],
    sandbox,
  );
  validarFronteiraInterativa(protocoloValidado, "interativo validar-protocolo");
  if (
    protocoloValidado.valido !== true ||
    protocoloValidado.faseAtual !== "EVIDENCE" ||
    protocoloValidado.exigeRollback !== false ||
    protocoloValidado.bloqueios?.length !== 0
  ) {
    throw new Error("The installed public CLI rejected its official read-only adapter protocol.");
  }

  const irValidada = executarJsonCliInstalada(
    semaBin,
    ["interativo", "validar-ir", experienceIrInterativa],
    sandbox,
  );
  validarFronteiraInterativa(irValidada, "interativo validar-ir");
  if (irValidada.resultado?.valido !== true || !irValidada.resultado?.documentDigest) {
    throw new Error("The installed public CLI rejected its official Experience IR document.");
  }

  const irConsultada = executarJsonCliInstalada(
    semaBin,
    ["interativo", "consultar-ir", experienceIrInterativa, "--semantic-id", "scene.main"],
    sandbox,
  );
  validarFronteiraInterativa(irConsultada, "interativo consultar-ir");
  if (irConsultada.resultado?.encontrado !== true || irConsultada.resultado?.entry?.semanticId !== "scene.main") {
    throw new Error("The installed public CLI could not query its Experience IR semantic index.");
  }

  const serializacaoIr = executarJsonCliInstalada(semaBin, ["interativo", "descrever-ir"], sandbox);
  validarFronteiraInterativa(serializacaoIr, "interativo descrever-ir");
  if (
    serializacaoIr.resultado?.descriptor?.json?.native !== true ||
    serializacaoIr.resultado?.descriptor?.cbor?.support !== "EXTERNAL" ||
    serializacaoIr.resultado?.descriptor?.cbor?.installed !== false
  ) {
    throw new Error("The installed public CLI misrepresented Experience IR serialization support.");
  }

  const fixtureAvancada = (nome) => path.join(
    projetoCodex,
    "exemplos",
    "sistemas-interativos",
    "advanced",
    nome,
  );
  const snapshotAntes = fixtureAvancada("engine-snapshot-before-valid.json");
  const snapshotDepois = fixtureAvancada("engine-snapshot-after-valid.json");
  const acceptanceLock = fixtureAvancada("acceptance-lock-valid.json");
  const temporal = fixtureAvancada("temporal-valid.json");
  const comandosAvancadosInstalados = [
    ["validar-ir", experienceIrInterativa],
    ["indexar-ir", experienceIrInterativa],
    ["consultar-ir", experienceIrInterativa, "--semantic-id", "scene.main"],
    ["chunk-ir", experienceIrInterativa, "--semantic-id", "entity.player"],
    ["descrever-ir"],
    ["validar-engine-snapshot", snapshotAntes],
    ["diff-engine-snapshots", snapshotAntes, snapshotDepois],
    ["validar-asset-provenance", fixtureAvancada("asset-provenance-valid.json")],
    ["validar-editor-state", fixtureAvancada("editor-state-valid.json")],
    ["planejar-jobs", fixtureAvancada("job-orchestration-valid.json")],
    ["validar-acceptance", acceptanceLock],
    ["operar-acceptance", acceptanceLock, "--operation", "EVALUATE", "--context-file", fixtureAvancada("acceptance-context-evaluate-valid.json")],
    ["validar-multimodal", fixtureAvancada("multimodal-evidence-valid.json")],
    ["validar-temporal", temporal],
    ["validar-evidencia-temporal", temporal, "--bundle-arquivo", fixtureAvancada("temporal-evidence-valid.json")],
    ["validar-autonomia", fixtureAvancada("autonomy-repair-valid.json")],
    ["validar-playtest-fuzz", fixtureAvancada("playtest-fuzz-valid.json")],
    ["validar-multiplayer", fixtureAvancada("multiplayer-authority-valid.json")],
    ["analisar-portabilidade", fixtureAvancada("portability-valid.json")],
    ["validar-workers", fixtureAvancada("distributed-workers-valid.json")],
  ];
  if (comandosAvancadosInstalados.length !== 20 || new Set(comandosAvancadosInstalados.map(([command]) => command)).size !== 20) {
    throw new Error("The installed-package advanced smoke matrix does not cover exactly 20 unique commands.");
  }
  for (const argumentos of comandosAvancadosInstalados) {
    const payload = executarJsonCliInstalada(semaBin, ["interativo", ...argumentos], sandbox);
    validarFronteiraInterativa(payload, `interativo ${argumentos[0]}`);
    if (!payload.resultado || typeof payload.resultado !== "object") {
      throw new Error(`The installed advanced command ${argumentos[0]} did not return a structured result.`);
    }
  }

  const controlDefinition = fixtureAvancada("control-run-definition-valid.json");
  const controlManifest = fixtureAvancada("control-run-valid.json");
  const temporalEvidence = fixtureAvancada("temporal-evidence-valid.json");
  const controlPlan = executarJsonCliInstalada(semaBin, ["interativo", "planejar", controlDefinition], sandbox);
  const temporalResult = executarJsonCliInstalada(semaBin, ["interativo", "validar-evidencia-temporal", temporal, "--bundle-arquivo", temporalEvidence], sandbox);
  const controlPlanFile = path.join(sandbox, "control-run-plan.json");
  const controlResultFile = path.join(sandbox, "control-run-result.json");
  await Promise.all([
    writeFile(controlPlanFile, JSON.stringify(exigirPayloadParaFixture(controlPlan.plano, "control plan")), "utf8"),
    writeFile(controlResultFile, JSON.stringify(exigirPayloadParaFixture(temporalResult, "temporal result")), "utf8"),
  ]);
  const controlRun = executarJsonCliInstalada(semaBin, [
    "interativo", "validar-control-run", controlManifest,
    "--definition-arquivo", controlDefinition, "--plano-arquivo", controlPlanFile,
    "--contrato-arquivo", temporal, "--entrada-arquivo", temporal,
    "--entrada-auxiliar-arquivo", temporalEvidence, "--evidencia-arquivo", temporalEvidence,
    "--resultado-arquivo", controlResultFile,
  ], sandbox);
  validarFronteiraInterativa(controlRun, "interativo validar-control-run");
  const controlBindings = controlRun.resultado?.bindings;
  if (controlRun.resultado?.valid !== true
    || !Array.isArray(controlBindings)
    || controlBindings.length !== 8
    || !controlBindings.every((binding) => binding.matched === true)) {
    throw new Error("The installed public CLI could not validate its fully bound control run.");
  }
}
