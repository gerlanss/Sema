import type { BlocoCasoTesteAst, BlocoGenericoAst, CampoAst, ModuloAst } from "../ast/tipos.js";
import type { Diagnostico } from "../diagnosticos/index.js";
import type { ContextoSemantico, ErroSemanticoTask } from "../semantico/analisador.js";
import { parsearEfeitoSemantico, parsearEtapaFlow, parsearExpressaoSemantica, parsearTransicaoEstado } from "../semantico/estruturas.js";
import type {
  IrBlocoDeclarativo,
  IrCampo,
  IrCasoTeste,
  IrEntity,
  IrErroOperacional,
  IrExecucao,
  IrFlow,
  IrImplementacaoTask,
  IrModulo,
  IrResumoAgente,
  IrRoute,
  IrRoutePublica,
  IrState,
  IrSuperficie,
  IrTask,
  IrType,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  PerfilCompatibilidade,
  TipoSuperficieIr,
} from "./modelos.js";

const TIPOS_PRIMITIVOS = new Set([
  "Texto",
  "Numero",
  "Inteiro",
  "Decimal",
  "Booleano",
  "Data",
  "DataHora",
  "Id",
  "Email",
  "Url",
  "Json",
  "Vazio",
]);

function encontrarSubBloco(bloco: BlocoGenericoAst, palavraChave: string): BlocoGenericoAst | undefined {
  return bloco.blocos.find((subbloco): subbloco is BlocoGenericoAst => subbloco.tipo === "bloco_generico" && subbloco.palavraChave === palavraChave);
}

function localizarCampo(bloco: BlocoGenericoAst | undefined, ...nomes: string[]): CampoAst | undefined {
  return bloco?.campos.find((campo) => nomes.includes(campo.nome));
}

function valorCampoCompleto(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }
  return [campo.valor, ...campo.modificadores].join(" ").trim() || undefined;
}

function normalizarTipoDeclarado(tipo: string): string {
  return tipo
    .replace(/\s*([<>\[\](),|?])\s*/g, "$1")
    .replace(/\s+/g, "")
    .trim();
}

function dividirNoNivelRaiz(texto: string, separador: string): string[] {
  const partes: string[] = [];
  let profundidadeAngular = 0;
  let profundidadeColchete = 0;
  let inicio = 0;

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caractere = texto[indice]!;
    if (caractere === "<") {
      profundidadeAngular += 1;
      continue;
    }
    if (caractere === ">") {
      profundidadeAngular = Math.max(0, profundidadeAngular - 1);
      continue;
    }
    if (caractere === "[") {
      profundidadeColchete += 1;
      continue;
    }
    if (caractere === "]") {
      profundidadeColchete = Math.max(0, profundidadeColchete - 1);
      continue;
    }
    if (profundidadeAngular === 0 && profundidadeColchete === 0 && texto.startsWith(separador, indice)) {
      partes.push(texto.slice(inicio, indice));
      inicio = indice + separador.length;
      indice += separador.length - 1;
    }
  }

  partes.push(texto.slice(inicio));
  return partes.map((parte) => parte.trim()).filter(Boolean);
}

