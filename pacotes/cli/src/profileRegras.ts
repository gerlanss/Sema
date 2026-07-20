// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: normaliza??o, scoring, decis?o de agente e achados de contrato dos profiles.

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
import { PRESETS_PROFILE, ALIASES_PROFILE } from "./profileCatalogo.js";
import { RULE_PACKS_SEMA } from "./profileRulePacks.js";

export function normalizarPresetProfile(profile: PerfilSemanticoValidavel, valor: string | undefined): PresetProfile | null {
  if (!valor) return null;
  const chave = valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const alias: Record<string, PresetProfile> = {
    privacidade: "privacidade",
    privacy: "privacidade",
    termos: "termos_uso",
    termos_de_uso: "termos_uso",
    due: "due_diligence",
    diligence: "due_diligence",
    pesquisa_rapida: "rapida",
    pesquisa_tecnica: "tecnica",
    pesquisa_decisoria: "decisoria",
    pesquisa_critica: "critica",
    materia_seo: "materia",
    artigo: "blog",
    post_blog: "blog",
    texto_seo: "seo",
    reescrever: "reescrita",
    proposta_marketplace: "marketplace",
    proposta_freela: "freela",
    proposta_consultiva: "consultiva",
    diagnostico_comercial: "diagnostico",
    score_90: "score90",
    minimo_90: "score90",
    critico: "critical",
    critica_ops: "critical",
    modulo_codigo: "modulo",
    seguranca: "security",
    seguranca_codigo: "security",
    atendimento_cliente: "atendimento",
    conversa_atendimento: "atendimento",
    comercial: "vendas",
    venda: "vendas",
    conversa_vendas: "vendas",
    suporte_cliente: "suporte",
    qualificar: "qualificacao",
    qualificacao_lead: "qualificacao",
    retencao_cliente: "retencao",
    cobrar: "cobranca",
  };
  const aliasSimulation: Record<string, PresetProfile> = {
    modelo: "model",
    cenario: "scenario",
    calibracao: "calibration",
    deterministico: "deterministic",
    deterministica: "deterministic",
    lote: "batch",
    seguranca: "safety",
  };
  const preset = (profile === "simulation" ? aliasSimulation[chave] : undefined) ?? alias[chave] ?? (chave as PresetProfile);
  return PRESETS_PROFILE[profile].includes(preset) ? preset : null;
}

export function moduloCombinaComProfile(modulo: string | null | undefined, caminho: string, profile: PerfilSemanticoValidavel): boolean {
  const alvo = `${modulo ?? ""} ${caminho}`.toLowerCase();
  if (profile === "workflow") {
    return /workflow|n8n|orquestracao/.test(alvo);
  }
  if (profile === "conversas") {
    return /conversas|conversa|atendimento|chatbot|bot/.test(alvo);
  }
  if (profile === "simulation") {
    return /simulation|simulacao|simulador/.test(alvo);
  }
  if (profile === "redacao") {
    return /redacao|redator|materia|editorial|seo/.test(alvo);
  }
  if (profile === "propostas") {
    return /propostas|proposta|propostas_comerciais|freela|marketplace/.test(alvo);
  }
  return alvo.includes(profile);
}

export function severidadeRequisitoProfile(
  requisito: RequisitoProfile,
  profile: PerfilSemanticoValidavel,
  maturidade: MaturidadeProfile,
): SeveridadeProfile {
  if (requisito.severidade) return requisito.severidade;
  if (!requisito.obrigatorio) return "warning";
  if (maturidade === "critical") return "critical";
  if ((profile === "legal" && /revisao|jurisdicao|fontes|auditoria/i.test(requisito.id)) ||
    (profile === "ops" && /runbook|rollback|segredos|incidente/i.test(requisito.id))) {
    return "critical";
  }
  return maturidade === "draft" ? "warning" : "blocking";
}

export function riscoAchadoProfile(severidade: SeveridadeProfile, fonte: FonteAchadoProfile): string {
  if (severidade === "critical") return fonte === "artefato" ? "violacao_critica_no_artefato" : "risco_critico_de_governanca";
  if (severidade === "blocking") return fonte === "artefato" ? "artefato_nao_aderente" : "contrato_nao_pronto";
  if (severidade === "warning") return "ressalva_operacional";
  return "informativo";
}

export function avaliarRequisitosProfile(
  conteudo: string,
  requisitos: RequisitoProfile[],
  profile: PerfilSemanticoValidavel,
  maturidade: MaturidadeProfile,
  fonte: FonteAchadoProfile = "contrato",
): AchadoProfile[] {
  return requisitos.map((requisito) => {
    const severidade = severidadeRequisitoProfile(requisito, profile, maturidade);
    const atendido = requisito.termos.every((termo) => termo.test(conteudo));
    return {
      id: requisito.id,
      descricao: requisito.descricao,
      obrigatorio: requisito.obrigatorio,
      atendido,
      severidade,
      termos: requisito.termos.map((termo) => termo.source),
      fonte,
      regra: requisito.id,
      motivo: atendido ? undefined : `requisito ${fonte} nao foi demonstrado no contrato.`,
      risco: atendido ? undefined : riscoAchadoProfile(severidade, fonte),
      sugestao: atendido ? undefined : "declare o requisito com entradas, efeitos, garantias e checks rastreaveis.",
    };
  });
}

export function decidirAcaoAgenteProfile(contratoValido: boolean, achados: AchadoProfile[]): DecisaoAgenteProfile {
  if (!contratoValido) return "parar";
  const pendentes = achados.filter((achado) => !achado.atendido);
  if (pendentes.some((achado) => achado.severidade === "critical")) return "chamar_humano";
  if (pendentes.some((achado) => achado.severidade === "blocking")) return "parar";
  if (pendentes.some((achado) => achado.severidade === "warning")) return "continuar_com_ressalva";
  return "continuar";
}

