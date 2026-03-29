import type { Diagnostico } from "../diagnosticos/index.js";

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
  effects: string[];
  guarantees: string[];
  errors: Record<string, string>;
  tests: IrCasoTeste[];
}

export interface IrFlow {
  nome: string;
  linhas: string[];
}

export interface IrRoute {
  nome: string;
  campos: IrCampo[];
  linhas: string[];
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
  diagnosticos: Diagnostico[];
}
