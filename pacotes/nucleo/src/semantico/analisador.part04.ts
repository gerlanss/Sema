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

import { PerfilSegurancaDeclarado, superficieEhPublica, validarExecucaoBloco } from "./analisador.part02.js";
import { CAMPOS_ERRO_OPERACIONAL, ContextoSemantico, SimboloSemantico, diagnosticoDuplicado, ehMarcadorSemantico, extrairRaiz, localizarBloco, localizarCampo, validarCamposDeTipos, validarVinculos } from "./analisador.part01.js";
import { coletarPerfilSegurancaDeclarado } from "./analisador.part03.js";

export function emitirGuardrailsSeguranca(
  contexto: string,
  intervalo: CampoAst["intervalo"] | undefined,
  perfil: PerfilSegurancaDeclarado,
  diagnosticos: Diagnostico[],
  opcoes: { publico: boolean; sensivel: boolean },
): void {
  const exigeAuth = opcoes.publico;
  const exigeAuthz = opcoes.publico || opcoes.sensivel || perfil.efeitoPrivilegiado || perfil.dadosSensiveis;
  const exigeDados = opcoes.publico || opcoes.sensivel || perfil.efeitoPrivilegiado;
  const exigeAudit = opcoes.publico || opcoes.sensivel || perfil.efeitoPrivilegiado || perfil.dadosSensiveis;
  const exigeSegredos = perfil.exigeSegredos;
  const exigeForbidden = perfil.efeitoPrivilegiado || perfil.dadosSensiveis;

  if (exigeAuth && !perfil.auth.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM094",
        `${contexto} deveria declarar auth explicita para reduzir ambiguidade de seguranca na borda publica.`,
        "aviso",
        intervalo,
        "Declare auth { modo: obrigatorio|anonimo ... } para deixar a intencao da exposicao publica cristalina.",
      ),
    );
  }
  if (exigeAuthz && !perfil.authz.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM095",
        `${contexto} deveria declarar authz explicita porque opera com risco, privilegio ou exposicao publica.`,
        "aviso",
        intervalo,
        "Declare papeis, escopos ou politica em authz para nao empurrar autorizacao para o limbo do codigo vivo.",
      ),
    );
  }
  if (exigeDados && !perfil.dados.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM096",
        `${contexto} deveria classificar dados de forma explicita em dados { ... }.`,
        "aviso",
        intervalo,
        "Classifique input/output com publico, interno, pii, financeiro, credencial ou segredo.",
      ),
    );
  }
  if (exigeAudit && !perfil.audit.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM097",
        `${contexto} deveria declarar audit explicita para operar com trilha semantica de seguranca.`,
        "aviso",
        intervalo,
        "Declare audit { evento: ... correlacao: ... motivo: ... } para nao depender de adivinhacao operacional.",
      ),
    );
  }
  if (exigeSegredos && !perfil.segredos.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM098",
        `${contexto} deveria declarar segredos explicitos porque toca credencial, segredo ou secret.read.`,
        "aviso",
        intervalo,
        "Use segredos { nome { origem: vault escopo: runtime ... } } para governar acesso sensivel.",
      ),
    );
  }
  if (exigeForbidden && !perfil.forbidden.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM099",
        `${contexto} deveria declarar forbidden explicito para proibir operacoes perigosas ou vazamento semantico.`,
        "aviso",
        intervalo,
        "Use forbidden { network.egress shell.exec log.segredo retorno.credencial } conforme o risco da operacao.",
      ),
    );
  }
}

export function validarErroOperacional(task: TaskAst, diagnosticos: Diagnostico[]): void {
  if (!task.error) {
    return;
  }

  const nomes = new Set<string>();
  for (const campo of task.error.campos) {
    if (nomes.has(campo.nome)) {
      diagnosticos.push(diagnosticoDuplicado(campo.nome, "Erro", campo.intervalo));
    }
    nomes.add(campo.nome);
  }

  for (const bloco of task.error.blocos) {
    if (bloco.tipo !== "bloco_generico") {
      continue;
    }

    const codigo = bloco.nome ?? bloco.palavraChave;
    if (!codigo || codigo === "desconhecido") {
      continue;
    }

    if (nomes.has(codigo)) {
      diagnosticos.push(diagnosticoDuplicado(codigo, "Erro", bloco.intervalo));
    }
    nomes.add(codigo);

    const mensagem = localizarCampo(bloco, "mensagem");
    if (!mensagem) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM067",
          `Erro estruturado "${codigo}" da task "${task.nome}" precisa declarar mensagem.`,
          "erro",
          bloco.intervalo,
          "Use error { codigo { mensagem: \"...\" categoria: dominio ... } }.",
        ),
      );
    }

    for (const campo of bloco.campos) {
      if (!CAMPOS_ERRO_OPERACIONAL.has(campo.nome)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM068",
            `Erro estruturado "${codigo}" da task "${task.nome}" usa o campo "${campo.nome}", que nao e suportado.`,
            "erro",
            campo.intervalo,
            "Use mensagem, categoria, recuperabilidade, acao_chamador, impacta_estado ou requer_compensacao.",
          ),
        );
      }
    }
  }
}

