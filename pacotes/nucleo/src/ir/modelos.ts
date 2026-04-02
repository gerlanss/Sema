import type { Diagnostico } from "../diagnosticos/index.js";
import type {
  ContratoErroRouteSemantico,
  EfeitoSemantico,
  EtapaFlowSemantica,
  ExpressaoSemantica,
  TransicaoEstadoSemantica,
} from "../semantico/estruturas.js";
import type {
  ClassificacaoDadoSemantico,
  ModoAuthSemantico,
  MotivoAuditSemantico,
  OrigemAuthSemantica,
  PrincipalAuthSemantico,
  RedacaoLogSemantica,
  TenantAuthzSemantico,
} from "../semantico/seguranca.js";

export type PerfilCompatibilidade = "publico" | "interno" | "experimental" | "legado" | "deprecado";
export type StatusResolucaoSemantica = "nao_verificado" | "resolvido" | "parcial" | "inferido" | "quebrado" | "nao_encontrado";
export type NivelConfiancaSemantica = "alta" | "media" | "baixa";
export type NivelRiscoSemantico = "baixo" | "medio" | "alto";
export type TipoSuperficieIr = "worker" | "evento" | "fila" | "cron" | "webhook" | "cache" | "storage" | "policy";

export interface IrCampo {
  nome: string;
  tipo: string;
  modificadores: string[];
  tipoOriginal: string;
  tipoBase: string;
  cardinalidade: "unitario" | "lista" | "mapa" | "uniao";
  opcional: boolean;
  tiposAlternativos: string[];
  tipoItem?: string;
  chaveMapa?: string;
  valorMapa?: string;
  refinamentos: string[];
}

export interface IrImplementacaoTask {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  origemArquivo?: string;
  origemSimbolo?: string;
  resolucaoImpl?: string;
  statusImpl?: StatusResolucaoSemantica;
}

export interface IrVinculo {
  tipo: string;
  valor: string;
  arquivo?: string;
  simbolo?: string;
  recurso?: string;
  superficie?: string;
  statusResolucao?: StatusResolucaoSemantica;
  confianca?: NivelConfiancaSemantica;
}

export interface IrExecucao {
  idempotencia: boolean;
  timeout: string;
  retry: string;
  compensacao: string;
  criticidadeOperacional: "baixa" | "media" | "alta" | "critica";
  explicita: boolean;
}

export interface IrAuth {
  explicita: boolean;
  modo?: ModoAuthSemantico | string;
  estrategia?: string;
  principal?: PrincipalAuthSemantico | string;
  origem?: OrigemAuthSemantica | string;
}

export interface IrAuthz {
  explicita: boolean;
  papeis: string[];
  escopos: string[];
  politica?: string;
  tenant?: TenantAuthzSemantico | string;
}

export interface IrCampoDadoClassificado {
  origem: string;
  campo: string;
  classificacao: ClassificacaoDadoSemantico | string;
}

export interface IrDados {
  explicita: boolean;
  classificacaoPadrao?: ClassificacaoDadoSemantico | string;
  redacaoLog?: RedacaoLogSemantica | string;
  retencao?: string;
  campos: IrCampoDadoClassificado[];
}

export interface IrAudit {
  explicita: boolean;
  evento?: string;
  ator?: string;
  correlacao?: string;
  retencao?: string;
  motivo?: MotivoAuditSemantico | string;
}

export interface IrSegredo {
  nome: string;
  origem?: string;
  escopo?: string;
  acesso?: string;
  rotacao?: string;
  naoLogar?: boolean;
  naoRetornar?: boolean;
  mascarar?: boolean;
}

export interface IrSegredos {
  explicita: boolean;
  itens: IrSegredo[];
}

export interface IrForbidden {
  explicita: boolean;
  regras: string[];
}

export interface IrBlocoDeclarativo {
  campos: IrCampo[];
  linhas: string[];
  blocos: IrBlocoDeclarativoAninhado[];
}

export interface IrBlocoDeclarativoAninhado {
  nome: string;
  conteudo: IrBlocoDeclarativo;
}

export interface IrCasoTeste {
  nome: string;
  given: IrBlocoDeclarativo;
  when?: IrBlocoDeclarativo;
  expect: IrBlocoDeclarativo;
  error?: IrBlocoDeclarativo;
}

export interface IrResumoAgente {
  riscos: string[];
  checks: string[];
  entidadesAfetadas: string[];
  superficiesPublicas: string[];
  mutacoesPrevistas: string[];
}

export interface IrType {
  nome: string;
  definicao: IrBlocoDeclarativo;
  invariantes: ExpressaoSemantica[];
}

export interface IrEntity {
  nome: string;
  campos: IrCampo[];
  invariantes: ExpressaoSemantica[];
}

