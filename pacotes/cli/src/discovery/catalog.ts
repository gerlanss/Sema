// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: registro canônico derivado de profiles, conteúdo e sistemas interativos.

import type { AlvoGeracao } from "@sema/padroes";
import {
  ALIASES_PROFILE,
  CAPABILITY_MATRIX_GOVERNANCA,
  PRESETS_PROFILE,
} from "../profileCatalogo.js";
import type { PerfilSemanticoValidavel } from "../profileAuthorTipos.js";
import { CAPABILITIES_CONTEUDO_PADRAO } from "../pipelineConteudo/adapters.js";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS,
  CATALOGO_CAPABILITIES_INTERATIVAS,
  CATALOGO_PIPELINES_INTERATIVOS,
} from "../sistemasInterativos/catalog.js";
import {
  DISCOVERY_KINDS,
  DISCOVERY_SCHEMA_VERSION,
  type DiscoveryCatalogFilters,
  type DiscoveryCatalogPayload,
  type DiscoveryCommandTemplate,
  type DiscoveryEntry,
  type DiscoveryKind,
  type ResumoDescobertaAgentContext,
} from "./types.js";
import { redigirTextoControladoDescoberta } from "./redaction.js";

const PROFILE_LABELS: Record<PerfilSemanticoValidavel, string> = {
  software: "Software",
  workflow: "Workflow",
  ops: "Operações",
  game: "Game",
  simulation: "Simulação",
  legal: "Legal",
  research: "Pesquisa",
  redacao: "Redação",
  propostas: "Propostas comerciais",
  conversas: "Conversas",
};

const ALVOS_GERACAO = [
  "typescript",
  "python",
  "dart",
  "lua",
  "javascript",
  "html",
  "css",
  "php",
  "dotnet",
  "cpp",
] as const satisfies readonly AlvoGeracao[];

type CapabilityConteudo = (typeof CAPABILITIES_CONTEUDO_PADRAO)[number];

const CONTEUDO_METADATA: Record<CapabilityConteudo, {
  readonly label: string;
  readonly summary: string;
  readonly signals: readonly string[];
}> = {
  "content.topic.plan": {
    label: "Planejamento de pauta",
    summary: "Planeja tema, público, objetivo e entregáveis antes da produção.",
    signals: ["pauta", "tema", "briefing", "planejar conteúdo"],
  },
  "content.research.collect": {
    label: "Pesquisa de conteúdo",
    summary: "Coleta evidências e fontes para sustentar o conteúdo mestre.",
    signals: ["pesquisar fontes", "coletar evidências", "pesquisa editorial"],
  },
  "content.master.compose": {
    label: "Composição mestre",
    summary: "Compõe o artefato mestre do qual deriva a adaptação por destino.",
    signals: ["conteúdo mestre", "roteiro mestre", "compor conteúdo"],
  },
  "content.target.adapt": {
    label: "Adaptação por destino",
    summary: "Adapta o conteúdo mestre para cada canal, formato e conta isolada.",
    signals: ["adaptar por canal", "multicanal", "multi-formato", "formato por destino"],
  },
  "content.qa.deterministic": {
    label: "QA determinístico",
    summary: "Verifica limites e propriedades observáveis sem decisão subjetiva.",
    signals: ["qa determinístico", "limite de duração", "tamanho do artefato"],
  },
  "content.qa.semantic": {
    label: "QA semântico",
    summary: "Representa avaliação semântica especializada com evidência e atestação.",
    signals: ["qa semântico", "avaliar qualidade", "avaliação especializada"],
  },
  "content.target.deliver": {
    label: "Entrega por destino",
    summary: "Representa a entrega externa isolada por destino e conta.",
    signals: ["entregar", "publicar", "enviar por canal", "delivery"],
  },
  "content.target.confirm": {
    label: "Confirmação de entrega",
    summary: "Confirma entrega por evidência externa, sem confiar apenas no executor.",
    signals: ["confirmar publicação", "confirmar entrega", "atestar entrega"],
  },
};

const EXECUTION_BOUNDARY = {
  executed: false,
  workspaceMutated: false,
  externalCalls: false,
  requiresExplicitRun: true,
} as const;

