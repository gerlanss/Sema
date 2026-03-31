import type { BlocoCasoTesteAst, BlocoGenericoAst, ModuloAst } from "../ast/tipos.js";
import type { Diagnostico } from "../diagnosticos/index.js";
import type { ContextoSemantico } from "../semantico/analisador.js";
import { parsearEfeitoSemantico, parsearEtapaFlow, parsearExpressaoSemantica, parsearTransicaoEstado } from "../semantico/estruturas.js";
import type {
  IrBlocoDeclarativo,
  IrCampo,
  IrCasoTeste,
  IrEntity,
  IrFlow,
  IrModulo,
  IrRoute,
  IrState,
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
    blocos: (bloco?.blocos ?? [])
      .filter((subbloco): subbloco is BlocoGenericoAst => subbloco.tipo === "bloco_generico")
      .map((subbloco) => ({
        nome: subbloco.nome ?? subbloco.palavraChave,
        conteudo: converterBloco(subbloco),
      })),
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

function converterErrosPublicos(bloco?: BlocoGenericoAst) {
  return (bloco?.campos ?? []).map((campo) => ({
    nome: campo.nome,
    codigo: campo.nome,
    mensagem: [campo.valor, ...campo.modificadores].join(" ").trim() || undefined,
  }));
}

function recomporCaminho(campo?: { valor: string; modificadores: string[] }): string | undefined {
  if (!campo) {
    return undefined;
  }

  return [campo.valor, ...campo.modificadores]
    .join(" ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

function ehUseInterop(
  use: ModuloAst["uses"][number],
): use is ModuloAst["uses"][number] & { origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp" } {
  return use.origem !== "sema";
}

export function converterParaIr(modulo: ModuloAst, diagnosticos: Diagnostico[], contexto?: ContextoSemantico): IrModulo {
  const types: IrType[] = modulo.types.map((type) => ({
    nome: type.nome,
    definicao: converterBloco(encontrarSubBloco(type.corpo, "fields") ?? type.corpo),
    invariantes: (encontrarSubBloco(type.corpo, "invariants")?.linhas ?? [])
      .map((linha) => parsearExpressaoSemantica(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
  }));

  const entities: IrEntity[] = modulo.entities.map((entity) => ({
    nome: entity.nome,
    campos: converterCampos(encontrarSubBloco(entity.corpo, "fields")),
    invariantes: (encontrarSubBloco(entity.corpo, "invariants")?.linhas ?? [])
      .map((linha) => parsearExpressaoSemantica(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
  }));

  const tasks: IrTask[] = modulo.tasks.map((task) => ({
    nome: task.nome,
    input: converterCampos(task.input),
    output: converterCampos(task.output),
    rules: task.rules?.linhas.map((linha) => linha.conteudo) ?? [],
    regrasEstruturadas: (task.rules?.linhas ?? []).map((linha) => parsearExpressaoSemantica(linha.conteudo)).filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
    effects: task.effects?.linhas.map((linha) => linha.conteudo) ?? [],
    efeitosEstruturados: (task.effects?.linhas ?? []).map((linha) => parsearEfeitoSemantico(linha.conteudo)).filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
    implementacoesExternas: (task.impl?.campos ?? [])
      .map((campo) => {
        const origem = campo.nome.toLowerCase();
        if (origem === "ts" || origem === "typescript") {
          return { origem: "ts" as const, caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" as const };
        }
        if (origem === "py" || origem === "python") {
          return { origem: "py" as const, caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" as const };
        }
        if (origem === "dart") {
          return { origem: "dart" as const, caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" as const };
        }
        if (origem === "cs" || origem === "csharp" || origem === "dotnet") {
          return { origem: "cs" as const, caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" as const };
        }
        if (origem === "java") {
          return { origem: "java" as const, caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" as const };
        }
        if (origem === "go" || origem === "golang") {
          return { origem: "go" as const, caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" as const };
        }
        if (origem === "rust" || origem === "rs") {
          return { origem: "rust" as const, caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" as const };
        }
        if (origem === "cpp" || origem === "cxx" || origem === "cc" || origem === "c++") {
          return { origem: "cpp" as const, caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" as const };
        }
        return undefined;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    guarantees: task.guarantees?.linhas.map((linha) => linha.conteudo) ?? [],
    garantiasEstruturadas: (task.guarantees?.linhas ?? []).map((linha) => parsearExpressaoSemantica(linha.conteudo)).filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
    errors: Object.fromEntries((task.error?.campos ?? []).map((campo) => [campo.nome, [campo.valor, ...campo.modificadores].join(" ").trim()])),
    stateContract: task.state ? {
      nomeEstado: task.state.nome ?? task.state.campos.find((campo) => campo.nome === "state" || campo.nome === "estado")?.valor,
      campos: converterCampos(task.state),
      linhas: task.state.linhas.map((linha) => linha.conteudo),
      transicoes: (encontrarSubBloco(task.state, "transitions")?.linhas ?? task.state.linhas)
        .map((linha) => parsearTransicaoEstado(linha.conteudo))
        .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
    } : undefined,
    tests: (task.tests?.blocos.filter((bloco): bloco is BlocoCasoTesteAst => bloco.tipo === "caso_teste") ?? []).map(converterCaso),
  }));

  const tarefasPorNome = new Map(tasks.map((task) => [task.nome, task] as const));
  const tarefasSemanticas = contexto?.tarefasDetalhadas ?? new Map();

  const flows: IrFlow[] = modulo.flows.map((flow) => ({
    nome: flow.nome,
    campos: flow.corpo.campos.map((campo) => ({
      nome: campo.nome,
      tipo: campo.valor,
      modificadores: campo.modificadores,
    })),
    linhas: flow.corpo.linhas.map((linha) => linha.conteudo),
    tasksReferenciadas: flow.corpo.campos
      .filter((campo) => campo.nome === "task" || campo.nome === "tarefa")
      .map((campo) => campo.valor),
    etapasEstruturadas: flow.corpo.linhas
      .map((linha) => parsearEtapaFlow(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
    effects: (encontrarSubBloco(flow.corpo, "effects")?.linhas ?? []).map((linha) => linha.conteudo),
    efeitosEstruturados: (encontrarSubBloco(flow.corpo, "effects")?.linhas ?? [])
      .map((linha) => parsearEfeitoSemantico(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
  }));

  const routes: IrRoute[] = modulo.routes.map((route) => ({
    nome: route.nome,
    campos: route.corpo.campos.map((campo) => ({
      nome: campo.nome,
      tipo: campo.valor,
      modificadores: campo.modificadores,
    })),
    linhas: route.corpo.linhas.map((linha) => linha.conteudo),
    metodo: route.corpo.campos.find((campo) => campo.nome === "metodo")?.valor,
    caminho: recomporCaminho(route.corpo.campos.find((campo) => campo.nome === "caminho")),
    task: route.corpo.campos.find((campo) => campo.nome === "task" || campo.nome === "tarefa")?.valor,
    inputPublico: [],
    outputPublico: [],
    errosPublicos: [],
    efeitosPublicos: [],
    garantiasPublicasMinimas: [],
    publico: {
      metodo: undefined,
      caminho: undefined,
      task: undefined,
      input: [],
      output: [],
      errors: [],
      effects: [],
      garantiasMinimas: [],
    },
  })).map((route) => {
    const routeAst = modulo.routes.find((item) => item.nome === route.nome)!;
    const tarefaAssociada = route.task ? tarefasPorNome.get(route.task) : undefined;
    const tarefaSemantica = route.task ? tarefasSemanticas.get(route.task) : undefined;
    const inputPublicoDeclarado = converterCampos(encontrarSubBloco(routeAst.corpo, "input"));
    const outputPublicoDeclarado = converterCampos(encontrarSubBloco(routeAst.corpo, "output"));
    const errosPublicosDeclarados = converterErrosPublicos(encontrarSubBloco(routeAst.corpo, "error"));
    const efeitosPublicosDeclarados = (encontrarSubBloco(routeAst.corpo, "effects")?.linhas ?? [])
      .map((linha) => parsearEfeitoSemantico(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
    const inputPublicoResolvido = inputPublicoDeclarado.length > 0
      ? inputPublicoDeclarado
      : (tarefaAssociada?.input ?? tarefaSemantica?.input ?? []);
    const outputPublicoResolvido = outputPublicoDeclarado.length > 0
      ? outputPublicoDeclarado
      : (tarefaAssociada?.output ?? tarefaSemantica?.output ?? []);
    const errosPublicosResolvidos = errosPublicosDeclarados.length > 0
      ? errosPublicosDeclarados
      : (tarefaAssociada
        ? Object.entries(tarefaAssociada.errors).map(([nome, mensagem]) => ({ nome, codigo: nome, mensagem, origemTask: route.task }))
        : (tarefaSemantica?.errors ?? []).map((erro: { codigo: string; mensagem: string }) => ({ nome: erro.codigo, codigo: erro.codigo, mensagem: erro.mensagem, origemTask: route.task })));
    const garantiasPublicasMinimas = (tarefaAssociada?.guarantees ?? tarefaSemantica?.guarantees ?? []).filter((garantia: string) => {
      const referencia = garantia.trim().split(/\s+/)[0] ?? "";
      return outputPublicoResolvido.some((campo: { nome: string }) => campo.nome === referencia || garantia.includes(`${campo.nome}.`));
    });

    return {
      ...route,
      inputPublico: inputPublicoResolvido,
      outputPublico: outputPublicoResolvido,
      errosPublicos: errosPublicosResolvidos,
      efeitosPublicos: efeitosPublicosDeclarados,
      garantiasPublicasMinimas,
      publico: {
        metodo: route.metodo,
        caminho: route.caminho,
        task: route.task,
        input: inputPublicoResolvido,
        output: outputPublicoResolvido,
        errors: errosPublicosResolvidos,
        effects: efeitosPublicosDeclarados,
        garantiasMinimas: garantiasPublicasMinimas,
        divergenciasPublicas: [],
      },
    };
  });

  const states: IrState[] = modulo.states.map((state) => ({
    nome: state.nome,
    campos: converterCampos(encontrarSubBloco(state.corpo, "fields") ?? state.corpo),
    linhas: state.corpo.linhas.map((linha) => linha.conteudo),
    invariantes: (encontrarSubBloco(state.corpo, "invariants")?.linhas ?? [])
      .map((linha) => parsearExpressaoSemantica(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
    transicoes: (encontrarSubBloco(state.corpo, "transitions")?.linhas ?? [])
      .map((linha) => parsearTransicaoEstado(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
  }));

  return {
    nome: modulo.nome,
    uses: contexto?.modulosImportados.length
      ? [...contexto.modulosImportados]
      : modulo.uses.filter((use) => use.origem === "sema").map((use) => use.caminho),
    imports: modulo.uses.map((use) => ({
      origem: use.origem,
      caminho: use.caminho,
      externo: use.origem !== "sema",
    })),
    interoperabilidades: contexto?.interoperabilidades.map((interop) => ({ ...interop })) ?? modulo.uses
      .filter(ehUseInterop)
      .map((use) => ({ origem: use.origem, caminho: use.caminho })),
    types,
    entities,
    enums: modulo.enums.map((enumeracao) => ({ nome: enumeracao.nome, valores: enumeracao.valores })),
    tasks,
    flows,
    routes,
    states,
    diagnosticos,
  };
}
