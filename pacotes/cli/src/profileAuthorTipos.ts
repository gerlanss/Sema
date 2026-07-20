// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: tipos compartilhados de profiles Sema e valida??o Author.

import type { compilarCodigo } from "@sema/nucleo";

export type PerfilSemantico = "software" | "workflow" | "ops" | "game" | "legal" | "research" | "redacao" | "propostas" | "conversas";
export type PerfilSemanticoValidavel = PerfilSemantico | "simulation";
export type ProfileGovernanca = PerfilSemanticoValidavel | "author";
export type SeveridadeProfile = "info" | "warning" | "blocking" | "critical";
export type MaturidadeProfile = "draft" | "prototype" | "production" | "critical";
export type DecisaoAgenteProfile = "continuar" | "continuar_com_ressalva" | "parar" | "chamar_humano";
export type FonteAchadoProfile = "contrato" | "artefato" | "preset";
export type ConfiancaValidacaoProfile = "alta" | "media" | "parcial" | "baixa";
export type PresetProfile =
  | "api"
  | "modulo"
  | "refactor"
  | "persistencia"
  | "security"
  | "webhook"
  | "fila"
  | "n8n"
  | "cron"
  | "integracao"
  | "deploy"
  | "migration"
  | "incidente"
  | "rollback"
  | "critical"
  | "lgpd"
  | "contrato"
  | "dpa"
  | "termos_uso"
  | "privacidade"
  | "due_diligence"
  | "compliance"
  | "rapida"
  | "tecnica"
  | "decisoria"
  | "critica"
  | "editorial"
  | "materia"
  | "blog"
  | "seo"
  | "reescrita"
  | "marketplace"
  | "freela"
  | "consultiva"
  | "diagnostico"
  | "score90"
  | "casual"
  | "arcade"
  | "rpg"
  | "economia"
  | "playtest"
  | "model"
  | "scenario"
  | "calibration"
  | "deterministic"
  | "batch"
  | "safety"
  | "atendimento"
  | "vendas"
  | "suporte"
  | "qualificacao"
  | "retencao"
  | "cobranca";

export interface RequisitoProfile {
  id: string;
  descricao: string;
  termos: RegExp[];
  obrigatorio: boolean;
  severidade?: SeveridadeProfile;
}

export interface AchadoProfile {
  id: string;
  descricao: string;
  obrigatorio: boolean;
  atendido: boolean;
  severidade: SeveridadeProfile;
  termos: string[];
  fonte: FonteAchadoProfile;
  regra?: string;
  trecho?: string;
  linha?: number;
  coluna?: number;
  inicio?: number;
  fim?: number;
  motivo?: string;
  risco?: string;
  sugestao?: string;
}

export interface CapabilityProfile {
  profile: ProfileGovernanca;
  detectaLiteral: boolean;
  detectaSemantico: boolean | "parcial";
  detectaOrdemExecucao: boolean | "parcial";
  detectaDriftReal: boolean | "parcial";
  validaArtefatoReal: boolean | "parcial";
  interpretaNegacao: boolean;
  confianca: ConfiancaValidacaoProfile;
  limites: string[];
  rulePacksSugeridos: string[];
}

export interface RulePackSema {
  id: string;
  nome: string;
  categoria: "oss" | "premium" | "enterprise";
  profiles: ProfileGovernanca[];
  maturidadeMinima: MaturidadeProfile;
  controles: string[];
  monetizacao: "aberto" | "cloud" | "enterprise";
  status: "base" | "planejado" | "premium";
}

export interface RuntimeGateProfile {
  decisao: DecisaoAgenteProfile;
  maturidade: MaturidadeProfile;
  podeExecutar: boolean;
  exigeHumano: boolean;
  scoreRisco: number;
  severidadeMaxima: SeveridadeProfile | null;
  motivo: string;
}

export interface ConfidenceEngineProfile {
  scoreContratoFormal: number;
  scoreAderenciaSemantica: number | null;
  scoreRisco: number;
  prontoParaAcao: boolean;
  confiancaValidacao: ConfiancaValidacaoProfile;
  comparacaoArtefatoReal: boolean;
  heuristicaParcial: boolean;
}

export interface OpcoesProfileValidar {
  maturidade: MaturidadeProfile;
  preset?: PresetProfile | null;
  artefatoTexto?: string | null;
  artefatoArquivo?: string | null;
}