export function validarSuperficie(
  superficie: BlocoGenericoAst,
  tipoSuperficie: SimboloSemantico["categoria"],
  tasksConhecidas: Set<string>,
  tiposConhecidos: Set<string>,
  diagnosticos: Diagnostico[],
): void {
  const nomeSuperficie = superficie.nome ?? tipoSuperficie;
  const task = localizarCampo(superficie, "task", "tarefa");
  const input = localizarBloco(superficie, "input");
  const output = localizarBloco(superficie, "output");
  const effects = localizarBloco(superficie, "effects");
  const impl = localizarBloco(superficie, "impl");
  const vinculos = localizarBloco(superficie, "vinculos");
  const execucao = localizarBloco(superficie, "execucao");

  if (!task && !impl && !vinculos) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM069",
        `Superficie ${tipoSuperficie} "${nomeSuperficie}" precisa declarar task, impl ou vinculos para nao virar bloco decorativo.`,
        "erro",
        superficie.intervalo,
        "Declare ao menos uma task associada, um impl explicito ou vinculos rastreaveis com codigo vivo.",
      ),
    );
  }

  if (task && !tasksConhecidas.has(task.valor)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM070",
        `Superficie ${tipoSuperficie} "${nomeSuperficie}" referencia task "${task.valor}" que nao existe.`,
        "erro",
        task.intervalo,
        "Ajuste a task para apontar para uma task declarada ou importada.",
      ),
    );
  }

  if (input) {
    validarCamposDeTipos(input.campos, tiposConhecidos, diagnosticos, `input da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  if (output) {
    validarCamposDeTipos(output.campos, tiposConhecidos, diagnosticos, `output da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  if (effects) {
    validarEfeitosDeclarados(effects.linhas, diagnosticos, `effects da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  validarExecucaoBloco(execucao, diagnosticos, `superficie ${tipoSuperficie} "${nomeSuperficie}"`);
  validarVinculos(vinculos, diagnosticos, `${tipoSuperficie} ${nomeSuperficie}`);

  const perfilSeguranca = coletarPerfilSegurancaDeclarado(
    superficie,
    effects,
    diagnosticos,
    `superficie ${tipoSuperficie} "${nomeSuperficie}"`,
  );
  emitirGuardrailsSeguranca(
    `Superficie ${tipoSuperficie} "${nomeSuperficie}"`,
    superficie.intervalo,
    perfilSeguranca,
    diagnosticos,
    {
      publico: superficieEhPublica(superficie, tipoSuperficie),
      sensivel: perfilSeguranca.efeitoPrivilegiado || perfilSeguranca.dadosSensiveis,
    },
  );
}

export function recomporCaminhoRoute(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }

  return [campo.valor, ...campo.modificadores]
    .join(" ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

export function serializarTransicao(origem: string, destino: string): string {
  return `${origem}->${destino}`;
}

export function descreverSugestoes(valores: Iterable<string>, prefixo: string): string | undefined {
  const lista = [...new Set([...valores].filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (lista.length === 0) {
    return undefined;
  }
  const recorte = lista.slice(0, 6).join(", ");
  return `${prefixo}: ${recorte}${lista.length > 6 ? ", ..." : ""}.`;
}

export function listarCandidatosUseRelativo(moduloAtual: string, caminhoImportado: string): string[] {
  const segmentos = moduloAtual.split(".").filter(Boolean);
  const caminhoNormalizado = caminhoImportado.replace(/^\.+/u, "").trim();
  if (!caminhoNormalizado || segmentos.length <= 1) {
    return [];
  }

  const candidatos: string[] = [];
  for (let tamanho = segmentos.length - 1; tamanho >= 1; tamanho -= 1) {
    const candidato = [...segmentos.slice(0, tamanho), caminhoNormalizado].join(".");
    if (candidato !== caminhoImportado) {
      candidatos.push(candidato);
    }
  }

  return [...new Set(candidatos)];
}

export function resolverUseSema(
  moduloAtual: string,
  caminhoImportado: string,
  contextosModulos?: Map<string, ContextoSemantico>,
): { caminhoResolvido?: string; candidatosRelativos: string[] } {
  if (!contextosModulos) {
    return { caminhoResolvido: undefined, candidatosRelativos: [] };
  }

  if (contextosModulos.has(caminhoImportado)) {
    return { caminhoResolvido: caminhoImportado, candidatosRelativos: [] };
  }

  const candidatosRelativos = listarCandidatosUseRelativo(moduloAtual, caminhoImportado);
  const caminhoResolvido = candidatosRelativos.find((candidato) => contextosModulos.has(candidato));
  return { caminhoResolvido, candidatosRelativos };
}

export function descreverDicaSintaxeExpressao(texto: string, dicaPadrao: string): string {
  const normalizado = texto.trim();
  if (
    /\sou\s/u.test(normalizado)
    && (
      normalizado.includes("\"")
      || normalizado.includes("'")
      || /^[A-Za-z_][A-Za-z0-9_.]*\s*(==|!=|>|<|>=|<=)\s+.+\s+ou\s+.+$/u.test(normalizado)
    )
    && !/\bem\s+\[/u.test(normalizado)
  ) {
    const alvo = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*(==|!=|>|<|>=|<=)/u)?.[1];
    if (alvo) {
      return `${dicaPadrao} Se a ideia era comparar ${alvo} contra varios valores, repita o campo em cada comparacao ou prefira "${alvo} em [A, B]".`;
    }
    return `${dicaPadrao} Se a ideia era comparar um campo contra varios valores, repita o campo em cada comparacao ou prefira "campo em [A, B]".`;
  }

  return dicaPadrao;
}

export function validarExpressoesDeclaradas(
  linhas: BlocoGenericoAst["linhas"],
  diagnosticos: Diagnostico[],
  contexto: {
    codigoErroSintaxe: string;
    codigoErroReferencia: string;
    nomeBloco: string;
    simbolosPermitidos: Set<string>;
    dicaSintaxe: string;
    dicaReferencia: string;
    aceitarMarcadoresSemanticos?: boolean;
    dicaReferenciaPersonalizada?: (raiz: string, linha: string) => string | undefined;
  },
): void {
  for (const linha of linhas) {
    const expressao = parsearExpressaoSemantica(linha.conteudo);
    if (!expressao) {
      diagnosticos.push(
        criarDiagnostico(
          contexto.codigoErroSintaxe,
          `Declaracao invalida em ${contexto.nomeBloco}: "${linha.conteudo}".`,
          "erro",
          linha.intervalo,
          descreverDicaSintaxeExpressao(linha.conteudo, contexto.dicaSintaxe),
        ),
      );
      continue;
    }

    for (const referencia of extrairReferenciasDaExpressao(expressao)) {
      const raiz = extrairRaiz(referencia);
      const referenciaPermitida = contexto.simbolosPermitidos.has(raiz) || (contexto.aceitarMarcadoresSemanticos && ehMarcadorSemantico(raiz));
      if (!referenciaPermitida) {
        diagnosticos.push(
          criarDiagnostico(
            contexto.codigoErroReferencia,
            `Declaracao em ${contexto.nomeBloco} referencia "${raiz}", que nao pertence ao contexto permitido.`,
            "erro",
            linha.intervalo,
            contexto.dicaReferenciaPersonalizada?.(raiz, linha.conteudo) ?? contexto.dicaReferencia,
          ),
        );
      }
    }
  }
}

export function validarEfeitosDeclarados(linhas: BlocoGenericoAst["linhas"], diagnosticos: Diagnostico[], contexto: string): void {
  for (const linha of linhas) {
    const efeito = parsearEfeitoSemantico(linha.conteudo);
    if (!efeito) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM023",
          `Declaracao invalida de efeito em ${contexto}: "${linha.conteudo}".`,
          "erro",
          linha.intervalo,
          "Use o formato \"categoria alvo\" ou \"categoria alvo detalhe\", podendo adicionar criticidade=..., privilegio=... e isolamento=....",
        ),
      );
      continue;
    }

    if (!ehCategoriaEfeitoSemantico(efeito.categoria)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM048",
          `Categoria de efeito "${efeito.categoria}" nao e suportada em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use categorias como persistencia, consulta, evento, auditoria, db.write, queue.publish, fs.write, network.egress, secret.read ou shell.exec.",
        ),
      );
    }

    if (efeito.criticidadeTexto && !ehCriticidadeEfeitoSemantico(efeito.criticidadeTexto)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM052",
          `Criticidade de efeito "${efeito.criticidadeTexto}" nao e suportada em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use apenas criticidade=baixa, criticidade=media, criticidade=alta ou criticidade=critica.",
        ),
      );
    }

    if (
      efeito.privilegioTexto
      && !["leitura", "escrita", "publicacao", "execucao", "admin", "egress"].includes(efeito.privilegioTexto)
    ) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM092",
          `Privilegio de efeito "${efeito.privilegioTexto}" nao e suportado em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use privilegio=leitura, privilegio=escrita, privilegio=publicacao, privilegio=execucao, privilegio=admin ou privilegio=egress.",
        ),
      );
    }

    if (
      efeito.isolamentoTexto
      && !["tenant", "processo", "host", "vps", "global"].includes(efeito.isolamentoTexto)
    ) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM093",
          `Isolamento de efeito "${efeito.isolamentoTexto}" nao e suportado em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use isolamento=tenant, isolamento=processo, isolamento=host, isolamento=vps ou isolamento=global.",
        ),
      );
    }
  }
}
