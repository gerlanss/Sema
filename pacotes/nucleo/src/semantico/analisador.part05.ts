// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.

import { criarDiagnostico, type Diagnostico } from "../diagnosticos/index.js";
import type {
  BlocoCasoTesteAst,
  BlocoGenericoAst,
  CampoAst,
  EntityAst,
  EnumAst,
  FlowAst,
  ModuloAst,
  RouteAst,
  StateAst,
  TaskAst,
  TypeAst,
} from "../ast/tipos.js";
import {
  CAMPOS_DATABASE_SUPORTADOS,
  CAMPOS_RECURSO_PERSISTENCIA_SUPORTADOS,
  classificarCompatibilidadePersistencia,
  nomeTipoRecursoPersistencia,
  normalizarConsistenciaPersistencia,
  normalizarDurabilidadePersistencia,
  normalizarEngineBanco,
  normalizarModeloConsultaPersistencia,
  normalizarModeloTransacaoPersistencia,
  parsearBooleanoPersistencia,
  recursoPersistenciaPodeSerPortavel,
} from "../persistencia/contratos.js";
import {
  ehCategoriaEfeitoSemantico,
  ehCriticidadeEfeitoSemantico,
  extrairReferenciasDaExpressao,
  parsearEfeitoSemantico,
  parsearEtapaFlow,
  parsearExpressaoSemantica,
  parsearTransicaoEstado,
} from "./estruturas.js";
import {
  CLASSIFICACOES_DADO_SUPORTADAS,
  MODOS_AUTH_SUPORTADOS,
  MOTIVOS_AUDIT_SUPORTADOS,
  ORIGENS_AUTH_SUPORTADAS,
  PRINCIPAIS_AUTH_SUPORTADOS,
  REDACOES_LOG_SUPORTADAS,
  TENANTS_AUTHZ_SUPORTADOS,
  contratoDadosTemSegredoOuCredencial,
  contratoDadosTemSensivel,
  extrairContratoAudit,
  extrairContratoAuth,
  extrairContratoAuthz,
  extrairContratoDados,
  extrairContratoForbidden,
  extrairContratoSegredos,
  efeitoEhPrivilegiado,
  efeitoRequerSegredo,
  forbiddenContemRegra,
} from "./seguranca.js";

import { ResumoTaskSemantico, ehMarcadorSemantico, extrairRaiz, indiceErros, indicesCampos, localizarBloco, validarCamposDeTipos, validarVinculos } from "./analisador.part01.js";
import { descreverSugestoes, validarEfeitosDeclarados, validarExpressoesDeclaradas } from "./analisador.part04.js";

