import type { Diagnostico } from "../diagnosticos/index.js";
import type {
  ContratoErroRouteSemantico,
  EfeitoSemantico,
  EtapaFlowSemantica,
  ExpressaoSemantica,
  TransicaoEstadoSemantica,
} from "../semantico/estruturas.js";

export interface IrCampo {
  nome: string;
  tipo: string;
  modificadores: string[];
}

export interface IrImplementacaoTask {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  origemArquivo?: string;
  origemSimbolo?: string;
  resolucaoImpl?: string;
  statusImpl?: "nao_verificado" | "resolvido" | "quebrado" | "nao_resolvido";
}

export interface IrBlocoDeclarativo {
  campos: IrCampo[];
  linhas: string[];
}

export interface IrCasoTeste {
  nome: string;
  given: IrBlocoDeclarativo;
  when?: IrBlocoDeclarativo;
  expect: IrBlocoDeclarativo;
  error?: IrBlocoDeclarativo;
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

export interface IrTask {
  nome: string;
  input: IrCampo[];
  output: IrCampo[];
  rules: string[];
  regrasEstruturadas: ExpressaoSemantica[];
  effects: string[];
  efeitosEstruturados: EfeitoSemantico[];
  implementacoesExternas: IrImplementacaoTask[];
  guarantees: string[];
  garantiasEstruturadas: ExpressaoSemantica[];
  errors: Record<string, string>;
  stateContract?: IrTaskStateContract;
  tests: IrCasoTeste[];
}

export interface IrErroPublico {
  nome: string;
  codigo: string;
  mensagem?: string;
  origemTask?: string;
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
  garantiasPublicasMinimas: string[];
  publico: IrRoutePublica;
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
  types: IrType[];
  entities: IrEntity[];
  enums: IrEnum[];
  tasks: IrTask[];
  flows: IrFlow[];
  routes: IrRoute[];
  states: IrState[];
  diagnosticos: Diagnostico[];
}
