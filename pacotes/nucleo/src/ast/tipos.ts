import type { IntervaloFonte } from "../diagnosticos/index.js";

export type TipoBloco =
  | "module"
  | "use"
  | "type"
  | "entity"
  | "enum"
  | "task"
  | "input"
  | "output"
  | "rules"
  | "effects"
  | "guarantees"
  | "state"
  | "flow"
  | "route"
  | "tests"
  | "error"
  | "docs"
  | "comments"
  | "fields"
  | "invariants"
  | "transitions"
  | "given"
  | "when"
  | "expect"
  | "case"
  | "desconhecido";

export interface NoAstBase {
  tipo: string;
  intervalo?: IntervaloFonte;
}

export interface CampoAst extends NoAstBase {
  tipo: "campo";
  nome: string;
  valor: string;
  modificadores: string[];
}

export interface LinhaDeclarativaAst extends NoAstBase {
  tipo: "linha_declarativa";
  conteudo: string;
}

export interface BlocoGenericoAst extends NoAstBase {
  tipo: "bloco_generico";
  palavraChave: TipoBloco;
  nome?: string;
  campos: CampoAst[];
  linhas: LinhaDeclarativaAst[];
  blocos: BlocoAst[];
}

export interface BlocoCasoTesteAst extends NoAstBase {
  tipo: "caso_teste";
  nome: string;
  given?: BlocoGenericoAst;
  when?: BlocoGenericoAst;
  expect?: BlocoGenericoAst;
  error?: BlocoGenericoAst;
  docs?: BlocoGenericoAst;
  comments?: BlocoGenericoAst;
}

export interface UseAst extends NoAstBase {
  tipo: "use";
  caminho: string;
}

export interface EnumAst extends NoAstBase {
  tipo: "enum";
  nome: string;
  valores: string[];
  docs?: BlocoGenericoAst;
}

export interface TypeAst extends NoAstBase {
  tipo: "type";
  nome: string;
  corpo: BlocoGenericoAst;
}

export interface EntityAst extends NoAstBase {
  tipo: "entity";
  nome: string;
  corpo: BlocoGenericoAst;
}

export interface TaskAst extends NoAstBase {
  tipo: "task";
  nome: string;
  corpo: BlocoGenericoAst;
  input?: BlocoGenericoAst;
  output?: BlocoGenericoAst;
  rules?: BlocoGenericoAst;
  effects?: BlocoGenericoAst;
  guarantees?: BlocoGenericoAst;
  state?: BlocoGenericoAst;
  tests?: BlocoGenericoAst;
  error?: BlocoGenericoAst;
  docs?: BlocoGenericoAst;
  comments?: BlocoGenericoAst;
}

export interface FlowAst extends NoAstBase {
  tipo: "flow";
  nome: string;
  corpo: BlocoGenericoAst;
}

export interface RouteAst extends NoAstBase {
  tipo: "route";
  nome: string;
  corpo: BlocoGenericoAst;
}

export interface StateAst extends NoAstBase {
  tipo: "state";
  nome?: string;
  corpo: BlocoGenericoAst;
}

export interface ModuloAst extends NoAstBase {
  tipo: "module";
  nome: string;
  uses: UseAst[];
  docs?: BlocoGenericoAst;
  comments?: BlocoGenericoAst;
  types: TypeAst[];
  entities: EntityAst[];
  enums: EnumAst[];
  tasks: TaskAst[];
  flows: FlowAst[];
  routes: RouteAst[];
  states: StateAst[];
  tests?: BlocoGenericoAst;
  extras: BlocoGenericoAst[];
}

export type BlocoAst =
  | BlocoGenericoAst
  | BlocoCasoTesteAst
  | UseAst
  | EnumAst
  | TypeAst
  | EntityAst
  | TaskAst
  | FlowAst
  | RouteAst
  | StateAst;
