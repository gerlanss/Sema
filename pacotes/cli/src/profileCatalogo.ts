// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: cat?logo est?tico de requisitos, aliases, presets e matriz de capacidade dos profiles.

import type {
  AchadoProfile,
  CapabilityProfile,
  ConfidenceEngineProfile,
  ConfiancaValidacaoProfile,
  DecisaoAgenteProfile,
  FonteAchadoProfile,
  MaturidadeProfile,
  OpcoesProfileValidar,
  PerfilSemanticoValidavel,
  PresetProfile,
  ProfileGovernanca,
  RequisitoProfile,
  ResultadoProfileValidar,
  RulePackSema,
  RuntimeGateProfile,
  SeveridadeProfile,
} from "./profileAuthorTipos.js";
export const REQUISITOS_PROFILE: Record<PerfilSemanticoValidavel, RequisitoProfile[]> = {
  software: [
    { id: "contrato_antes_codigo", descricao: "declara contrato antes de codigo vivo", termos: [/contrato/i, /codigo|implementacao|vivo/i], obrigatorio: true },
    { id: "drift_e_impacto", descricao: "exige drift e mapa de impacto antes de editar", termos: [/drift/i, /impacto|impact map|mapa/i], obrigatorio: true },
    { id: "vinculos_rastreaveis", descricao: "mantem vinculos rastreaveis entre contrato e implementacao", termos: [/vinculos?|impl/i, /arquivo|simbolo/i], obrigatorio: true },
    { id: "checks_de_fechamento", descricao: "declara validacao, testes e verificacao de fechamento", termos: [/validar|verificar/i, /testes?|checks?/i], obrigatorio: true },
  ],
  workflow: [
    { id: "runtime_como_alvo", descricao: "trata workflow runtime como alvo de compatibilidade", termos: [/runtime|workflow|orquestracao/i, /compatibilidade|scorecard/i], obrigatorio: true },
    { id: "adapter_honesto", descricao: "declara adapter sem fingir paridade total", termos: [/adapter|adaptado|n8n/i, /parcial|invalido|equivalencia/i], obrigatorio: true },
    { id: "superficies_nativas", descricao: "mapeia webhook, cron, HTTP e branching", termos: [/webhook/i, /cron/i, /http|branching|transformacao/i], obrigatorio: true },
    { id: "lacunas_operacionais", descricao: "marca lacunas de authz, dados, audit, compensacao e guarantees", termos: [/authz|autorizacao/i, /audit|auditoria/i, /compensacao|guarantees/i], obrigatorio: true },
  ],
  ops: [
    { id: "runbook_e_rollback", descricao: "exige runbook, rollback e criterio de recuperacao", termos: [/runbook/i, /rollback|recuperacao/i], obrigatorio: true },
    { id: "observabilidade", descricao: "declara healthcheck, metricas, logs ou traces", termos: [/healthcheck|metricas|logs?|traces?|observabilidade/i], obrigatorio: true },
    { id: "incidente_e_oncall", descricao: "modela incidente, severidade e responsavel operacional", termos: [/incidente|severidade/i, /responsavel|oncall|operador/i], obrigatorio: true },
    { id: "segredos_e_acesso", descricao: "trata segredos e acesso como superficie operacional", termos: [/segredos?|secret/i, /authz|acesso|permissao/i], obrigatorio: true },
  ],
  game: [
    { id: "loop_jogavel", descricao: "declara loop jogavel e objetivo do jogador", termos: [/loop/i, /jogador|player/i], obrigatorio: true },
    { id: "estado_e_regras", descricao: "declara estado, regras e transicoes de jogo", termos: [/estado|state/i, /regras?|transitions?|transicoes/i], obrigatorio: true },
    { id: "falha_balanceamento", descricao: "modela falha, balanceamento e abuso", termos: [/falha|derrota|erro/i, /balanceamento|abuso|exploit/i], obrigatorio: true },
    { id: "telemetria_jogo", descricao: "define telemetria ou replay de decisao", termos: [/telemetria|replay|metricas/i], obrigatorio: false },
  ],
  simulation: [
    { id: "modelo_e_assumptions", descricao: "declara modelo testavel e assumptions explicitas", termos: [/modelo|model/i, /assumptions?|premissas?|hipoteses?/i], obrigatorio: true },
    { id: "condicoes_outputs_unidades", descricao: "declara condicoes iniciais, contorno, outputs e unidades", termos: [/condicoes?_iniciais|initial[_ -]?conditions?/i, /condicoes?_contorno|boundary[_ -]?conditions?/i, /outputs?|saidas?|resultados?/i, /unidades?|units?/i], obrigatorio: true },
    { id: "spatial_render_visual_separados", descricao: "separa modelo espacial, modo de renderizacao e visual profile", termos: [/spatial[_ -]?model|modelo[_ -]?espacial/i, /render[_ -]?mode|modo[_ -]?(?:de[_ -]?)?render/i, /visual[_ -]?profile|perfil[_ -]?visual/i], obrigatorio: true },
    { id: "controle_e_tempo", descricao: "declara modo de controle e modelo de tempo", termos: [/controle|control(?:[_ -]?modes?)?/i, /tempo|time[_ -]?model|fixed[_ -]?step|real[_ -]?time|event[_ -]?driven/i], obrigatorio: true },
    { id: "fidelidade_calibracao_incerteza", descricao: "declara fidelidade, referencia, calibracao, tolerancia e incerteza", termos: [/fidelity|fidelidade/i, /referencia|reference|dataset/i, /calibracao|calibration/i, /tolerancias?|tolerances?/i, /incerteza|uncertainty/i], obrigatorio: true },
    { id: "telemetria_e_replay_simulacao", descricao: "define telemetria, seed, snapshot ou replay reproduzivel", termos: [/telemetria|telemetry|metricas?/i, /seed|snapshot|replay|event[_ -]?log/i], obrigatorio: false },
  ],
  legal: [
    { id: "jurisdicao_e_escopo", descricao: "declara jurisdicao, escopo e limite de uso", termos: [/jurisdicao/i, /escopo|limite/i], obrigatorio: true },
    { id: "fontes_normativas", descricao: "exige fontes normativas ou base documental", termos: [/fonte|norma|lei|regulamento/i, /citacao|evidencia|documento/i], obrigatorio: true },
    { id: "revisao_humana", descricao: "bloqueia parecer final sem revisao humana", termos: [/revisao_humana|humana|advogado|aprovador/i, /bloqueio|forbidden|proib/i], obrigatorio: true },
    { id: "auditoria_legal", descricao: "registra auditoria e retencao de decisao", termos: [/audit|auditoria/i, /retencao|correlacao|motivo/i], obrigatorio: true },
  ],
  research: [
    { id: "pergunta_metodo", descricao: "declara pergunta, metodo e criterio de evidencia", termos: [/pergunta|hipotese/i, /metodo|metodologia/i], obrigatorio: true },
    { id: "fontes_e_citacoes", descricao: "exige fontes, citacoes e qualidade de evidencia", termos: [/fonte|citacao|referencia/i, /evidencia|confianca|qualidade/i], obrigatorio: true },
    { id: "incerteza_e_limite", descricao: "declara incerteza, lacunas e limites da conclusao", termos: [/incerteza|lacuna|limite/i, /conclusao|afirmacao/i], obrigatorio: true },
    { id: "reprodutibilidade", descricao: "preserva protocolo, dados e reproducibilidade", termos: [/protocolo|dataset|dados/i, /reprodut|replic/i], obrigatorio: false },
  ],
  redacao: [
    { id: "pauta_pesquisa_publico", descricao: "declara pauta, pesquisa, publico e objetivo editorial", termos: [/pauta|tema/i, /pesquisa|fontes?|evidencias?/i, /publico|objetivo/i], obrigatorio: true },
    { id: "seo_intencao_busca", descricao: "modela SEO por palavra-chave, intencao de busca e pacote editorial", termos: [/seo|palavra_chave|keyword/i, /intencao_busca|intencao de busca|meta_description|titulo_seo/i], obrigatorio: true },
    { id: "midia_original_preservada", descricao: "preserva midia original, src, alt, caption, embed e posicao relativa", termos: [/midia|imagem|embed|src|alt/i, /preserv|posicao|ordem|checksum/i], obrigatorio: true },
    { id: "bloqueio_generico_plagio", descricao: "bloqueia plagio, fonte inventada, keyword stuffing e voz generica de IA", termos: [/plagio|fonte|keyword_stuffing|generica|generico/i, /forbidden|aprovar|bloqueio|proib/i], obrigatorio: true },
  ],
  propostas: [
    { id: "entregaveis_claros_cliente", descricao: "declara entregaveis claros para o cliente", termos: [/entregaveis?|entrega/i, /cliente|proposta_cliente/i, /claros?|explicar_o_que_sera_entregue/i], obrigatorio: true },
    { id: "persuasao_obrigatoria", descricao: "exige proposta persuasiva, curta, confiante e especifica", termos: [/persuasiv|fechamento|confiante/i, /curta|especifica|proposta_cliente/i], obrigatorio: true },
    { id: "nota_interna_separada", descricao: "mantem nota interna com preco, prazo, stack, risco e upsell fora do texto ao cliente", termos: [/nota_interna|nota interna/i, /preco|prazo|stack|risco|upsell/i], obrigatorio: true },
    { id: "score_minimo_90", descricao: "bloqueia proposta pronta abaixo de score 90", termos: [/score_final_proposta|score/i, />=\s*90|90/i, /pronta_para_enviar|aprovar_score_abaixo_90/i], obrigatorio: true },
    { id: "restricoes_marketplace", descricao: "respeita restricoes de marketplace e evita contato externo indevido", termos: [/99freelas|workana|marketplace/i, /contato_externo|restricoes_plataforma|restricoes/i], obrigatorio: true },
  ],
  conversas: [
    { id: "tom_e_persona", descricao: "declara tom, formalidade, persona e intensidade persuasiva", termos: [/tom|persona|voz/i, /formalidade|persuasiv|comercial|serio/i], obrigatorio: true },
    { id: "estado_cliente", descricao: "modela etapa, intencao, sentimento, objecoes e memoria curta", termos: [/etapa|estado|intencao/i, /sentimento|objec|historico|memoria/i], obrigatorio: true },
    { id: "limites_comerciais", descricao: "bloqueia promessas, preco, prazo, garantia e insistencia sem base", termos: [/promessa|preco|prazo|garantia|desconto/i, /forbidden|proibid|bloque|sem_base|nao autorizado/i], obrigatorio: true },
    { id: "escalacao_humana", descricao: "declara quando transferir para humano", termos: [/escalar_humano|escalacao|humano|atendente/i, /irritado|juridico|cancelamento|reclamacao/i], obrigatorio: true },
    { id: "resposta_validada", descricao: "valida resposta, proxima acao e aderencia ao tom antes de enviar", termos: [/validar_resposta|validar resposta|resposta/i, /proxima_acao|proxima acao|cta|aderente_ao_tom/i], obrigatorio: true },
  ],
};

