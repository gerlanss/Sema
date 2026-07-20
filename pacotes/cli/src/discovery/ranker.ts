// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: ranking determinístico, explicável e sem execução por intenção.

import { montarCatalogoCapacidades } from "./catalog.js";
import {
  DISCOVERY_SCHEMA_VERSION,
  type DiscoveryEntry,
  type DiscoveryRecommendation,
  type DiscoveryRecommendationPayload,
} from "./types.js";
import { redigirTextoControladoDescoberta } from "./redaction.js";

const EXECUTION_BOUNDARY = {
  executed: false,
  workspaceMutated: false,
  externalCalls: false,
  requiresExplicitRun: true,
} as const;

const TOKEN_EQUIVALENCES: readonly (readonly string[])[] = [
  ["game", "games", "jogo", "jogos"],
  ["simulation", "simulator", "simulacao", "simulacoes", "simulador", "simuladores"],
  ["calibrate", "calibrated", "calibration", "calibracao", "calibrar", "calibrado", "calibrada"],
  ["autonomous", "autonomo", "autonoma", "autonomia"],
  ["realistic", "realista", "realismo"],
  ["balance", "balancing", "balanceamento", "balancear"],
  ["playtest", "jogabilidade", "jogavel"],
  ["workflow", "automacao", "orquestracao"],
  ["content", "conteudo", "editorial"],
  ["publish", "publishing", "publicar", "publicacao"],
  ["author", "autoria", "autoral"],
  ["chapter", "chapters", "capitulo", "capitulos"],
  ["research", "pesquisa", "pesquisar"],
  ["proposal", "proposals", "proposta", "propostas"],
  ["conversation", "conversations", "conversa", "conversas"],
  ["operation", "operations", "operacao", "operacoes", "ops"],
  ["portability", "portable", "portar", "portabilidade", "converter"],
  ["migration", "migrate", "migrar", "migracao", "upgrade"],
  ["provenance", "proveniencia", "linhagem", "license", "licenca"],
  ["evidence", "evidencia", "prova", "evidencias"],
  ["timeline", "timebase", "temporal", "4d"],
  ["camera", "shot", "cameras", "enquadramento"],
  ["physics", "fisica", "colisao", "collision"],
  ["worker", "workers", "distribuido", "distribuidos"],
  ["checkpoint", "retomar", "retomada", "recovery"],
];

const TOKEN_CANONICO = new Map<string, string>();
for (const grupo of TOKEN_EQUIVALENCES) {
  const canonico = grupo[0]!;
  for (const token of grupo) TOKEN_CANONICO.set(token, canonico);
}