function analisarCampoTipo(tipo: string, modificadores: string[]): Omit<IrCampo, "nome"> {
  const tipoOriginal = normalizarTipoDeclarado(tipo);
  const modificadoresNormalizados = modificadores.map((item) => item.trim()).filter(Boolean);
  const refinamentos = modificadoresNormalizados.filter((item) => !["required", "optional", "opcional"].includes(item));
  const opcionalPorModificador = modificadoresNormalizados.includes("optional") || modificadoresNormalizados.includes("opcional");

  let tipoBase = tipoOriginal;
  let cardinalidade: IrCampo["cardinalidade"] = "unitario";
  let tiposAlternativos: string[] = [];
  let tipoItem: string | undefined;
  let chaveMapa: string | undefined;
  let valorMapa: string | undefined;
  let opcional = opcionalPorModificador;

  if (tipoBase.endsWith("?")) {
    opcional = true;
    tipoBase = tipoBase.slice(0, -1);
  }

  if (/^Opcional<.+>$/.test(tipoBase)) {
    opcional = true;
    tipoBase = tipoBase.slice("Opcional<".length, -1);
  }

  const uniao = dividirNoNivelRaiz(tipoBase, "|");
  if (uniao.length > 1) {
    cardinalidade = "uniao";
    tiposAlternativos = uniao.map(normalizarTipoDeclarado);
    tipoBase = tiposAlternativos[0] ?? tipoBase;
  } else if (/^Lista<.+>$/.test(tipoBase)) {
    cardinalidade = "lista";
    tipoItem = tipoBase.slice("Lista<".length, -1).trim();
    tipoBase = tipoItem;
  } else if (/^Mapa<.+>$/.test(tipoBase)) {
    cardinalidade = "mapa";
    const partesMapa = dividirNoNivelRaiz(tipoBase.slice("Mapa<".length, -1), ",");
    chaveMapa = partesMapa[0];
    valorMapa = partesMapa[1];
    tipoBase = valorMapa ?? tipoBase;
  }

  return {
    tipo: tipoOriginal,
    modificadores: modificadoresNormalizados,
    tipoOriginal,
    tipoBase,
    cardinalidade,
    opcional,
    tiposAlternativos,
    tipoItem,
    chaveMapa,
    valorMapa,
    refinamentos,
  };
}

function converterCampo(campo: CampoAst): IrCampo {
  return {
    nome: campo.nome,
    ...analisarCampoTipo(campo.valor, campo.modificadores),
  };
}