export function validarState(
  state: StateAst,
  tiposConhecidos: Set<string>,
  enumsConhecidos: Map<string, Set<string>>,
  diagnosticos: Diagnostico[],
): void {
  const possuiConteudo = state.corpo.campos.length > 0 || state.corpo.linhas.length > 0 || state.corpo.blocos.length > 0;
  if (!possuiConteudo) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM011",
        `Bloco state${state.nome ? ` "${state.nome}"` : ""} precisa declarar campos, linhas ou subblocos.`,
        "erro",
        state.intervalo,
        "Use state para modelar informacao ou transicao observavel, nao como bloco vazio.",
      ),
    );
  }

  validarCamposDeTipos(state.corpo.campos, tiposConhecidos, diagnosticos, `state ${state.nome ?? "<anonimo>"}`);
  const fields = localizarBloco(state.corpo, "fields");
  if (fields) {
    validarCamposDeTipos(fields.campos, tiposConhecidos, diagnosticos, `fields do state ${state.nome ?? "<anonimo>"}`);
  }

  const nomesCampos = new Set([
    ...state.corpo.campos.map((campo) => campo.nome),
    ...(fields?.campos ?? []).map((campo) => campo.nome),
  ]);

  const invariants = localizarBloco(state.corpo, "invariants");
  if (invariants) {
    validarExpressoesDeclaradas(invariants.linhas, diagnosticos, {
      codigoErroSintaxe: "SEM024",
      codigoErroReferencia: "SEM025",
      nomeBloco: `invariants do state ${state.nome ?? "<anonimo>"}`,
      simbolosPermitidos: nomesCampos,
      dicaSintaxe: "Use expressoes como \"campo existe\", \"campo == valor\" ou \"campo em [A, B]\".",
      dicaReferencia: "Referencie apenas campos do proprio state nas invariantes.",
    });
  }

  const transitions = localizarBloco(state.corpo, "transitions");
  if (transitions) {
    const campoTransicao = (fields?.campos ?? []).find((campo) => campo.nome === "status" || campo.nome === "estado")
      ?? state.corpo.campos.find((campo) => campo.nome === "status" || campo.nome === "estado");

    if (!campoTransicao) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM026",
          `State ${state.nome ? `"${state.nome}" ` : ""}declarou transitions sem um campo status ou estado.`,
          "erro",
          transitions.intervalo,
          "Adicione um campo status ou estado para ancorar semanticamente as transicoes.",
        ),
      );
    }

    const enumValores = campoTransicao ? enumsConhecidos.get(campoTransicao.valor) : undefined;
    for (const linha of transitions.linhas) {
      const transicao = parsearTransicaoEstado(linha.conteudo);
      if (!transicao) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM027",
            `Transicao invalida em state ${state.nome ?? "<anonimo>"}: "${linha.conteudo}".`,
            "erro",
            linha.intervalo,
            "Use o formato \"ORIGEM -> DESTINO\" para declarar transicoes.",
          ),
        );
        continue;
      }

      if (enumValores) {
        if (!enumValores.has(transicao.origem)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM028",
              `Transicao do state ${state.nome ?? "<anonimo>"} usa origem "${transicao.origem}" fora do enum ${campoTransicao?.valor}.`,
              "erro",
              linha.intervalo,
              "Use apenas valores declarados no enum associado ao campo status/estado.",
            ),
          );
        }
        if (!enumValores.has(transicao.destino)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM029",
              `Transicao do state ${state.nome ?? "<anonimo>"} usa destino "${transicao.destino}" fora do enum ${campoTransicao?.valor}.`,
              "erro",
              linha.intervalo,
              "Use apenas valores declarados no enum associado ao campo status/estado.",
            ),
          );
        }
      }
    }
  }
}

export function validarInvariantesDeCampos(
  bloco: BlocoGenericoAst,
  nomeBloco: string,
  diagnosticos: Diagnostico[],
): void {
  const fields = localizarBloco(bloco, "fields");
  const nomesCampos = new Set([
    ...bloco.campos.map((campo) => campo.nome),
    ...(fields?.campos ?? []).map((campo) => campo.nome),
  ]);

  const invariants = localizarBloco(bloco, "invariants");
  if (!invariants) {
    return;
  }

  validarExpressoesDeclaradas(invariants.linhas, diagnosticos, {
    codigoErroSintaxe: "SEM062",
    codigoErroReferencia: "SEM063",
    nomeBloco: `invariants de ${nomeBloco}`,
    simbolosPermitidos: nomesCampos,
    dicaSintaxe: "Use expressoes como \"campo existe\", \"campo == valor\" ou \"campo em [A, B]\".",
    dicaReferencia: "Referencie apenas campos declarados no proprio bloco ao escrever invariantes de dominio.",
  });
}