export interface IrEnum {
  nome: string;
  valores: string[];
}

export interface IrUse {
  origem: "sema" | "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  externo: boolean;
}

export interface IrInteropExterno {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
}

export interface IrErroOperacional {
  codigo: string;
  mensagem: string;
  categoria?: string;
  recuperabilidade?: string;
  acaoChamador?: string;
  impactaEstado?: boolean;
  requerCompensacao?: boolean;
  origemTask?: string;
}

export interface IrTask {
  nome: string;
  input: IrCampo[];
  output: IrCampo[];
  rules: string[];
  regrasEstruturadas: ExpressaoSemantica[];
  effects: string[];
  efeitosEstruturados: EfeitoSemantico[];
  implementacoesExternas: IrImplementacaoTask[];
  vinculos: IrVinculo[];
  execucao: IrExecucao;
  auth: IrAuth;
  authz: IrAuthz;
  dados: IrDados;
  audit: IrAudit;
  segredos: IrSegredos;
  forbidden: IrForbidden;
  guarantees: string[];
  garantiasEstruturadas: ExpressaoSemantica[];
  errors: Record<string, string>;
  errosDetalhados: IrErroOperacional[];
  perfilCompatibilidade: PerfilCompatibilidade;
  stateContract?: IrTaskStateContract;
  resumoAgente: IrResumoAgente;
  tests: IrCasoTeste[];
}

export interface IrErroPublico extends IrErroOperacional {
  nome: string;
}

export interface IrRoutePublica {
  metodo?: string;
  caminho?: string;
  task?: string;
  input: IrCampo[];
  output: IrCampo[];
  errors: IrErroPublico[];
  effects: EfeitoSemantico[];
  garantiasMinimas: string[];
  confiancaContrato?: NivelConfiancaSemantica;
  riscoRegressao?: NivelRiscoSemantico;
  divergenciasPublicas?: string[];
}

export interface IrTaskStateContract {
  nomeEstado?: string;
  campos: IrCampo[];
  linhas: string[];
  transicoes: TransicaoEstadoSemantica[];
}

export interface IrFlow {
  nome: string;
  campos: IrCampo[];
  linhas: string[];
  tasksReferenciadas: string[];
  etapasEstruturadas: EtapaFlowSemantica[];
  effects: string[];
  efeitosEstruturados: EfeitoSemantico[];
  vinculos: IrVinculo[];
  perfilCompatibilidade: PerfilCompatibilidade;
  resumoAgente: IrResumoAgente;
}

export interface IrRoute {
  nome: string;
  campos: IrCampo[];
  linhas: string[];
  metodo?: string;
  caminho?: string;
  task?: string;
  inputPublico: IrCampo[];
  outputPublico: IrCampo[];
  errosPublicos: ContratoErroRouteSemantico[];
  efeitosPublicos: EfeitoSemantico[];
  vinculos: IrVinculo[];
  auth: IrAuth;
  authz: IrAuthz;
  dados: IrDados;
  audit: IrAudit;
  segredos: IrSegredos;
  forbidden: IrForbidden;
  perfilCompatibilidade: PerfilCompatibilidade;
  garantiasPublicasMinimas: string[];
  resumoAgente: IrResumoAgente;
  publico: IrRoutePublica;
}

export interface IrSuperficie {
  tipo: TipoSuperficieIr;
  nome: string;
  campos: IrCampo[];
  linhas: string[];
  task?: string;
  input: IrCampo[];
  output: IrCampo[];
  effects: EfeitoSemantico[];
  implementacoesExternas: IrImplementacaoTask[];
  vinculos: IrVinculo[];
  execucao: IrExecucao;
  auth: IrAuth;
  authz: IrAuthz;
  dados: IrDados;
  audit: IrAudit;
  segredos: IrSegredos;
  forbidden: IrForbidden;
  perfilCompatibilidade: PerfilCompatibilidade;
  resumoAgente: IrResumoAgente;
}

export interface IrState {
  nome?: string;
  campos: IrCampo[];
  linhas: string[];
  invariantes: ExpressaoSemantica[];
  transicoes: TransicaoEstadoSemantica[];
}

export interface IrModulo {
  nome: string;
  uses: string[];
  imports: IrUse[];
  interoperabilidades: IrInteropExterno[];
  vinculos: IrVinculo[];
  perfilCompatibilidade: PerfilCompatibilidade;
  types: IrType[];
  entities: IrEntity[];
  enums: IrEnum[];
  tasks: IrTask[];
  flows: IrFlow[];
  routes: IrRoute[];
  superficies: IrSuperficie[];
  states: IrState[];
  resumoAgente: IrResumoAgente;
  diagnosticos: Diagnostico[];
}
