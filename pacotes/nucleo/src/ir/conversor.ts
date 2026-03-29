import type { BlocoCasoTesteAst, BlocoGenericoAst, ModuloAst } from "../ast/tipos.js";
import type { Diagnostico } from "../diagnosticos/index.js";
import type {
  IrBlocoDeclarativo,
  IrCampo,
  IrCasoTeste,
  IrEntity,
  IrFlow,
  IrModulo,
  IrRoute,
  IrTask,
  IrType,
} from "./modelos.js";

function converterCampos(bloco?: BlocoGenericoAst): IrCampo[] {
  if (!bloco) {
    return [];
  }
  return bloco.campos.map((campo) => ({
    nome: campo.nome,
    tipo: campo.valor,
    modificadores: campo.modificadores,
  }));
}

function converterBloco(bloco?: BlocoGenericoAst): IrBlocoDeclarativo {
  return {
    campos: converterCampos(bloco),
    linhas: bloco?.linhas.map((linha) => linha.conteudo) ?? [],
  };
}

function converterCaso(caso: BlocoCasoTesteAst): IrCasoTeste {
  return {
    nome: caso.nome,
    given: converterBloco(caso.given),
    when: caso.when ? converterBloco(caso.when) : undefined,
    expect: converterBloco(caso.expect),
    error: caso.error ? converterBloco(caso.error) : undefined,
  };
}

function encontrarSubBloco(bloco: BlocoGenericoAst, palavraChave: string): BlocoGenericoAst | undefined {
  return bloco.blocos.find((subbloco): subbloco is BlocoGenericoAst => subbloco.tipo === "bloco_generico" && subbloco.palavraChave === palavraChave);
}

export function converterParaIr(modulo: ModuloAst, diagnosticos: Diagnostico[]): IrModulo {
  const types: IrType[] = modulo.types.map((type) => ({
    nome: type.nome,
    definicao: converterBloco(type.corpo),
  }));

  const entities: IrEntity[] = modulo.entities.map((entity) => ({
    nome: entity.nome,
    campos: converterCampos(encontrarSubBloco(entity.corpo, "fields")),
  }));

  const tasks: IrTask[] = modulo.tasks.map((task) => ({
    nome: task.nome,
    input: converterCampos(task.input),
    output: converterCampos(task.output),
    rules: task.rules?.linhas.map((linha) => linha.conteudo) ?? [],
    effects: task.effects?.linhas.map((linha) => linha.conteudo) ?? [],
    guarantees: task.guarantees?.linhas.map((linha) => linha.conteudo) ?? [],
    errors: Object.fromEntries((task.error?.campos ?? []).map((campo) => [campo.nome, [campo.valor, ...campo.modificadores].join(" ").trim()])),
    tests: (task.tests?.blocos.filter((bloco): bloco is BlocoCasoTesteAst => bloco.tipo === "caso_teste") ?? []).map(converterCaso),
  }));

  const flows: IrFlow[] = modulo.flows.map((flow) => ({
    nome: flow.nome,
    linhas: flow.corpo.linhas.map((linha) => linha.conteudo),
  }));

  const routes: IrRoute[] = modulo.routes.map((route) => ({
    nome: route.nome,
    campos: route.corpo.campos.map((campo) => ({
      nome: campo.nome,
      tipo: campo.valor,
      modificadores: campo.modificadores,
    })),
    linhas: route.corpo.linhas.map((linha) => linha.conteudo),
  }));

  return {
    nome: modulo.nome,
    uses: modulo.uses.map((use) => use.caminho),
    types,
    entities,
    enums: modulo.enums.map((enumeracao) => ({ nome: enumeracao.nome, valores: enumeracao.valores })),
    tasks,
    flows,
    routes,
    diagnosticos,
  };
}