export const REQUISITOS_PROFILE_COMUNS: RequisitoProfile[] = [
  {
    id: "contrato_antes_de_acao",
    descricao: "exige criar, editar ou remover contrato antes de qualquer acao",
    termos: [
      /contrato|module|task/i,
      /criar|editar|remover|rules|effects|guarantees/i,
      /antes de qualquer acao|antes da acao|antes de agir|contrato primeiro|forbidden|impl|vinculos/i,
    ],
    obrigatorio: true,
  },
];

export const ALIASES_PROFILE: Record<string, PerfilSemanticoValidavel> = {
  software: "software",
  codigo: "software",
  code: "software",
  workflow: "workflow",
  workflow_ops: "workflow",
  workflows: "workflow",
  n8n: "workflow",
  automacao: "workflow",
  orquestracao: "workflow",
  ops: "ops",
  operacao: "ops",
  operacional: "ops",
  devops: "ops",
  game: "game",
  jogo: "game",
  games: "game",
  simulation: "simulation",
  simulations: "simulation",
  simulacao: "simulation",
  simulacoes: "simulation",
  simulador: "simulation",
  simuladores: "simulation",
  legal: "legal",
  juridico: "legal",
  research: "research",
  pesquisa: "research",
  redacao: "redacao",
  reda_o: "redacao",
  redator: "redacao",
  redigir: "redacao",
  editorial: "redacao",
  materia: "redacao",
  materia_seo: "redacao",
  propostas: "propostas",
  proposta: "propostas",
  propostas_comerciais: "propostas",
  proposta_comercial: "propostas",
  freela: "propostas",
  marketplace: "propostas",
  conversas: "conversas",
  conversa: "conversas",
  atendimento: "conversas",
  atendimento_conversacional: "conversas",
  bot: "conversas",
  chatbot: "conversas",
  chat: "conversas",
};

