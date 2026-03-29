import type { Diagnostico } from "../diagnosticos/index.js";
import type { EfeitoSemantico, EtapaFlowSemantica, ExpressaoSemantica, TransicaoEstadoSemantica } from "../semantico/estruturas.js";

export interface IrCampo {
  nome: string;
  tipo: string;
  modificadores: string[];
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
}

export interface IrEntity {
  nome: string;
  campos: IrCampo[];
}

export interface IrEnum {
  nome: string;
  valores: string[];
}

export interface IrTask {
  nome: string;
  input: IrCampo[];
  output: IrCampo[];
  rules: string[];
  regrasEstruturadas: ExpressaoSemantica[];
  effects: string[];
  efeitosEstruturados: EfeitoSemantico[];
  guarantees: string[];
  garantiasEstruturadas: ExpressaoSemantica[];
  errors: Record<string, string>;
  stateContract?: IrTaskStateContract;
  tests: IrCasoTeste[];
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
}

export interface IrRoute {
  nome: string;
  campos: IrCampo[];
  linhas: string[];
  metodo?: string;
  caminho?: string;
  task?: string;
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
  types: IrType[];
  entities: IrEntity[];
  enums: IrEnum[];
  tasks: IrTask[];
  flows: IrFlow[];
  routes: IrRoute[];
  states: IrState[];
  diagnosticos: Diagnostico[];
}
