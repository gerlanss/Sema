// SEMA-GOVERNED: sema.produto.sistemas_interativos.cli
// Descricao: renderer textual contextual, deterministico e honesto sobre a fronteira externa.

type Registro = Readonly<Record<string, unknown>>;

const MENSAGENS_ERRO: Readonly<Record<string, string>> = Object.freeze({
  INTERATIVO_ENTRADA_INVALIDA: "A entrada ou o arquivo JSON informado não pôde ser validado.",
  INTERATIVO_ARGUMENTOS_INVALIDOS: "As flags, valores ou argumentos não correspondem à allowlist do subcomando.",
  INTERATIVO_FILTRO_INVALIDO: "Um filtro usa valor fora do vocabulário canônico.",
  INTERATIVO_SUBCOMANDO_DESCONHECIDO: "O subcomando não existe na superfície de sistemas interativos.",
});

function registro(valor: unknown): Registro | undefined {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? valor as Registro
    : undefined;
}

function lista(valor: unknown): readonly unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function textos(valor: unknown): string[] {
  return lista(valor).filter((item): item is string => typeof item === "string");
}

function unicos(valores: readonly string[]): string[] {
  return [...new Set(valores.filter((item) => item.length > 0))];
}

function ids(valor: unknown, campo: string): string[] {
  return unicos(lista(valor).flatMap((item) => {
    if (typeof item === "string") return [item];
    const objeto = registro(item);
    return typeof objeto?.[campo] === "string" ? [objeto[campo] as string] : [];
  }));
}

function adicionarSecao(linhas: string[], titulo: string, itens: readonly string[]): void {
  if (itens.length === 0) return;
  linhas.push("", `${titulo} · ${itens.length}`, ...itens.map((item) => `- ${item}`));
}

function obterBloqueios(payload: Registro, estado: Registro | undefined): string[] {
  const bloqueios = unicos([
    ...textos(payload.bloqueios),
    ...textos(estado?.bloqueios),
  ]);
  const errorCode = typeof payload.errorCode === "string" ? payload.errorCode : undefined;
  return errorCode ? unicos([...bloqueios, errorCode]) : bloqueios;
}

function obterProximosPassos(
  payload: Registro,
  plano: Registro | undefined,
  estado: Registro | undefined,
  evidenciasAusentes: readonly string[],
): string[] {
  const explicitos = unicos([
    ...textos(payload.nextActions),
    ...textos(plano?.nextActions),
    ...textos(estado?.nextActions),
  ]);
  if (explicitos.length > 0) return explicitos;
  if (evidenciasAusentes.length > 0) {
    return evidenciasAusentes.map((item) => `coletar_evidencia_externa:${item}`);
  }

  const comando = typeof payload.comando === "string" ? payload.comando : "desconhecido";
  const sucesso = payload.sucesso === true;
  const padrao: Readonly<Record<string, string>> = {
    capabilities: "consultar pipelines ou adapters com os filtros do sistema alvo",
    schema: "usar o shape v1 e um examplePath como base para a definição",
    pipelines: "validar uma definição e então gerar um plano declarativo",
    adapters: "selecionar explicitamente um adapter compatível no runner externo",
    validar: sucesso ? "planejar a definição validada" : "corrigir os bloqueios da definição",
    planejar: sucesso ? "entregar o plano ao runner externo autorizado" : "corrigir os bloqueios antes de qualquer execução externa",
    "validar-evidencias": sucesso ? "derivar o status local do bundle validado" : "coletar ou corrigir as evidências externas ausentes",
    status: "usar o estado somente como visão local regenerável",
    "validar-protocolo": sucesso ? "arquivar o registro junto às evidências externas" : "corrigir a sequência do protocolo e observar rollback quando exigido",
    desconhecido: "usar capabilities, schema, pipelines, adapters, validar, planejar, validar-evidencias, status ou validar-protocolo",
  };
  return [padrao[comando] ?? padrao.desconhecido];
}

function adicionarCobertura(linhas: string[], matrix: Registro | undefined): void {
  if (!matrix) return;
  const campos: ReadonlyArray<readonly [string, string]> = [
    ["TIPOS", "kinds"],
    ["MODELOS ESPACIAIS", "spatialModels"],
    ["MODOS DE RENDER", "renderModes"],
    ["PERFIS VISUAIS", "visualProfiles"],
    ["CONTROLES", "controlModes"],
    ["MODELOS DE TEMPO", "timeModels"],
    ["DETERMINISMOS", "determinisms"],
    ["FIDELIDADES", "fidelities"],
  ];
  linhas.push("", "COBERTURA CANÔNICA");
  for (const [rotulo, campo] of campos) {
    const valores = textos(matrix[campo]);
    if (valores.length > 0) linhas.push(`- ${rotulo}: ${valores.join(", ")}`);
  }
}