function normalizarBase(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function tokenCanonico(token: string): string {
  return TOKEN_CANONICO.get(token) ?? token;
}

export function normalizarIntencaoDescoberta(valor: string): string {
  return normalizarBase(valor)
    .split(" ")
    .filter(Boolean)
    .map(tokenCanonico)
    .join(" ");
}

function tokens(valor: string): readonly string[] {
  const normalizado = normalizarIntencaoDescoberta(valor);
  return normalizado ? normalizado.split(" ") : [];
}

function contemSinal(tokensIntencao: ReadonlySet<string>, sinal: string): boolean {
  const tokensSinal = tokens(sinal);
  return tokensSinal.length > 0 && tokensSinal.every((token) => tokensIntencao.has(token));
}

function possuiAlgum(tokensIntencao: ReadonlySet<string>, termos: readonly string[]): boolean {
  return termos.some((termo) => tokens(termo).some((token) => tokensIntencao.has(token)));
}

function adicionarUnico(lista: string[], valor: string): void {
  if (!lista.includes(valor)) lista.push(valor);
}

function comandoLiteral(template: string): string {
  return normalizarIntencaoDescoberta(template.replace(/<[^>]+>/gu, " "));
}

function matchExato(entry: DiscoveryEntry, intencaoNormalizada: string): boolean {
  const ids = [entry.id, ...(entry.aliases ?? [])].map(normalizarIntencaoDescoberta);
  if (ids.includes(intencaoNormalizada)) return true;
  if (!intencaoNormalizada.startsWith("sema ")) return false;
  return entry.commandTemplates.some((item) => {
    const literal = comandoLiteral(item.command);
    return literal.length > 0 && intencaoNormalizada.startsWith(literal);
  });
}

interface PontuacaoInterna {
  readonly entry: DiscoveryEntry;
  readonly score: number;
  readonly matchedSignals: readonly string[];
  readonly reasons: readonly string[];
  readonly exact: boolean;
}

function pontuar(entry: DiscoveryEntry, intencao: string): PontuacaoInterna {
  const intencaoNormalizada = normalizarIntencaoDescoberta(intencao);
  const tokensIntencao = new Set(tokens(intencao));
  if (matchExato(entry, intencaoNormalizada)) {
    return {
      entry,
      score: 100,
      matchedSignals: [entry.id],
      reasons: ["identificador, alias ou namespace de comando corresponde exatamente"],
      exact: true,
    };
  }

  let score = 0;
  const matchedSignals: string[] = [];
  const reasons: string[] = [];

  let pontosSinais = 0;
  const sinaisCanonicos = new Set<string>();
  for (const sinal of entry.intentSignals) {
    if (!contemSinal(tokensIntencao, sinal)) continue;
    const sinalCanonico = normalizarIntencaoDescoberta(sinal);
    if (sinaisCanonicos.has(sinalCanonico)) continue;
    sinaisCanonicos.add(sinalCanonico);
    const quantidade = tokens(sinal).length;
    pontosSinais = Math.min(40, pontosSinais + (quantidade > 1 ? 30 : 10));
    adicionarUnico(matchedSignals, sinal);
  }
  if (pontosSinais > 0) {
    score += pontosSinais;
    reasons.push(`sinais positivos do catálogo: +${pontosSinais}`);
  }

  const alias = (entry.aliases ?? []).find((item) => contemSinal(tokensIntencao, item));
  if (alias) {
    score += 20;
    adicionarUnico(matchedSignals, alias);
    reasons.push("alias explícito da capacidade: +20");
  }

  const domain = entry.domains.find((item) => contemSinal(tokensIntencao, item));
  if (domain) {
    score += 20;
    adicionarUnico(matchedSignals, domain);
    reasons.push("domínio da capacidade corresponde à intenção: +20");
  }

  const modoValidacao = possuiAlgum(tokensIntencao, ["validar", "auditar", "contrato", "artefato", "aderencia"]);
  const modoPipeline = possuiAlgum(tokensIntencao, [
    "pipeline", "estagios", "dag", "multicanal", "multi-formato", "adapters", "ledger", "publicar",
  ]);
  if (modoValidacao && entry.kind === "PROFILE_GATE") {
    score += 20;
    reasons.push("intenção pede gate de validação: +20");
  }
  if (modoPipeline && entry.kind === "ORCHESTRATION_PIPELINE") {
    score += 30;
    reasons.push("intenção pede orquestração multietapas: +30");
  }
  if (modoValidacao && !modoPipeline && entry.kind === "ORCHESTRATION_PIPELINE" && !entry.id.startsWith("interactive.")) {
    score -= 20;
    reasons.push("pedido de validação sem estágios explícitos: -20");
  }

  const aplicarModoEspecifico = (id: string, termos: readonly string[], motivo: string): void => {
    const correspondencias = new Set(
      termos
        .filter((termo) => contemSinal(tokensIntencao, termo))
        .map(normalizarIntencaoDescoberta),
    ).size;
    if (entry.id === id && correspondencias > 0) {
      const base = entry.id.startsWith("interactive.") ? 60 : 30;
      const pontos = Math.min(80, base + ((correspondencias - 1) * 10));
      score += pontos;
      reasons.push(`${motivo}: +${pontos}`);
    }
  };
  aplicarModoEspecifico("workflow.author", ["romance", "conto", "roteiro", "lore", "capitulos", "continuidade", "personagem"], "workflow narrativo especializado");
  aplicarModoEspecifico("profile.workflow", ["webhook", "cron", "n8n", "fila", "automacao"], "domínio de automação e workflow");
  aplicarModoEspecifico("profile.ops", ["deploy", "rollback", "runbook", "healthcheck", "incidente", "oncall"], "domínio operacional");
  aplicarModoEspecifico("profile.game", ["loop", "jogador", "balanceamento", "playtest", "telemetria", "jogo"], "gate de game design");
  aplicarModoEspecifico("profile.legal", ["lei", "juridico", "lgpd", "compliance", "dpa", "privacidade"], "gate legal");
  aplicarModoEspecifico("profile.research", ["fontes", "evidencia", "metodo", "incerteza", "pesquisa"], "gate de pesquisa");
  aplicarModoEspecifico("profile.redacao", ["seo", "materia", "blog", "editorial", "redacao"], "gate editorial");
  aplicarModoEspecifico("profile.propostas", ["proposta", "orcamento", "cliente", "freela", "marketplace"], "gate comercial");
  aplicarModoEspecifico("profile.conversas", ["atendimento", "chatbot", "objecao", "retencao", "conversa"], "gate conversacional");
  aplicarModoEspecifico("profile.software", ["api", "codigo", "refactor", "security", "persistencia"], "gate de software");
  aplicarModoEspecifico("interactive.experience_ir", ["experience ir", "grafo", "scene", "cena", "content addressed", "ids semanticos"], "grafo portavel de experiencia");
  aplicarModoEspecifico("interactive.observe", ["detect", "probe", "snapshot", "diff", "inspecionar engine"], "observacao read-only de engine");
  aplicarModoEspecifico("interactive.asset_provenance", ["proveniencia", "licenca", "linhagem", "asset"], "proveniencia de assets");
  aplicarModoEspecifico("interactive.editor_state", ["editor state", "nao salvo", "shaders", "imports", "modal"], "estado recuperavel do editor");
  aplicarModoEspecifico("interactive.evidence_capture", ["evidencia", "depth", "normals", "object id", "motion vectors", "telemetria"], "captura multimodal de evidencia");
  aplicarModoEspecifico("interactive.job_recovery", ["lock", "heartbeat", "checkpoint", "retomar", "recovery"], "job com checkpoint e retomada");
  aplicarModoEspecifico("interactive.acceptance_lock", ["aprovou", "aceite", "nao mexa", "regressao"], "aceite humano ligado a hash e intervalo");
  aplicarModoEspecifico("interactive.temporal_validate", ["timeline", "4d", "timebase", "sincronizar", "legenda", "fala", "qa temporal", "validar timeline camera fisica qa"], "contrato temporal multimodal");
  aplicarModoEspecifico("interactive.shot_validate", ["camera", "shot", "enquadramento", "sujeito visivel"], "contrato de camera e shot");
  aplicarModoEspecifico("interactive.physics_validate", ["fisica", "colisao", "attachment", "separacao", "constraint"], "relacoes fisicas verificaveis");
  aplicarModoEspecifico("interactive.temporal_qa", ["flicker", "ghosting", "popping", "exposicao", "jitter"], "QA temporal visual");
  aplicarModoEspecifico("interactive.clean_install_smoke", ["instalacao limpa", "clean install", "pacote", "launch", "smoke"], "instalacao limpa e smoke do pacote");
  aplicarModoEspecifico("interactive.hardware_budget", ["hardware", "fps", "frame time", "ram", "vram", "rtx"], "budget por hardware");
  aplicarModoEspecifico("interactive.autonomous_repair", ["diagnosticar", "propor patch", "simular", "provar", "reparo autonomo"], "reparo autonomo seguro");
  aplicarModoEspecifico("interactive.bot_playtest", ["bot", "bots", "playtest automatico", "seed"], "playtest por bots seeded");
  aplicarModoEspecifico("interactive.state_fuzz", ["fuzz", "save", "load", "corrupcao", "state"], "fuzz bounded de estado");
  aplicarModoEspecifico("interactive.multiplayer_authority", ["autoridade", "replicacao", "server authoritative", "reconnect", "anti replay"], "autoridade multiplayer");
  aplicarModoEspecifico("interactive.engine_migration", ["migrar", "migracao", "upgrade", "versao da engine"], "migracao versionada de engine");
  aplicarModoEspecifico("interactive.portability", ["portar", "portabilidade", "converter entre engines", "perdas", "unreal unity godot"], "portabilidade com perdas declaradas");
  aplicarModoEspecifico("interactive.distributed_jobs", ["workers", "distribuido", "cook", "shaders", "render distribuido"], "workers distribuidos");
  const pedidoCalibracaoDeSimulacao = contemSinal(tokensIntencao, "simulation calibrate");
  if (pedidoCalibracaoDeSimulacao && entry.id === "simulation.calibrate") {
    score += 25;
    reasons.push("calibracao pertence ao pipeline especializado de simulacao: +25");
  } else if (pedidoCalibracaoDeSimulacao && entry.id === "interactive.calibrate") {
    score -= 15;
    reasons.push("calibracao transversal perde para simulacao explicitamente declarada: -15");
  }
  if (
    entry.id === "pipeline.content"
    && possuiAlgum(tokensIntencao, ["trailer", "thumbnail", "post", "multicanal", "publicar", "conteudo"])
  ) {
    score += 20;
    reasons.push("pipeline de conteúdo: +20");
  }

  const quantidadeFormatosConteudo = ["trailer", "thumbnail", "post", "video", "imagem", "texto"]
    .filter((formato) => possuiAlgum(tokensIntencao, [formato]))
    .length;
  if (quantidadeFormatosConteudo >= 2 && entry.id === "pipeline.content") {
    score += 30;
    reasons.push("múltiplos formatos de conteúdo exigem pipeline: +30");
  } else if (quantidadeFormatosConteudo >= 2 && entry.kind === "PROFILE_GATE") {
    score -= 30;
    reasons.push("profile isolado não orquestra múltiplos formatos: -30");
  }

  if (
    entry.id === "profile.simulation"
    && possuiAlgum(tokensIntencao, ["calibrar", "batch", "autonomo", "safety", "incerteza"])
  ) {
    score -= 25;
    reasons.push("capacidade específica de simulação disponível: -25");
  }

  if (
    (entry.kind === "ORCHESTRATION_PIPELINE" || entry.kind === "CAPABILITY_TOKEN")
    && entry.domains.includes("sistemas-interativos")
    && possuiAlgum(tokensIntencao, ["simulador", "simulacao", "jogo", "interativo", "autonomo", "multiplayer", "replay"])
  ) {
    score += 25;
    reasons.push("domínio de sistema interativo: +25");
  }

  const pedidoTemporalComposto = ["timeline", "camera", "physics", "qa"]
    .every((token) => tokensIntencao.has(token));
  if (
    pedidoTemporalComposto
    && ["interactive.shot_validate", "interactive.physics_validate", "interactive.temporal_qa"].includes(entry.id)
  ) {
    score -= 25;
    reasons.push("subvalidador isolado perde para o contrato temporal composto: -25");
  }

  if (entry.kind === "GENERATOR") {
    const alvo = entry.id.slice("generator.".length);
    if (possuiAlgum(tokensIntencao, ["gerar", "compilar", "codigo"]) && contemSinal(tokensIntencao, alvo)) {
      score += 30;
      reasons.push("geração e alvo foram declarados: +30");
    }
  }

  let penalidade = 0;
  for (const sinal of entry.negativeSignals) {
    if (!contemSinal(tokensIntencao, sinal)) continue;
    penalidade += 25;
    adicionarUnico(matchedSignals, `-${sinal}`);
  }
  if (penalidade > 0) {
    score -= penalidade;
    reasons.push(`sinais negativos do catálogo: -${penalidade}`);
  }

  return {
    entry,
    score: Math.max(0, Math.min(100, score)),
    matchedSignals,
    reasons: reasons.length > 0 ? reasons : ["nenhum sinal suficiente encontrado"],
    exact: false,
  };
}

export function recomendarCapacidadePorIntencao(
  intencao: string,
  limite = 5,
): DiscoveryRecommendationPayload {
  if (typeof intencao !== "string" || intencao.trim().length === 0) {
    throw new TypeError("discovery_intencao_obrigatoria");
  }
  if (!Number.isInteger(limite) || limite < 1 || limite > 10) {
    throw new RangeError("discovery_limite_invalido");
  }

  const pontuadas = montarCatalogoCapacidades().entries
    .map((entry) => pontuar(entry, intencao))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  const exatas = pontuadas.filter((item) => item.exact);
  const ordenadas = exatas.length > 0 ? exatas : pontuadas.filter((item) => item.score > 0);
  const top = ordenadas[0];
  const segunda = ordenadas[1];
  const noMatch = !top || top.score < 60;
  const delta = top && segunda ? top.score - segunda.score : null;
  const ambiguityDetected = !noMatch && delta !== null && delta <= 7;
  const candidatas = ordenadas.slice(0, limite);

  const recommendations: DiscoveryRecommendation[] = candidatas.map((item, indice) => ({
    rank: indice + 1,
    id: item.entry.id,
    kind: item.entry.kind,
    label: item.entry.label,
    score: item.score,
    matchedSignals: [...item.matchedSignals],
    reasons: [...item.reasons],
    missingInputs: [...item.entry.requiredInputs],
    suggestedCommandTemplate:
      !noMatch && !ambiguityDetected && indice === 0
        ? item.entry.commandTemplates[0]?.command ?? null
        : null,
  }));

  return {
    schemaVersion: DISCOVERY_SCHEMA_VERSION,
    command: "descobrir recomendar",
    success: true,
    mode: "ranking",
    ...EXECUTION_BOUNDARY,
    intent: redigirTextoControladoDescoberta(intencao.trim())!,
    recommendations,
    ambiguity: {
      detected: ambiguityDetected,
      delta,
      candidates: ambiguityDetected ? ordenadas.slice(0, 2).map((item) => item.entry.id) : [],
    },
    noMatch,
  };
}