export function validarFlow(
  flow: FlowAst,
  tasksConhecidas: Set<string>,
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>,
  diagnosticos: Diagnostico[],
): void {
  const possuiEtapas = flow.corpo.linhas.length > 0 || flow.corpo.campos.length > 0 || flow.corpo.blocos.length > 0;
  if (!possuiEtapas) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM012",
        `Flow "${flow.nome}" precisa declarar ao menos uma etapa.`,
        "erro",
        flow.intervalo,
        "Adicione linhas declarativas, campos ou subblocos dentro de flow.",
      ),
    );
  }

  const effects = localizarBloco(flow.corpo, "effects");
  if (effects) {
    validarEfeitosDeclarados(effects.linhas, diagnosticos, `effects do flow ${flow.nome}`);
  }
  validarVinculos(flow.vinculos, diagnosticos, `flow ${flow.nome}`);

  const tarefasReferenciadas = flow.corpo.campos
    .filter((campo) => campo.nome === "task" || campo.nome === "tarefa")
    .map((campo) => campo.valor);

  for (const tarefa of tarefasReferenciadas) {
    if (!tasksConhecidas.has(tarefa)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM013",
          `Flow "${flow.nome}" referencia task "${tarefa}" que nao existe.`,
          "erro",
          flow.intervalo,
          "Declare a task no mesmo modulo ou ajuste a referencia do flow.",
        ),
      );
    }
  }

  const etapas = flow.corpo.linhas
    .map((linha) => ({ linha, etapa: parsearEtapaFlow(linha.conteudo) }))
    .filter((item) => item.linha.conteudo.trim().startsWith("etapa "));

  const nomesEtapas = new Set<string>();
  const contextoFlow = new Set(flow.corpo.campos.map((campo) => campo.nome));
  const etapasValidas = new Map<string, NonNullable<(typeof etapas)[number]["etapa"]>>();
  for (const item of etapas) {
    if (!item.etapa) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM032",
          `Linha de etapa invalida em flow "${flow.nome}": "${item.linha.conteudo}".`,
          "erro",
          item.linha.intervalo,
          "Use o formato \"etapa nome usa task com campo=valor quando expressao depende_de etapa_a, etapa_b em_sucesso proxima em_erro falha\".",
        ),
      );
      continue;
    }

    if (nomesEtapas.has(item.etapa.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM033",
          `Flow "${flow.nome}" declarou a etapa "${item.etapa.nome}" mais de uma vez.`,
          "erro",
          item.linha.intervalo,
          "Use nomes unicos para cada etapa estruturada do flow.",
        ),
      );
      continue;
    }

    nomesEtapas.add(item.etapa.nome);
    etapasValidas.set(item.etapa.nome, item.etapa);

    if (item.etapa.task && !tasksConhecidas.has(item.etapa.task)) {
      const sugestoesTasks = descreverSugestoes(tasksConhecidas, "Tasks conhecidas no contexto");
      diagnosticos.push(
        criarDiagnostico(
          "SEM034",
          `Etapa "${item.etapa.nome}" do flow "${flow.nome}" usa task "${item.etapa.task}" que nao existe.`,
          "erro",
          item.linha.intervalo,
          sugestoesTasks ?? "Ajuste a task da etapa para apontar para uma task declarada ou importada.",
        ),
      );
    }

    if (item.etapa.task) {
      const detalhesTask = tarefasDetalhadas.get(item.etapa.task);
      if (detalhesTask) {
        const indiceInput = indicesCampos(detalhesTask.input);
        for (const mapeamento of item.etapa.mapeamentos) {
          const campoInput = indiceInput.get(mapeamento.campo);
          if (!campoInput) {
            diagnosticos.push(
              criarDiagnostico(
                "SEM042",
                `Etapa "${item.etapa.nome}" do flow "${flow.nome}" mapeia o campo "${mapeamento.campo}", que nao existe no input da task "${item.etapa.task}".`,
                "erro",
                item.linha.intervalo,
                "Use apenas campos declarados no input da task associada a etapa.",
              ),
            );
          }

          const raizValor = extrairRaiz(mapeamento.valor);
          const ehLiteral = ["verdadeiro", "falso", "nulo"].includes(mapeamento.valor)
            || /^-?\d+(?:\.\d+)?$/.test(mapeamento.valor)
            || /^".*"$/.test(mapeamento.valor);
          const aceitaLiteralTextual = Boolean(
            campoInput
            && ["Texto", "Id", "Email", "Url"].includes(campoInput.tipo)
            && !mapeamento.valor.includes(".")
            && !contextoFlow.has(raizValor)
            && !nomesEtapas.has(raizValor),
          );
          if (!ehLiteral && !aceitaLiteralTextual && !contextoFlow.has(raizValor) && !nomesEtapas.has(raizValor)) {
            const sugestoesContexto = [
              descreverSugestoes(contextoFlow, "Campos do flow"),
              descreverSugestoes(nomesEtapas, "Etapas conhecidas"),
            ].filter(Boolean).join(" ");
            diagnosticos.push(
              criarDiagnostico(
                "SEM043",
                `Etapa "${item.etapa.nome}" do flow "${flow.nome}" referencia "${mapeamento.valor}" fora do contexto conhecido.`,
                "erro",
                item.linha.intervalo,
                sugestoesContexto || "Mapeie usando campos do proprio flow, saidas de etapas anteriores ou literais simples.",
              ),
            );
          }

          if (mapeamento.valor.includes(".")) {
            const [etapaOrigem, campoSaida] = mapeamento.valor.split(".", 2);
            const etapaReferenciada = etapaOrigem ? etapasValidas.get(etapaOrigem) : undefined;
            const taskReferenciada = etapaReferenciada?.task ? tarefasDetalhadas.get(etapaReferenciada.task) : undefined;
            const indiceOutput = taskReferenciada ? indicesCampos(taskReferenciada.output) : undefined;
            if (etapaOrigem && campoSaida && etapaReferenciada && indiceOutput && !indiceOutput.has(campoSaida)) {
              diagnosticos.push(
                criarDiagnostico(
                  "SEM044",
                  `Etapa "${item.etapa.nome}" do flow "${flow.nome}" referencia a saida "${campoSaida}" da etapa "${etapaOrigem}", mas essa saida nao existe na task associada.`,
                  "erro",
                  item.linha.intervalo,
                  "Use apenas campos declarados no output da task da etapa de origem.",
                ),
              );
            }
          }
        }
      }
    }

    if (item.etapa.condicao) {
      const referencias = extrairReferenciasDaExpressao(item.etapa.condicao).map((referencia) => extrairRaiz(referencia));
      for (const referencia of referencias) {
        if (!ehMarcadorSemantico(referencia) && !tasksConhecidas.has(referencia) && !nomesEtapas.has(referencia) && !contextoFlow.has(referencia)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM035",
              `Condicao da etapa "${item.etapa.nome}" em flow "${flow.nome}" referencia "${referencia}" fora do contexto atual.`,
              "erro",
              item.linha.intervalo,
              "No MVP atual, condicoes de flow devem apontar para marcadores semanticos, campos do flow, tasks conhecidas ou etapas anteriores.",
            ),
          );
        }
      }
    }
  }

  for (const item of etapas) {
    if (!item.etapa) {
      continue;
    }
    for (const dependencia of item.etapa.dependencias) {
      if (!nomesEtapas.has(dependencia)) {
        const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
        diagnosticos.push(
          criarDiagnostico(
            "SEM036",
            `Etapa "${item.etapa.nome}" do flow "${flow.nome}" depende de "${dependencia}", que nao foi declarada.`,
            "erro",
            item.linha.intervalo,
            sugestoesEtapas ?? "Declare a etapa dependente no mesmo flow antes de referencia-la.",
          ),
        );
      }
    }

    for (const destino of [item.etapa.emSucesso, item.etapa.emErro].filter(Boolean)) {
      if (destino && !nomesEtapas.has(destino)) {
        const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
        diagnosticos.push(
          criarDiagnostico(
            "SEM045",
            `Etapa "${item.etapa.nome}" do flow "${flow.nome}" aponta para "${destino}" em ramificacao, mas essa etapa nao foi declarada.`,
            "erro",
            item.linha.intervalo,
            sugestoesEtapas ?? "Declare a etapa de destino no mesmo flow antes de usa-la em em_sucesso ou em_erro.",
          ),
        );
      }
    }

    if (item.etapa.task) {
      const detalhesTask = tarefasDetalhadas.get(item.etapa.task);
      const indiceErrors = indiceErros(detalhesTask?.errors ?? []);
      for (const rotaErro of item.etapa.porErro) {
        if (!indiceErrors.has(rotaErro.tipo)) {
          const sugestoesErros = descreverSugestoes(indiceErrors.keys(), "Erros declarados pela task");
          diagnosticos.push(
            criarDiagnostico(
              "SEM046",
              `Etapa "${item.etapa.nome}" do flow "${flow.nome}" roteia o erro "${rotaErro.tipo}", mas esse erro nao pertence ao contrato da task "${item.etapa.task}".`,
              "erro",
              item.linha.intervalo,
              sugestoesErros ?? "Use apenas erros declarados pela task ou cobertos por testes de erro do contrato atual.",
            ),
          );
        }

        if (!nomesEtapas.has(rotaErro.destino)) {
          const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
          diagnosticos.push(
            criarDiagnostico(
              "SEM047",
              `Etapa "${item.etapa.nome}" do flow "${flow.nome}" aponta o erro "${rotaErro.tipo}" para "${rotaErro.destino}", mas essa etapa nao foi declarada.`,
              "erro",
              item.linha.intervalo,
              sugestoesEtapas ?? "Declare a etapa de destino no mesmo flow antes de usa-la em por_erro.",
            ),
          );
        }
      }
    }
  }
}