export function renderizarResultadoSistemasInterativos(payload: Registro): string {
  const comando = typeof payload.comando === "string" ? payload.comando : "desconhecido";
  const plano = registro(payload.plano);
  const estado = registro(payload.estado);
  const bloqueios = obterBloqueios(payload, estado);
  const status = typeof estado?.status === "string"
    ? estado.status
    : payload.sucesso === true
      ? "OK"
      : typeof payload.errorCode === "string"
        ? "ERRO"
        : "BLOQUEADO";
  const systemId = typeof plano?.systemId === "string"
    ? plano.systemId
    : typeof payload.systemId === "string"
      ? payload.systemId
      : undefined;

  const capabilities = unicos([
    ...ids(payload.capabilities, "capability"),
    ...textos(payload.capabilitiesRequeridas),
    ...textos(plano?.capabilitiesRequeridas),
  ]);
  const pipelines = unicos([
    ...textos(payload.pipelineIds),
    ...ids(payload.pipelines, "pipelineId"),
    ...ids(plano?.pipelines, "pipelineId"),
  ]);
  const adapters = unicos([
    ...textos(payload.adapterIds),
    ...ids(payload.adapters, "adapterId"),
    ...textos(plano?.adaptersCompativeis),
  ]);
  const adaptersSelecionados = unicos(textos(plano?.adaptersSelecionados));
  const stages = unicos([
    ...ids(payload.stages, "stageInstanceId"),
    ...ids(plano?.stages, "stageInstanceId"),
    ...ids(estado?.stages, "stageId"),
  ]);
  const capabilitiesAusentes = unicos([
    ...textos(payload.capabilitiesAusentes),
    ...textos(plano?.capabilitiesAusentes),
  ]);
  const capabilitiesSemAdapter = unicos(textos(plano?.capabilitiesSemAdapter));
  const evidenciasAceitas = unicos([
    ...textos(payload.evidenciasAceitas),
    ...textos(estado?.evidenciasAceitas),
  ]);
  const evidenciasAusentes = unicos([
    ...textos(payload.evidenciasAusentes),
    ...textos(estado?.evidenciasAusentes),
  ]);
  const proximosPassos = obterProximosPassos(payload, plano, estado, evidenciasAusentes);

  const linhas = [
    `SISTEMAS INTERATIVOS · ${comando.toUpperCase()}`,
    `STATUS · ${status}`,
    `COMANDO · ${comando}`,
    `BLOQUEIOS · ${bloqueios.length}`,
  ];
  if (systemId) linhas.push(`SISTEMA · ${systemId}`);
  if (estado) {
    linhas.push(
      `COBERTURA LOCAL · ${estado.localCoverageComplete === true ? "COMPLETA" : "INCOMPLETA"}`,
      `ESCOPO DE CONCLUSÃO · ${typeof estado.completionScope === "string" ? estado.completionScope : "STRUCTURAL_LOCAL"}`,
      `ATESTAÇÃO EXTERNA · ${estado.awaitingExternalAttestation === true ? "PENDENTE" : "NÃO DECLARADA"}`,
    );
  }

  const errorCode = typeof payload.errorCode === "string" ? payload.errorCode : undefined;
  if (errorCode) {
    linhas.push("", `ERRO · ${errorCode}`, MENSAGENS_ERRO[errorCode] ?? "A operação não pôde ser concluída.");
  }

  adicionarCobertura(linhas, registro(payload.matrix));
  const schema = registro(payload.definitionSchema);
  adicionarSecao(linhas, "CAMPOS OBRIGATÓRIOS DO SHAPE V1", textos(schema?.requiredFields));
  adicionarSecao(linhas, "EXEMPLOS", textos(payload.examplePaths));
  adicionarSecao(linhas, "CAPABILITIES", capabilities);
  adicionarSecao(linhas, "PIPELINES", pipelines);
  adicionarSecao(linhas, "ADAPTERS CANDIDATOS COMPATÍVEIS", adapters);
  adicionarSecao(linhas, "ADAPTERS SELECIONADOS", adaptersSelecionados);
  adicionarSecao(linhas, "ETAPAS", stages);
  adicionarSecao(linhas, "CAPABILITIES AUSENTES", capabilitiesAusentes);
  adicionarSecao(linhas, "CAPABILITIES SEM ADAPTER SELECIONADO", capabilitiesSemAdapter);
  adicionarSecao(linhas, "EVIDÊNCIAS ACEITAS", evidenciasAceitas);
  adicionarSecao(linhas, "EVIDÊNCIAS AUSENTES", evidenciasAusentes);
  adicionarSecao(linhas, "BLOQUEIOS DETALHADOS", bloqueios);
  adicionarSecao(linhas, "PRÓXIMOS PASSOS", proximosPassos);

  if (status === "STRUCTURALLY_COMPLETE") {
    linhas.push(
      "",
      "CONCLUSÃO ESTRUTURAL LOCAL — NÃO PROVA EXECUÇÃO REAL",
      "- Todos os requisitos estruturais locais têm cobertura, mas ainda falta atestação externa independente.",
    );
  }

  linhas.push(
    "",
    "FRONTEIRA OPERACIONAL",
    "- Runtime e adapters: externos; nenhum engine, editor ou runner foi iniciado.",
    "- Workspace: intacto; nenhuma escrita foi aplicada.",
    "- Autoridade: saída local e não autoritativa; bundle local não substitui trust, ledger ou checkpoint externo.",
  );
  return linhas.join("\n");
}