export function calcularScoreProfile(contratoValido: boolean, achados: AchadoProfile[]): number {
  const pendentesObrigatorios = achados.filter((achado) => achado.obrigatorio && !achado.atendido).length;
  const pendentesRecomendados = achados.filter((achado) => !achado.obrigatorio && !achado.atendido).length;
  return Math.max(0, 100 - (contratoValido ? 0 : 40) - pendentesObrigatorios * 20 - pendentesRecomendados * 8);
}

export function penalidadeAchadoProfile(achado: AchadoProfile): number {
  if (achado.atendido) return 0;
  if (achado.severidade === "critical") return 40;
  if (achado.severidade === "blocking") return 25;
  if (achado.severidade === "warning") return 10;
  return 0;
}

export function calcularScoreAchadosProfile(base: number, achados: AchadoProfile[]): number {
  return Math.max(0, base - achados.reduce((total, achado) => total + penalidadeAchadoProfile(achado), 0));
}

export function calcularScoreRiscoProfile(achados: AchadoProfile[]): number {
  const pendentes = achados.filter((achado) => !achado.atendido);
  return Math.min(100, pendentes.reduce((total, achado) => {
    if (achado.severidade === "critical") return total + 35;
    if (achado.severidade === "blocking") return total + 22;
    if (achado.severidade === "warning") return total + 8;
    return total + 2;
  }, 0));
}

export function severidadeMaximaProfile(achados: AchadoProfile[]): SeveridadeProfile | null {
  const pendentes = achados.filter((achado) => !achado.atendido);
  if (pendentes.some((achado) => achado.severidade === "critical")) return "critical";
  if (pendentes.some((achado) => achado.severidade === "blocking")) return "blocking";
  if (pendentes.some((achado) => achado.severidade === "warning")) return "warning";
  if (pendentes.some((achado) => achado.severidade === "info")) return "info";
  return null;
}

export function calcularConfiancaValidacaoProfile(
  artefatoRecebido: boolean,
  achadosArtefato: AchadoProfile[],
  scoreRisco: number,
): ConfiancaValidacaoProfile {
  if (!artefatoRecebido) return "parcial";
  if (scoreRisco >= 70) return "media";
  if (achadosArtefato.some((achado) => !achado.atendido && achado.trecho && achado.linha)) return "alta";
  if (achadosArtefato.length > 0) return "media";
  return "media";
}

export function criarRuntimeGateProfile(
  decisao: DecisaoAgenteProfile,
  maturidade: MaturidadeProfile,
  achados: AchadoProfile[],
  scoreRisco: number,
): RuntimeGateProfile {
  const severidadeMaxima = severidadeMaximaProfile(achados);
  const exigeHumano = decisao === "chamar_humano" || severidadeMaxima === "critical";
  const podeExecutar = decisao === "continuar" || decisao === "continuar_com_ressalva";
  return {
    decisao,
    maturidade,
    podeExecutar,
    exigeHumano,
    scoreRisco,
    severidadeMaxima,
    motivo: podeExecutar
      ? "gate permite continuidade com as ressalvas declaradas."
      : exigeHumano
        ? "gate bloqueia e exige humano por risco critico ou maturidade critica."
        : "gate bloqueia ate resolver requisitos obrigatorios.",
  };
}

export function selecionarRulePacksProfile(profile: ProfileGovernanca): RulePackSema[] {
  return RULE_PACKS_SEMA.filter((pack) => pack.profiles.includes(profile));
}

export function contratoProibeTermoProfile(contrato: string, termo: string): boolean {
  const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const padroes = [
    new RegExp(`(forbidden|proibid|vedad|nao usar|nÃ£o usar|sem)\\s+[^\\n]{0,80}${escaped}`, "i"),
    new RegExp(`${escaped}[^\\n]{0,80}(forbidden|proibid|vedad|nao permitido|nÃ£o permitido|nao usar|nÃ£o usar)`, "i"),
  ];
  return padroes.some((padrao) => padrao.test(contrato));
}

export function criarAchadoArtefatoProfile(
  id: string,
  descricao: string,
  atendido: boolean,
  severidade: SeveridadeProfile,
  trecho?: string,
  sugestao?: string,
  motivo?: string,
  detalhes?: Partial<Pick<AchadoProfile, "linha" | "coluna" | "inicio" | "fim" | "regra" | "risco">>,
): AchadoProfile {
  return {
    id,
    descricao,
    obrigatorio: severidade === "blocking" || severidade === "critical",
    atendido,
    severidade,
    termos: [],
    fonte: "artefato",
    regra: detalhes?.regra ?? id,
    trecho,
    linha: detalhes?.linha,
    coluna: detalhes?.coluna,
    inicio: detalhes?.inicio,
    fim: detalhes?.fim,
    motivo,
    risco: detalhes?.risco ?? (atendido ? undefined : riscoAchadoProfile(severidade, "artefato")),
    sugestao,
  };
}

export function trechoRegexProfile(texto: string, regex: RegExp): string | undefined {
  const match = regex.exec(texto);
  if (!match || match.index < 0) return undefined;
  const inicio = Math.max(0, match.index - 60);
  const fim = Math.min(texto.length, match.index + match[0].length + 60);
  return texto.slice(inicio, fim).replace(/\s+/g, " ").trim();
}

export function contemArtefatoProfile(texto: string, regex: RegExp): boolean {
  regex.lastIndex = 0;
  return regex.test(texto);
}