export interface ResultadoProfileValidar {
  comando: "profile validar";
  sucesso: boolean;
  profile: PerfilSemanticoValidavel;
  arquivo: string;
  modulo: string | null;
  maturidade: MaturidadeProfile;
  preset: PresetProfile | null;
  presetsDisponiveis: PresetProfile[];
  contratoValido: boolean;
  artefatoRecebido: boolean;
  artefatoArquivo: string | null;
  aprovado: boolean;
  bloqueado: boolean;
  podeContinuar: boolean;
  decisaoAgente: DecisaoAgenteProfile;
  scoreContrato: number;
  scoreArtefato: number | null;
  scoreProntoParaAcao: number;
  scoreContratoFormal: number;
  scoreAderenciaSemantica: number | null;
  scoreRisco: number;
  prontoParaAcao: boolean;
  confiancaValidacao: ConfiancaValidacaoProfile;
  confidenceEngine: ConfidenceEngineProfile;
  capabilityMatrix: CapabilityProfile;
  runtimeGate: RuntimeGateProfile;
  rulePacksSugeridos: RulePackSema[];
  achados: AchadoProfile[];
  achadosArtefato: AchadoProfile[];
  requisitosAtendidos: string[];
  requisitosPendentes: string[];
  checks: string[];
  diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
}

export interface ResultadoAuthorIniciar {
  comando: "author iniciar";
  sucesso: boolean;
  destino: string;
  template: string | null;
  temaSensivel: boolean;
  erro?: string;
}

export interface ResultadoAuthorBriefing {
  comando: "author briefing";
  sucesso: boolean;
  arquivo: string;
  modulo: string | null;
  profile: "author";
  preset: PresetAuthor | null;
  presetsDisponiveis: PresetAuthor[];
  coreDetectado: boolean;
  agentsDetectados: boolean;
  flowDetectado: boolean;
  tasks: string[];
  flows: string[];
  guardrails: string[];
  proibicoes: string[];
  checks: string[];
  diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
}

export type SeveridadeAuthor = "baixa" | "media" | "alta";
export type RiscoAuthor = "baixo" | "medio" | "alto";
export type ConfiancaValidacaoAuthor = "baixa" | "parcial" | "alta";
export type AcaoAuthorTexto = "revisar-cliches" | "validar-narrativa" | "validar-proibicoes";
export type PresetAuthor = "conto" | "romance" | "roteiro" | "lore" | "campanha";

export interface TrechoAuthor {
  texto: string;
  linha: number;
  coluna: number;
  inicio: number;
  fim: number;
  motivo: string;
  sugestao: string;
}

export interface AchadoClicheAuthor {
  id: string;
  categoria: string;
  severidade: SeveridadeAuthor;
  severidadePadrao: SeveridadeProfile;
  ocorrencias: number;
  risco: RiscoAuthor;
  motivo: string;
  sugestao: string;
  sugestaoReescrita: string;
  origem: "contrato" | "catalogo" | "heuristica";
  bloqueante: boolean;
  trechos: TrechoAuthor[];
  evidencias?: string[];
}

export interface IrNarrativoAuthor {
  personagens: string[];
  capitulos: string[];
  eventos: string[];
  temasSensiveis: string[];
  modoCampanha: boolean;
}

export interface DiffSemanticoAuthor {
  disponivel: boolean;
  personagensAdicionados: string[];
  personagensRemovidos: string[];
  eventosAdicionados: string[];
  eventosRemovidos: string[];
  riscoDrift: "baixo" | "medio" | "alto";
}

export interface ImpactoNarrativoAuthor {
  alvo: string;
  camadas: string[];
  motivo: string;
}

export interface ResultadoAuthorCliches {
  comando: "author revisar-cliches" | "author validar-narrativa" | "author validar-proibicoes";
  sucesso: boolean;
  contratoValido: boolean;
  arquivo: string;
  textoFonte: string;
  maturidade: MaturidadeProfile;
  preset: PresetAuthor | null;
  presetsDisponiveis: PresetAuthor[];
  aprovado: boolean;
  bloqueado: boolean;
  podeContinuar: boolean;
  decisaoAgente: DecisaoAgenteProfile;
  scoreCoerenciaTonal: number;
  scoreDriftNarrativo: number;
  scoreContrato: number;
  scoreContratoFormal: number;
  scoreAderenciaSemantica: number;
  scoreRisco: number;
  prontoParaAcao: boolean;
  confiancaValidacao: ConfiancaValidacaoAuthor;
  achados: AchadoClicheAuthor[];
  bloqueios: string[];
  diagnosticoLocalizado: AchadoClicheAuthor[];
  trechosBloqueantes: TrechoAuthor[];
  violacoesProibicoes: AchadoClicheAuthor[];
  modoSaidaAgente: "cirurgico";
  politicasAplicadas: string[];
  guardrailsDeclarados: string[];
  irNarrativo: IrNarrativoAuthor;
  impactMap: ImpactoNarrativoAuthor[];
  diffSemantico: DiffSemanticoAuthor;
  recomendacoes: string[];
  diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
}