function converterCampos(bloco?: BlocoGenericoAst): IrCampo[] {
  if (!bloco) {
    return [];
  }
  return bloco.campos.map(converterCampo);
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

function converterImplementacoes(bloco?: BlocoGenericoAst): IrImplementacaoTask[] {
  const implementacoes: IrImplementacaoTask[] = [];
  for (const campo of bloco?.campos ?? []) {
    const origem = campo.nome.toLowerCase();
    if (origem === "ts" || origem === "typescript") {
      implementacoes.push({ origem: "ts", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
      continue;
    }
    if (origem === "py" || origem === "python") {
      implementacoes.push({ origem: "py", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
      continue;
    }
    if (origem === "dart") {
      implementacoes.push({ origem: "dart", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
      continue;
    }
    if (origem === "lua") {
      implementacoes.push({ origem: "lua", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
      continue;
    }
    if (origem === "cs" || origem === "csharp" || origem === "dotnet") {
      implementacoes.push({ origem: "cs", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
      continue;
    }
    if (origem === "java") {
      implementacoes.push({ origem: "java", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
      continue;
    }
    if (origem === "go" || origem === "golang") {
      implementacoes.push({ origem: "go", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
      continue;
    }
    if (origem === "rust" || origem === "rs") {
      implementacoes.push({ origem: "rust", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
      continue;
    }
    if (origem === "cpp" || origem === "cxx" || origem === "cc" || origem === "c++") {
      implementacoes.push({ origem: "cpp", caminho: campo.valor, resolucaoImpl: campo.valor, statusImpl: "nao_verificado" });
    }
  }
  return implementacoes;
}

function converterVinculos(bloco?: BlocoGenericoAst): IrVinculo[] {
  if (!bloco) {
    return [];
  }

  const campos = bloco.campos.map((campo) => {
    const valor = valorCampoCompleto(campo) ?? "";
    return {
      tipo: campo.nome,
      valor,
      arquivo: campo.nome === "arquivo" ? valor : undefined,
      simbolo: campo.nome === "simbolo" ? valor : undefined,
      recurso: ["recurso", "tabela", "fila", "cache", "storage"].includes(campo.nome) ? valor : undefined,
      superficie: ["superficie", "rota", "worker", "cron", "webhook", "evento", "policy", "fila", "cache", "storage"].includes(campo.nome) ? valor : undefined,
      statusResolucao: "nao_verificado" as const,
    };
  });

  const linhas = bloco.linhas.map((linha) => {
    const [tipo, ...resto] = linha.conteudo.split(/\s+/);
    const valor = resto.join(" ").trim();
    return {
      tipo: tipo ?? "desconhecido",
      valor,
      statusResolucao: "nao_verificado" as const,
    };
  }).filter((item) => item.valor);

  const subblocos = bloco.blocos
    .filter((item): item is BlocoGenericoAst => item.tipo === "bloco_generico")
    .map((item) => ({
      tipo: item.palavraChave === "desconhecido" ? (item.nome ?? "desconhecido") : item.palavraChave,
      valor: item.nome ?? item.palavraChave,
      arquivo: valorCampoCompleto(localizarCampo(item, "arquivo")),
      simbolo: valorCampoCompleto(localizarCampo(item, "simbolo")),
      recurso: valorCampoCompleto(localizarCampo(item, "recurso", "tabela", "fila", "cache", "storage")),
      superficie: valorCampoCompleto(localizarCampo(item, "superficie", "rota", "worker", "cron", "webhook", "evento")),
      statusResolucao: "nao_verificado" as const,
    }));

  return [...campos, ...linhas, ...subblocos];
}

function converterExecucao(bloco?: BlocoGenericoAst): IrExecucao {
  const idempotencia = valorCampoCompleto(localizarCampo(bloco, "idempotencia"));
  const criticidadeOperacional = valorCampoCompleto(localizarCampo(bloco, "criticidade_operacional"));

  return {
    idempotencia: idempotencia === "verdadeiro" || idempotencia === "true",
    timeout: valorCampoCompleto(localizarCampo(bloco, "timeout")) ?? "padrao",
    retry: valorCampoCompleto(localizarCampo(bloco, "retry")) ?? "nenhum",
    compensacao: valorCampoCompleto(localizarCampo(bloco, "compensacao")) ?? "nenhuma",
    criticidadeOperacional: (
      criticidadeOperacional === "baixa"
      || criticidadeOperacional === "alta"
      || criticidadeOperacional === "critica"
    ) ? criticidadeOperacional : "media",
    explicita: Boolean(bloco),
  };
}

function converterErrosTask(bloco?: BlocoGenericoAst, fallback?: ErroSemanticoTask[]): IrErroOperacional[] {
  const erros = new Map<string, IrErroOperacional>();

  for (const campo of bloco?.campos ?? []) {
    erros.set(campo.nome, {
      codigo: campo.nome,
      mensagem: valorCampoCompleto(campo) ?? "",
    });
  }

  for (const subbloco of bloco?.blocos ?? []) {
    if (subbloco.tipo !== "bloco_generico") {
      continue;
    }
    const codigo = subbloco.nome ?? subbloco.palavraChave;
    if (!codigo || codigo === "desconhecido") {
      continue;
    }
    erros.set(codigo, {
      codigo,
      mensagem: valorCampoCompleto(localizarCampo(subbloco, "mensagem")) ?? `Erro estruturado "${codigo}".`,
      categoria: valorCampoCompleto(localizarCampo(subbloco, "categoria")),
      recuperabilidade: valorCampoCompleto(localizarCampo(subbloco, "recuperabilidade")),
      acaoChamador: valorCampoCompleto(localizarCampo(subbloco, "acao_chamador")),
      impactaEstado: valorCampoCompleto(localizarCampo(subbloco, "impacta_estado")) === "verdadeiro",
      requerCompensacao: valorCampoCompleto(localizarCampo(subbloco, "requer_compensacao")) === "verdadeiro",
    });
  }

  for (const erro of fallback ?? []) {
    if (!erros.has(erro.codigo)) {
      erros.set(erro.codigo, {
        codigo: erro.codigo,
        mensagem: erro.mensagem,
        categoria: erro.categoria,
        recuperabilidade: erro.recuperabilidade,
        acaoChamador: erro.acaoChamador,
        impactaEstado: erro.impactaEstado,
        requerCompensacao: erro.requerCompensacao,
      });
    }
  }

  return [...erros.values()];
}

function extrairPerfil(bloco?: BlocoGenericoAst, padrao: PerfilCompatibilidade = "interno"): PerfilCompatibilidade {
  const perfil = valorCampoCompleto(localizarCampo(bloco, "perfil", "compatibilidade"))?.toLowerCase();
  if (
    perfil === "publico"
    || perfil === "interno"
    || perfil === "experimental"
    || perfil === "legado"
    || perfil === "deprecado"
  ) {
    return perfil;
  }
  return padrao;
}

function tipoNaoPrimitivo(campo: IrCampo): string | undefined {
  if (!TIPOS_PRIMITIVOS.has(campo.tipoBase)) {
    return campo.tipoBase;
  }
  if (campo.tipoItem && !TIPOS_PRIMITIVOS.has(campo.tipoItem)) {
    return campo.tipoItem;
  }
  if (campo.valorMapa && !TIPOS_PRIMITIVOS.has(campo.valorMapa)) {
    return campo.valorMapa;
  }
  return undefined;
}

function deduplicarTexto(valores: string[]): string[] {
  return [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function resumirAgente(params: {
  input?: IrCampo[];
  output?: IrCampo[];
  efeitos?: Array<{ categoria: string; alvo: string; criticidade?: string }>;
  vinculos?: IrVinculo[];
  execucao?: IrExecucao;
  superficiePublica?: string;
}): IrResumoAgente {
  const entidadesAfetadas = deduplicarTexto([
    ...(params.input ?? []).map(tipoNaoPrimitivo).filter((item): item is string => Boolean(item)),
    ...(params.output ?? []).map(tipoNaoPrimitivo).filter((item): item is string => Boolean(item)),
    ...(params.efeitos ?? []).map((efeito) => efeito.alvo),
  ]);

  const mutacoesPrevistas = deduplicarTexto(
    (params.efeitos ?? []).map((efeito) => `${efeito.categoria}:${efeito.alvo}`),
  );

  const riscos = new Set<string>();
  if ((params.efeitos ?? []).some((efeito) => efeito.categoria === "persistencia")) {
    riscos.add("altera_persistencia");
  }
  if ((params.efeitos ?? []).some((efeito) => efeito.criticidade === "alta" || efeito.criticidade === "critica")) {
    riscos.add("efeito_critico");
  }
  if (params.execucao?.criticidadeOperacional === "alta" || params.execucao?.criticidadeOperacional === "critica") {
    riscos.add("execucao_critica");
  }
  if ((params.vinculos ?? []).length === 0) {
    riscos.add("vinculo_fraco");
  }

  const checks = new Set<string>();
  checks.add("rodar sema validar --json");
  if ((params.output ?? []).length > 0) {
    checks.add("verificar guarantees");
  }
  if ((params.vinculos ?? []).length > 0) {
    checks.add("rodar sema drift --json");
  }
  if (params.superficiePublica) {
    checks.add("validar superficie publica impactada");
  }

  return {
    riscos: [...riscos],
    checks: [...checks],
    entidadesAfetadas,
    superficiesPublicas: params.superficiePublica ? [params.superficiePublica] : [],
    mutacoesPrevistas,
  };
}

function recomporCaminho(campo?: CampoAst): string | undefined {
  const valor = valorCampoCompleto(campo);
  return valor?.replace(/\s*\/\s*/g, "/").trim();
}

function ehUseInterop(
  use: ModuloAst["uses"][number],
): use is ModuloAst["uses"][number] & { origem: "ts" | "py" | "dart" | "lua" | "cs" | "java" | "go" | "rust" | "cpp" } {
  return use.origem !== "sema";
}

function converterErroPublico(erro: IrErroOperacional, origemTask?: string) {
  return {
    nome: erro.codigo,
    codigo: erro.codigo,
    mensagem: erro.mensagem,
    categoria: erro.categoria,
    recuperabilidade: erro.recuperabilidade,
    acaoChamador: erro.acaoChamador,
    impactaEstado: erro.impactaEstado,
    requerCompensacao: erro.requerCompensacao,
    origemTask,
  };
}

function calcularConfiancaPublica(route: IrRoute): NivelConfiancaSemantica {
  if (route.task && route.vinculos.length > 0) {
    return "alta";
  }
  if (route.task || route.vinculos.length > 0) {
    return "media";
  }
  return "baixa";
}

function calcularRiscoPublico(route: IrRoute): NivelRiscoSemantico {
  if (route.efeitosPublicos.some((efeito) => efeito.categoria === "persistencia" || efeito.criticidade === "critica")) {
    return "alto";
  }
  if (route.efeitosPublicos.length > 0 || route.errosPublicos.length > 0) {
    return "medio";
  }
  return "baixo";
}

function converterSuperficie(
  tipo: TipoSuperficieIr,
  superficie: BlocoGenericoAst,
): IrSuperficie {
  const input = converterCampos(encontrarSubBloco(superficie, "input"));
  const output = converterCampos(encontrarSubBloco(superficie, "output"));
  const effects = (encontrarSubBloco(superficie, "effects")?.linhas ?? [])
    .map((linha) => parsearEfeitoSemantico(linha.conteudo))
    .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
  const vinculos = converterVinculos(encontrarSubBloco(superficie, "vinculos"));
  const execucao = converterExecucao(encontrarSubBloco(superficie, "execucao"));
  const task = valorCampoCompleto(localizarCampo(superficie, "task", "tarefa"));
  const perfilCompatibilidade = extrairPerfil(superficie, tipo === "webhook" ? "publico" : "interno");
  const resumoAgente = resumirAgente({
    input,
    output,
    efeitos: effects,
    vinculos,
    execucao,
    superficiePublica: perfilCompatibilidade === "publico" ? `${tipo}:${superficie.nome ?? tipo}` : undefined,
  });

  return {
    tipo,
    nome: superficie.nome ?? tipo,
    campos: converterCampos(superficie),
    linhas: superficie.linhas.map((linha) => linha.conteudo),
    task: task || undefined,
    input,
    output,
    effects,
    implementacoesExternas: converterImplementacoes(encontrarSubBloco(superficie, "impl")),
    vinculos,
    execucao,
    perfilCompatibilidade,
    resumoAgente,
  };
}

export function converterParaIr(modulo: ModuloAst, diagnosticos: Diagnostico[], contexto?: ContextoSemantico): IrModulo {
  const perfilModulo = extrairPerfil(modulo.vinculos, modulo.routes.length > 0 || modulo.webhooks.length > 0 ? "publico" : "interno");

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

  const tarefasSemanticas = contexto?.tarefasDetalhadas ?? new Map();
  const tasks: IrTask[] = modulo.tasks.map((task) => {
    const input = converterCampos(task.input);
    const output = converterCampos(task.output);
    const effects = (task.effects?.linhas ?? [])
      .map((linha) => parsearEfeitoSemantico(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
    const vinculos = converterVinculos(task.vinculos);
    const execucao = converterExecucao(task.execucao);
    const errosDetalhados = converterErrosTask(task.error, tarefasSemanticas.get(task.nome)?.errors);
    const perfilCompatibilidade = extrairPerfil(task.corpo, "interno");
    const resumoAgente = resumirAgente({
      input,
      output,
      efeitos: effects,
      vinculos,
      execucao,
    });

    return {
      nome: task.nome,
      input,
      output,
      rules: task.rules?.linhas.map((linha) => linha.conteudo) ?? [],
      regrasEstruturadas: (task.rules?.linhas ?? [])
        .map((linha) => parsearExpressaoSemantica(linha.conteudo))
        .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
      effects: task.effects?.linhas.map((linha) => linha.conteudo) ?? [],
      efeitosEstruturados: effects,
      implementacoesExternas: converterImplementacoes(task.impl),
      vinculos,
      execucao,
      guarantees: task.guarantees?.linhas.map((linha) => linha.conteudo) ?? [],
      garantiasEstruturadas: (task.guarantees?.linhas ?? [])
        .map((linha) => parsearExpressaoSemantica(linha.conteudo))
        .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
      errors: Object.fromEntries(errosDetalhados.map((erro) => [erro.codigo, erro.mensagem])),
      errosDetalhados,
      perfilCompatibilidade,
      stateContract: task.state ? {
        nomeEstado: task.state.nome ?? task.state.campos.find((campo) => campo.nome === "state" || campo.nome === "estado")?.valor,
        campos: converterCampos(task.state),
        linhas: task.state.linhas.map((linha) => linha.conteudo),
        transicoes: (encontrarSubBloco(task.state, "transitions")?.linhas ?? task.state.linhas)
          .map((linha) => parsearTransicaoEstado(linha.conteudo))
          .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
      } : undefined,
      resumoAgente,
      tests: (task.tests?.blocos.filter((bloco): bloco is BlocoCasoTesteAst => bloco.tipo === "caso_teste") ?? []).map(converterCaso),
    };
  });

  const tarefasPorNome = new Map(tasks.map((task) => [task.nome, task] as const));

  const flows: IrFlow[] = modulo.flows.map((flow) => {
    const campos = converterCampos(flow.corpo);
    const effects = (encontrarSubBloco(flow.corpo, "effects")?.linhas ?? [])
      .map((linha) => parsearEfeitoSemantico(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
    const vinculos = converterVinculos(flow.vinculos);
    const perfilCompatibilidade = extrairPerfil(flow.corpo, "interno");
    return {
      nome: flow.nome,
      campos,
      linhas: flow.corpo.linhas.map((linha) => linha.conteudo),
      tasksReferenciadas: flow.corpo.campos
        .filter((campo) => campo.nome === "task" || campo.nome === "tarefa")
        .map((campo) => campo.valor),
      etapasEstruturadas: flow.corpo.linhas
        .map((linha) => parsearEtapaFlow(linha.conteudo))
        .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
      effects: (encontrarSubBloco(flow.corpo, "effects")?.linhas ?? []).map((linha) => linha.conteudo),
      efeitosEstruturados: effects,
      vinculos,
      perfilCompatibilidade,
      resumoAgente: resumirAgente({
        input: campos,
        efeitos: effects,
        vinculos,
      }),
    };
  });

  const routes: IrRoute[] = modulo.routes.map((route) => ({
    nome: route.nome,
    campos: converterCampos(route.corpo),
    linhas: route.corpo.linhas.map((linha) => linha.conteudo),
    metodo: route.corpo.campos.find((campo) => campo.nome === "metodo")?.valor,
    caminho: recomporCaminho(route.corpo.campos.find((campo) => campo.nome === "caminho")),
    task: route.corpo.campos.find((campo) => campo.nome === "task" || campo.nome === "tarefa")?.valor,
    inputPublico: [],
    outputPublico: [],
    errosPublicos: [],
    efeitosPublicos: [],
    vinculos: converterVinculos(route.vinculos),
    perfilCompatibilidade: extrairPerfil(route.corpo, "publico"),
    garantiasPublicasMinimas: [],
    resumoAgente: {
      riscos: [],
      checks: [],
      entidadesAfetadas: [],
      superficiesPublicas: [],
      mutacoesPrevistas: [],
    },
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
    const errosDeclarados = converterErrosTask(encontrarSubBloco(routeAst.corpo, "error"), tarefaSemantica?.errors);
    const efeitosPublicosDeclarados = (encontrarSubBloco(routeAst.corpo, "effects")?.linhas ?? [])
      .map((linha) => parsearEfeitoSemantico(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
    const inputPublicoResolvido = inputPublicoDeclarado.length > 0
      ? inputPublicoDeclarado
      : (tarefaAssociada?.input ?? tarefaSemantica?.input?.map((campo: { nome: string; tipo: string; modificadores: string[] }) => ({
        nome: campo.nome,
        tipo: campo.tipo,
        modificadores: campo.modificadores,
        tipoOriginal: campo.tipo,
        tipoBase: campo.tipo,
        cardinalidade: "unitario" as const,
        opcional: false,
        tiposAlternativos: [],
        refinamentos: [],
      })) ?? []);
    const outputPublicoResolvido = outputPublicoDeclarado.length > 0
      ? outputPublicoDeclarado
      : (tarefaAssociada?.output ?? tarefaSemantica?.output?.map((campo: { nome: string; tipo: string; modificadores: string[] }) => ({
        nome: campo.nome,
        tipo: campo.tipo,
        modificadores: campo.modificadores,
        tipoOriginal: campo.tipo,
        tipoBase: campo.tipo,
        cardinalidade: "unitario" as const,
        opcional: false,
        tiposAlternativos: [],
        refinamentos: [],
      })) ?? []);
    const errosPublicosResolvidos = errosDeclarados.length > 0
      ? errosDeclarados.map((erro) => converterErroPublico(erro, route.task))
      : (tarefaAssociada?.errosDetalhados ?? (tarefaSemantica?.errors ?? []).map((erro: { codigo: string; mensagem: string }) => ({ codigo: erro.codigo, mensagem: erro.mensagem }))).map((erro: IrErroOperacional) =>
        converterErroPublico(erro, route.task));
    const garantiasPublicasMinimas = (tarefaAssociada?.guarantees ?? tarefaSemantica?.guarantees ?? []).filter((garantia: string) => {
      const referencia = garantia.trim().split(/\s+/)[0] ?? "";
      return outputPublicoResolvido.some((campo: IrCampo) => campo.nome === referencia || garantia.includes(`${campo.nome}.`));
    });

    const routeResolvida: IrRoute = {
      ...route,
      inputPublico: inputPublicoResolvido,
      outputPublico: outputPublicoResolvido,
      errosPublicos: errosPublicosResolvidos,
      efeitosPublicos: efeitosPublicosDeclarados,
      garantiasPublicasMinimas,
      resumoAgente: resumirAgente({
        input: inputPublicoResolvido,
        output: outputPublicoResolvido,
        efeitos: efeitosPublicosDeclarados,
        vinculos: route.vinculos,
        superficiePublica: `${route.metodo ?? "?"} ${route.caminho ?? "?"}`,
      }),
      publico: {
        metodo: route.metodo,
        caminho: route.caminho,
        task: route.task,
        input: inputPublicoResolvido,
        output: outputPublicoResolvido,
        errors: errosPublicosResolvidos,
        effects: efeitosPublicosDeclarados,
        garantiasMinimas: garantiasPublicasMinimas,
        confiancaContrato: "media",
        riscoRegressao: "medio",
        divergenciasPublicas: [],
      },
    };

    routeResolvida.publico.confiancaContrato = calcularConfiancaPublica(routeResolvida);
    routeResolvida.publico.riscoRegressao = calcularRiscoPublico(routeResolvida);
    return routeResolvida;
  });

  const superficies: IrSuperficie[] = [
    ...modulo.workers.map((item) => converterSuperficie("worker", item)),
    ...modulo.eventos.map((item) => converterSuperficie("evento", item)),
    ...modulo.filas.map((item) => converterSuperficie("fila", item)),
    ...modulo.crons.map((item) => converterSuperficie("cron", item)),
    ...modulo.webhooks.map((item) => converterSuperficie("webhook", item)),
    ...modulo.caches.map((item) => converterSuperficie("cache", item)),
    ...modulo.storages.map((item) => converterSuperficie("storage", item)),
    ...modulo.policies.map((item) => converterSuperficie("policy", item)),
  ];

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

  const resumoAgenteModulo = resumirAgente({
    input: [],
    output: [],
    efeitos: [
      ...tasks.flatMap((task) => task.efeitosEstruturados),
      ...routes.flatMap((route) => route.efeitosPublicos),
      ...superficies.flatMap((superficie) => superficie.effects),
    ],
    vinculos: [
      ...converterVinculos(modulo.vinculos),
      ...tasks.flatMap((task) => task.vinculos),
      ...routes.flatMap((route) => route.vinculos),
      ...superficies.flatMap((superficie) => superficie.vinculos),
    ],
  });

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
    vinculos: converterVinculos(modulo.vinculos),
    perfilCompatibilidade: perfilModulo,
    types,
    entities,
    enums: modulo.enums.map((enumeracao) => ({ nome: enumeracao.nome, valores: enumeracao.valores })),
    tasks,
    flows,
    routes,
    superficies,
    states,
    resumoAgente: {
      ...resumoAgenteModulo,
      superficiesPublicas: deduplicarTexto([
        ...routes.map((route) => `${route.metodo ?? "?"} ${route.caminho ?? route.nome}`),
        ...superficies
          .filter((superficie) => superficie.perfilCompatibilidade === "publico")
          .map((superficie) => `${superficie.tipo}:${superficie.nome}`),
      ]),
    },
    diagnosticos,
  };
}