function unicos(valores: readonly (string | null | undefined)[]): string[] {
  return [...new Set(valores.filter((valor): valor is string => typeof valor === "string").map((valor) => valor.trim()).filter(Boolean))];
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

export function normalizarDiscoveryKind(valor: string | null | undefined): DiscoveryKind | null {
  if (!valor) return null;
  const chave = normalizar(valor).replace(/\./gu, "_").toUpperCase();
  return DISCOVERY_KINDS.find((kind) => kind === chave) ?? null;
}

function template(
  id: string,
  command: string,
  effectClass: DiscoveryCommandTemplate["effectClass"],
  mutatesWorkspace = false,
  executesExternalRuntime = false,
): DiscoveryCommandTemplate {
  return { id, command, effectClass, mutatesWorkspace, executesExternalRuntime };
}

function entradasGovernanca(): DiscoveryEntry[] {
  return [
    {
      id: "flow.governed-change",
      kind: "GOVERNANCE_FLOW",
      domains: ["governanca", "mudanca"],
      label: "Mudança governada",
      summary: "Descobre contrato, documentação, drift e impacto antes de alterar comportamento.",
      useWhen: ["editar código, contrato, workflow, profile, documentação operacional ou deploy"],
      avoidWhen: ["a solicitação é apenas informativa e não altera o workspace"],
      intentSignals: ["alterar código", "editar contrato", "drift", "impacto", "mudança governada"],
      negativeSignals: ["somente explicar", "sem alteração"],
      requiredInputs: ["<intenção>", "<contrato.sema>"],
      commandTemplates: [
        template("docs-impacto", "sema docs-impacto --intencao <intenção> --arquivo <contrato.sema> --json", "WORKSPACE_VERIFICATION", true),
        template("inspecionar", "sema inspecionar <contrato.sema> --json", "READ_ONLY_VALIDATION"),
        template("drift", "sema drift <contrato.sema> --escopo modulo --json", "READ_ONLY_VALIDATION"),
        template("impacto", "sema impacto <contrato.sema> --alvo <token> --mudanca <descrição> --json", "READ_ONLY_VALIDATION"),
        template("finalizar", "sema finalizar-mudanca --intencao <intenção> --doc-lida <documento> --json", "WORKSPACE_VERIFICATION"),
      ],
      related: ["flow.contract-verification"],
      source: "contratos/sema/governanca_ia.sema",
      extensible: false,
      aliases: ["mudanca", "change", "governanca"],
    },
    {
      id: "flow.contract-verification",
      kind: "GOVERNANCE_FLOW",
      domains: ["governanca", "validacao"],
      label: "Verificação de contrato",
      summary: "Valida contrato, implementação vinculada e testes locais antes do fechamento.",
      useWhen: ["validar um contrato ou verificar a aderência final da implementação"],
      avoidWhen: ["ainda não existe contrato aplicável"],
      intentSignals: ["validar contrato", "verificar projeto", "testar contrato", "fechar mudança"],
      negativeSignals: ["iniciar projeto sem contrato"],
      requiredInputs: ["<contrato.sema>"],
      commandTemplates: [
        template("validar", "sema validar <contrato.sema> --json", "READ_ONLY_VALIDATION"),
        template("verificar", "sema verificar <contrato.sema> --saida <diretório-temporário> --json", "WORKSPACE_VERIFICATION", true),
      ],
      related: ["flow.governed-change"],
      source: "contratos/sema/governanca_ia_qualidade_contrato.sema",
      extensible: false,
      aliases: ["validacao", "verification", "checks"],
    },
    {
      id: "flow.project-adoption",
      kind: "GOVERNANCE_FLOW",
      domains: ["governanca", "adocao"],
      label: "Adoção do Sema",
      summary: "Inicializa a governança local e materializa o entrypoint oficial para agentes.",
      useWhen: ["o projeto ainda não possui contrato Sema ou AGENTS.md gerado"],
      avoidWhen: ["o workspace já está governado e a tarefa é uma mudança comum"],
      intentSignals: ["iniciar sema", "semantizar projeto", "sync codex", "criar primeiro contrato"],
      negativeSignals: ["projeto ja governado", "validar contrato existente"],
      requiredInputs: [],
      commandTemplates: [
        template("iniciar", "sema iniciar --template base", "WORKSPACE_BOOTSTRAP", true),
        template("sync-codex", "sema sync-codex --json", "WORKSPACE_BOOTSTRAP", true),
      ],
      related: ["flow.governed-change"],
      source: "contratos/sema/cli_init_templates.sema",
      extensible: false,
      aliases: ["bootstrap", "adocao", "iniciar"],
    },
  ];
}

function entradasProfiles(): DiscoveryEntry[] {
  return Object.values(CAPABILITY_MATRIX_GOVERNANCA)
    .filter((capability) => capability.profile !== "author")
    .map((capability) => {
      const profile = capability.profile as PerfilSemanticoValidavel;
      const aliases = Object.entries(ALIASES_PROFILE)
        .filter(([, destino]) => destino === profile)
        .map(([alias]) => alias);
      const sinais = unicos([
        profile,
        PROFILE_LABELS[profile],
        ...aliases,
        ...PRESETS_PROFILE[profile],
        ...capability.rulePacksSugeridos,
      ]);
      return {
        id: `profile.${profile}`,
        kind: "PROFILE_GATE",
        domains: [profile],
        label: `Profile ${PROFILE_LABELS[profile]}`,
        summary: `Gate semântico para validar contrato e artefato no domínio ${PROFILE_LABELS[profile]}.`,
        useWhen: [`validar aderência de contrato ou artefato de ${PROFILE_LABELS[profile]}`],
        avoidWhen: ["a intenção exige uma orquestração multietapas, execução ou publicação"],
        intentSignals: sinais,
        negativeSignals: ["pipeline multietapas", "executar ferramenta", "publicar multicanal"],
        requiredInputs: ["<contrato.sema>"],
        commandTemplates: [
          template(
            "validar",
            `sema profile validar ${profile} <contrato.sema> --json`,
            "READ_ONLY_VALIDATION",
          ),
        ],
        related: ["flow.governed-change"],
        source: "CAPABILITY_MATRIX_GOVERNANCA",
        extensible: false,
        aliases: unicos([`profile.${profile}`, `profile ${profile}`, ...aliases, ...PRESETS_PROFILE[profile]]),
      } satisfies DiscoveryEntry;
    });
}

function entradaAuthor(): DiscoveryEntry {
  const capability = CAPABILITY_MATRIX_GOVERNANCA.author;
  return {
    id: "workflow.author",
    kind: "SPECIALIZED_WORKFLOW",
    domains: ["author", "narrativa", "escrita"],
    label: "Author",
    summary: "Workflow especializado para briefing, continuidade e validação narrativa de obras autorais.",
    useWhen: ["escrever ou validar conto, romance, roteiro, lore, campanha ou continuidade de capítulos"],
    avoidWhen: ["validar código, game loop ou conteúdo editorial multicanal"],
    intentSignals: unicos([
      "author", "autoria", "conto", "romance", "roteiro", "lore", "campanha narrativa",
      "capitulos", "continuidade", "personagem", ...capability.rulePacksSugeridos,
    ]),
    negativeSignals: ["profile validar author", "playtest", "multicanal", "deploy"],
    requiredInputs: ["<contrato.sema>"],
    commandTemplates: [
      template("briefing", "sema author briefing <contrato.sema> --json", "READ_ONLY_VALIDATION"),
      template("validar", "sema author validar <contrato.sema> --json", "READ_ONLY_VALIDATION"),
      template("revisar", "sema author revisar-cliches <contrato.sema> --texto-arquivo <texto> --json", "READ_ONLY_VALIDATION"),
    ],
    related: ["flow.governed-change", "profile.redacao"],
    source: "CAPABILITY_MATRIX_GOVERNANCA.author",
    extensible: false,
    aliases: ["author", "autoria", "escrita autoral", "narrativa longa"],
  };
}

export interface SuperficieCliPipelineInterativo {
  readonly command: string;
  readonly requiredInputs: readonly string[];
  readonly effectClass: DiscoveryCommandTemplate["effectClass"];
}

export const SUPERFICIES_CLI_PIPELINES_AVANCADOS: Readonly<Record<string, SuperficieCliPipelineInterativo>> = Object.freeze({
  "interactive.experience_ir": { command: "sema interativo validar-ir <experience-ir.json> --json", requiredInputs: ["<experience-ir.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.observe": { command: "sema interativo validar-engine-snapshot <engine-snapshot.json> --json", requiredInputs: ["<engine-snapshot.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.asset_provenance": { command: "sema interativo validar-asset-provenance <asset-provenance.json> --json", requiredInputs: ["<asset-provenance.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.editor_state": { command: "sema interativo validar-editor-state <editor-state.json> --json", requiredInputs: ["<editor-state.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.evidence_capture": { command: "sema interativo validar-multimodal <multimodal-evidence.json> --json", requiredInputs: ["<multimodal-evidence.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.job_recovery": { command: "sema interativo planejar-jobs <job-orchestration.json> --json", requiredInputs: ["<job-orchestration.json>"], effectClass: "DECLARATIVE_PLANNING" },
  "interactive.acceptance_lock": { command: "sema interativo validar-acceptance <acceptance-lock.json> --json", requiredInputs: ["<acceptance-lock.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.temporal_validate": { command: "sema interativo validar-temporal <temporal-contract.json> --json", requiredInputs: ["<temporal-contract.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.shot_validate": { command: "sema interativo validar-temporal <temporal-contract.json> --json", requiredInputs: ["<temporal-contract.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.physics_validate": { command: "sema interativo validar-temporal <temporal-contract.json> --json", requiredInputs: ["<temporal-contract.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.temporal_qa": { command: "sema interativo validar-evidencia-temporal <temporal-contract.json> --bundle-arquivo <temporal-evidence.json> --json", requiredInputs: ["<temporal-contract.json>", "<temporal-evidence.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.clean_install_smoke": { command: "sema interativo validar-evidencia-temporal <temporal-contract.json> --bundle-arquivo <temporal-evidence.json> --json", requiredInputs: ["<temporal-contract.json>", "<temporal-evidence.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.hardware_budget": { command: "sema interativo validar-evidencia-temporal <temporal-contract.json> --bundle-arquivo <temporal-evidence.json> --json", requiredInputs: ["<temporal-contract.json>", "<temporal-evidence.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.autonomous_repair": { command: "sema interativo validar-autonomia <autonomy-repair.json> --json", requiredInputs: ["<autonomy-repair.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.bot_playtest": { command: "sema interativo validar-playtest-fuzz <playtest-fuzz.json> --json", requiredInputs: ["<playtest-fuzz.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.state_fuzz": { command: "sema interativo validar-playtest-fuzz <playtest-fuzz.json> --json", requiredInputs: ["<playtest-fuzz.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.multiplayer_authority": { command: "sema interativo validar-multiplayer <multiplayer-authority.json> --json", requiredInputs: ["<multiplayer-authority.json>"], effectClass: "READ_ONLY_VALIDATION" },
  "interactive.engine_migration": { command: "sema interativo analisar-portabilidade <portability-plan.json> --json", requiredInputs: ["<portability-plan.json>"], effectClass: "DECLARATIVE_PLANNING" },
  "interactive.portability": { command: "sema interativo analisar-portabilidade <portability-plan.json> --json", requiredInputs: ["<portability-plan.json>"], effectClass: "DECLARATIVE_PLANNING" },
  "interactive.distributed_jobs": { command: "sema interativo validar-workers <distributed-workers.json> --json", requiredInputs: ["<distributed-workers.json>"], effectClass: "READ_ONLY_VALIDATION" },
});

function entradasConteudo(): DiscoveryEntry[] {
  const pipeline: DiscoveryEntry = {
    id: "pipeline.content",
    kind: "ORCHESTRATION_PIPELINE",
    domains: ["conteudo", "editorial", "multicanal"],
    label: "Pipeline de conteúdo",
    summary: "Orquestra declarativamente conteúdo multicanal e multi-formato com DAG, gates, ledger e adapters externos.",
    useWhen: ["produzir, adaptar, avaliar e confirmar vários artefatos ou destinos como uma única execução governada"],
    avoidWhen: ["a necessidade é somente validar um contrato por profile ou executar uma ferramenta isolada"],
    intentSignals: [
      "pipeline de conteudo", "multicanal", "multi-formato", "dag", "trailer", "thumbnail", "post",
      "publicacao", "publicar por canal", "adaptar por destino", "ledger de conteudo",
    ],
    negativeSignals: ["somente validar contrato", "playtest", "balanceamento", "romance com capitulos"],
    requiredInputs: ["<definicao.json>"],
    commandTemplates: [
      template("validar", "sema conteudo validar <definicao.json> --json", "READ_ONLY_VALIDATION"),
      template("planejar", "sema conteudo planejar <definicao.json> --alvos-arquivo <alvos.json> --json", "DECLARATIVE_PLANNING"),
    ],
    related: CAPABILITIES_CONTEUDO_PADRAO,
    source: "CAPABILITIES_CONTEUDO_PADRAO",
    extensible: true,
    aliases: ["pipeline conteudo", "content pipeline", "conteudo multicanal"],
  };

  const capabilities = CAPABILITIES_CONTEUDO_PADRAO.map((capability): DiscoveryEntry => {
    const metadata = CONTEUDO_METADATA[capability];
    return {
      id: capability,
      kind: "CAPABILITY_TOKEN",
      domains: ["conteudo"],
      label: metadata.label,
      summary: metadata.summary,
      useWhen: [metadata.summary],
      avoidWhen: ["a capability isolada está sendo tratada como pipeline completo ou autorização de execução"],
      intentSignals: unicos([capability, ...capability.split("."), ...metadata.signals]),
      negativeSignals: ["executar automaticamente", "aprovar sem evidencia"],
      requiredInputs: ["<definicao.json>"],
      commandTemplates: [
        template("planejar", "sema conteudo planejar <definicao.json> --alvos-arquivo <alvos.json> --json", "DECLARATIVE_PLANNING"),
      ],
      related: ["pipeline.content"],
      source: "CAPABILITIES_CONTEUDO_PADRAO",
      extensible: true,
      aliases: [capability],
    };
  });

  return [pipeline, ...capabilities];
}

function entradasInterativas(): DiscoveryEntry[] {
  const pipelines = CATALOGO_PIPELINES_INTERATIVOS.map((pipeline): DiscoveryEntry => {
    const superficie = SUPERFICIES_CLI_PIPELINES_AVANCADOS[pipeline.pipelineId];
    return {
    id: pipeline.pipelineId,
    kind: "ORCHESTRATION_PIPELINE",
    domains: unicos(["sistemas-interativos", ...pipeline.kinds]),
    label: pipeline.label,
    summary: pipeline.summary,
    useWhen: [...pipeline.useWhen],
    avoidWhen: [...pipeline.avoidWhen],
    intentSignals: unicos([
      pipeline.pipelineId,
      pipeline.label,
      pipeline.summary,
      ...pipeline.kinds,
      ...pipeline.spatialModels,
      ...pipeline.renderModes,
      ...pipeline.controlModes,
      ...pipeline.capabilities,
      ...pipeline.useWhen,
    ]),
    negativeSignals: [...pipeline.avoidWhen],
    requiredInputs: superficie?.requiredInputs ?? [`<definition.json> with pipelines including ${pipeline.pipelineId}`],
    commandTemplates: [
      superficie
        ? template("operar-local", superficie.command, superficie.effectClass)
        : template("planejar", "sema interativo planejar <definition.json> --json", "DECLARATIVE_PLANNING"),
      template(
        "descrever",
        `sema descobrir pipeline descrever ${pipeline.pipelineId} --json`,
        "READ_ONLY_DISCOVERY",
      ),
    ],
    related: [...pipeline.capabilities],
    source: "CATALOGO_PIPELINES_INTERATIVOS",
    extensible: false,
    aliases: [pipeline.pipelineId, pipeline.label],
    };
  });

  const porCapability = new Map<string, typeof CATALOGO_PIPELINES_INTERATIVOS[number][]>();
  for (const pipeline of CATALOGO_PIPELINES_INTERATIVOS) {
    for (const capability of pipeline.capabilities) {
      const atuais = porCapability.get(capability) ?? [];
      atuais.push(pipeline);
      porCapability.set(capability, atuais);
    }
  }

  const idsPipelines = new Set(CATALOGO_PIPELINES_INTERATIVOS.map((pipeline) => pipeline.pipelineId));
  const metadataCapabilities = new Map(
    CATALOGO_CAPABILITIES_INTERATIVAS.map((capability) => [capability.capability, capability] as const),
  );
  const capabilities = [...porCapability.entries()]
    .filter(([capability]) => !idsPipelines.has(capability))
    .map(([capability, donos]): DiscoveryEntry => {
      const metadata = metadataCapabilities.get(capability);
      return {
    id: capability,
    kind: "CAPABILITY_TOKEN",
    domains: unicos(["sistemas-interativos", ...donos.flatMap((pipeline) => pipeline.kinds)]),
    label: metadata?.label ?? capability.split(".").map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1)).join(" "),
    summary: metadata?.summary ?? `Capability declarada por ${donos.map((pipeline) => pipeline.label).join(", ")}.`,
    useWhen: unicos(donos.flatMap((pipeline) => pipeline.useWhen)),
    avoidWhen: unicos(donos.flatMap((pipeline) => pipeline.avoidWhen)),
    intentSignals: unicos([
      capability,
      metadata?.label,
      metadata?.summary,
    ]),
    negativeSignals: unicos(donos.flatMap((pipeline) => pipeline.avoidWhen)),
    requiredInputs: ["<definition.json> with a related pipeline selected"],
    commandTemplates: [
      template(
        "planejar",
        "sema interativo planejar <definition.json> --json",
        "DECLARATIVE_PLANNING",
      ),
      ...donos.map((pipeline) => template(
        `descrever-${pipeline.pipelineId}`,
        `sema descobrir pipeline descrever ${pipeline.pipelineId} --json`,
        "READ_ONLY_DISCOVERY",
      )),
    ],
    related: donos.map((pipeline) => pipeline.pipelineId),
    source: "CATALOGO_PIPELINES_INTERATIVOS.capabilities",
    extensible: false,
    aliases: [capability],
      };
    });

  const adapters = CATALOGO_ADAPTADORES_INTERATIVOS.map((adapter): DiscoveryEntry => ({
    id: adapter.adapterId,
    kind: "ADAPTER",
    domains: unicos([
      "sistemas-interativos",
      adapter.role,
      adapter.engine,
      ...adapter.kinds,
      ...adapter.spatialModels,
      ...adapter.renderModes,
    ]),
    label: `Adapter ${adapter.engine}`,
    summary: `Adapter externo ${adapter.role.toLowerCase()} para modelos espaciais ${adapter.spatialModels.join(", ")} e render ${adapter.renderModes.join(", ")}.`,
    useWhen: [`selecionar runtime ou ferramenta externa compatível com ${adapter.engine}`],
    avoidWhen: ["o adapter está sendo tratado como autorização ou execução implícita"],
    intentSignals: unicos([
      adapter.adapterId,
      adapter.engine,
      adapter.role,
      ...adapter.kinds,
      ...adapter.spatialModels,
      ...adapter.renderModes,
      ...adapter.capabilities,
    ]),
    negativeSignals: ["executar automaticamente", "plugin instalado"],
    requiredInputs: [],
    commandTemplates: [
      template("explicar", `sema descobrir explicar ${adapter.adapterId} --json`, "READ_ONLY_DISCOVERY"),
    ],
    related: [...adapter.capabilities],
    source: "CATALOGO_ADAPTADORES_INTERATIVOS",
    extensible: false,
    aliases: [adapter.adapterId, adapter.engine],
  }));

  return [...pipelines, ...capabilities, ...adapters];
}

function entradasGeradores(): DiscoveryEntry[] {
  return ALVOS_GERACAO.map((alvo): DiscoveryEntry => ({
    id: `generator.${alvo}`,
    kind: "GENERATOR",
    domains: ["codigo", "geracao", alvo],
    label: `Gerador ${alvo}`,
    summary: `Gera artefatos ${alvo} derivados de contrato Sema validado.`,
    useWhen: [`materializar código ${alvo} a partir de um contrato aplicável`],
    avoidWhen: ["o contrato ainda não foi validado ou a intenção é editar código vivo manualmente"],
    intentSignals: [alvo, `gerar ${alvo}`, `compilar ${alvo}`, "gerar codigo"],
    negativeSignals: ["sem contrato", "editar manualmente"],
    requiredInputs: ["<contrato.sema>", "<diretório>"],
    commandTemplates: [
      template(
        "compilar",
        `sema compilar <contrato.sema> --alvo ${alvo} --saida <diretório>`,
        "WORKSPACE_GENERATION",
        true,
      ),
    ],
    related: ["flow.contract-verification"],
    source: "@sema/padroes.AlvoGeracao",
    extensible: false,
    aliases: [`gerador ${alvo}`, `generator ${alvo}`],
  }));
}

function criarRegistro(): readonly DiscoveryEntry[] {
  const entries = [
    ...entradasGovernanca(),
    ...entradasProfiles(),
    entradaAuthor(),
    ...entradasConteudo(),
    ...entradasInterativas(),
    ...entradasGeradores(),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`discovery_id_duplicado:${entry.id}`);
    ids.add(entry.id);
  }
  return entries;
}

const REGISTRO_DESCOBERTA = criarRegistro();

function clonarEntrada(entry: DiscoveryEntry): DiscoveryEntry {
  return {
    ...entry,
    domains: [...entry.domains],
    useWhen: [...entry.useWhen],
    avoidWhen: [...entry.avoidWhen],
    intentSignals: [...entry.intentSignals],
    negativeSignals: [...entry.negativeSignals],
    requiredInputs: [...entry.requiredInputs],
    commandTemplates: entry.commandTemplates.map((item) => ({ ...item })),
    related: [...entry.related],
    aliases: entry.aliases ? [...entry.aliases] : undefined,
  };
}

export function montarCatalogoCapacidades(
  filtros: DiscoveryCatalogFilters = {},
): DiscoveryCatalogPayload {
  const kind = normalizarDiscoveryKind(filtros.kind);
  if (filtros.kind && !kind) throw new TypeError("discovery_kind_invalido");
  const id = filtros.id?.trim() || null;
  const domain = filtros.domain?.trim() || null;
  const idNormalizado = id ? normalizar(id) : null;
  const dominioNormalizado = domain ? normalizar(domain) : null;

  const entries = REGISTRO_DESCOBERTA
    .filter((entry) => !kind || entry.kind === kind)
    .filter((entry) => !idNormalizado || normalizar(entry.id) === idNormalizado)
    .filter((entry) => !dominioNormalizado || entry.domains.some((item) => normalizar(item) === dominioNormalizado))
    .map(clonarEntrada);

  return {
    schemaVersion: DISCOVERY_SCHEMA_VERSION,
    command: "descobrir catalogo",
    success: true,
    mode: "catalog",
    ...EXECUTION_BOUNDARY,
    filters: {
      kind,
      id: redigirTextoControladoDescoberta(id),
      domain: redigirTextoControladoDescoberta(domain),
    },
    entries,
  };
}

export function obterEntradaDescoberta(id: string): DiscoveryEntry | null {
  const idNormalizado = normalizar(id);
  const entry = REGISTRO_DESCOBERTA.find((item) => normalizar(item.id) === idNormalizado);
  if (entry) return clonarEntrada(entry);
  const porAlias = REGISTRO_DESCOBERTA.filter((item) => (
    (item.aliases ?? []).some((alias) => normalizar(alias) === idNormalizado)
  ));
  return porAlias.length === 1 ? clonarEntrada(porAlias[0]!) : null;
}

export function criarResumoDescobertaAgentContext(): ResumoDescobertaAgentContext {
  const entries = montarCatalogoCapacidades().entries;
  const kinds = DISCOVERY_KINDS.filter((kind) => entries.some((entry) => entry.kind === kind));
  const pipelinesPrincipais = entries
    .filter((entry) => entry.kind === "ORCHESTRATION_PIPELINE")
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      command: entry.commandTemplates[0]?.command ?? `sema descobrir explicar ${entry.id} --json`,
    }));

  return {
    schemaVersion: DISCOVERY_SCHEMA_VERSION,
    command: "sema descobrir catalogo --json",
    kinds,
    pipelinesPrincipais,
    commands: {
      catalogo: "sema descobrir catalogo --json",
      recomendar: "sema descobrir recomendar --intencao <texto> --json",
      explicar: "sema descobrir explicar <id> --json",
    },
  };
}