export function normalizarProfileSemantico(valor: string | undefined): PerfilSemanticoValidavel | null {
  if (!valor) {
    return null;
  }
  const chave = valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return ALIASES_PROFILE[chave] ?? null;
}

export function normalizarMaturidadeProfile(valor: string | undefined): MaturidadeProfile {
  const chave = (valor ?? "production").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (chave === "draft" || chave === "rascunho") return "draft";
  if (chave === "prototype" || chave === "prototipo") return "prototype";
  if (chave === "critical" || chave === "critico" || chave === "critica") return "critical";
  return "production";
}

export const PRESETS_PROFILE: Record<PerfilSemanticoValidavel, PresetProfile[]> = {
  software: ["api", "modulo", "refactor", "persistencia", "security"],
  workflow: ["webhook", "fila", "n8n", "cron", "integracao"],
  ops: ["deploy", "migration", "incidente", "rollback", "critical"],
  legal: ["lgpd", "contrato", "dpa", "termos_uso", "privacidade", "due_diligence", "compliance"],
  research: ["rapida", "tecnica", "decisoria", "critica"],
  redacao: ["editorial", "materia", "blog", "seo", "reescrita"],
  propostas: ["marketplace", "freela", "consultiva", "diagnostico", "score90"],
  game: ["casual", "arcade", "rpg", "economia", "playtest"],
  simulation: ["model", "scenario", "calibration", "deterministic", "batch", "safety"],
  conversas: ["atendimento", "vendas", "suporte", "qualificacao", "retencao", "cobranca"],
};

export const CAPABILITY_MATRIX_GOVERNANCA: Record<ProfileGovernanca, CapabilityProfile> = {
  author: {
    profile: "author",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: false,
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "validacao semantica profunda segue heuristica e precisa de texto alvo",
      "continuidade longa depende de texto anterior ou memoria canonica fornecida",
    ],
    rulePacksSugeridos: ["author-quality", "brand-voice", "campaign-continuity"],
  },
  software: {
    profile: "software",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: "parcial",
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "artefato inline nao substitui SAST completo",
      "drift real melhora quando contrato e codigo vivo estao vinculados",
    ],
    rulePacksSugeridos: ["owasp", "openapi", "saas"],
  },
  workflow: {
    profile: "workflow",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: true,
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "ordem real exige etapas nomeadas no contrato e no artefato",
      "adaptadores de runtime ainda devem declarar lacunas honestas",
    ],
    rulePacksSugeridos: ["n8n", "event-driven", "approval-flow"],
  },
  ops: {
    profile: "ops",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: "parcial",
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "validacao nao executa rollback real sem comandos externos",
      "modo critical deve escalar humano quando falta runbook ou reversibilidade",
    ],
    rulePacksSugeridos: ["kubernetes", "sre", "incident-response"],
  },
  legal: {
    profile: "legal",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: false,
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "nao substitui revisao humana por profissional habilitado",
      "fontes normativas devem ser fornecidas ou citadas pelo agente",
    ],
    rulePacksSugeridos: ["lgpd", "dpa", "privacy-policy", "soc2"],
  },
  research: {
    profile: "research",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: false,
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "nao verifica fontes externas sem ferramenta de busca ou dataset anexado",
      "confianca aumenta quando evidencia, metodo e incerteza estao separados",
    ],
    rulePacksSugeridos: ["decision-research", "contradictory-review", "evidence-matrix"],
  },
  redacao: {
    profile: "redacao",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: "parcial",
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "validacao editorial profunda depende de materia original, pauta e artefato final",
      "checagem de plagio e fontes externas exige evidencia fornecida ou ferramenta externa",
    ],
    rulePacksSugeridos: ["redacao-quality", "seo-editorial", "brand-voice"],
  },
  propostas: {
    profile: "propostas",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: "parcial",
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "validacao comercial nao prova taxa de fechamento sem historico real de propostas",
      "score minimo depende de artefato com proposta, entregaveis, nota interna e criterios declarados",
    ],
    rulePacksSugeridos: ["commercial-proposal", "proposal-persuasion", "sales-conversation"],
  },
  game: {
    profile: "game",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: "parcial",
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "playtest simulado nao substitui telemetria de jogador real",
      "balanceamento numerico profundo depende de parametros e sessoes",
    ],
    rulePacksSugeridos: ["playtest", "economy-balance", "progression"],
  },
  simulation: {
    profile: "simulation",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: "parcial",
    detectaDriftReal: "parcial",
    validaArtefatoReal: "parcial",
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "validacao textual nao executa engine, solver ou runtime externo",
      "aparencia visual nao prova fidelidade sem referencia, calibracao, tolerancia e evidencia observada",
    ],
    rulePacksSugeridos: ["simulation-model", "simulation-calibration", "simulation-determinism", "simulation-batch", "simulation-safety"],
  },
  conversas: {
    profile: "conversas",
    detectaLiteral: true,
    detectaSemantico: "parcial",
    detectaOrdemExecucao: "parcial",
    detectaDriftReal: "parcial",
    validaArtefatoReal: true,
    interpretaNegacao: true,
    confianca: "media",
    limites: [
      "validacao de resposta depende do historico e politicas comerciais enviados",
      "handoff humano precisa de integracao do runtime de atendimento para ser executado",
    ],
    rulePacksSugeridos: ["conversation-safety", "sales-conversation", "support-handoff"],
  },
};
