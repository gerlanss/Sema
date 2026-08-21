// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.escrita_segura_workspace, sema.produto.governanca_ia.drift.cache.modos
// Descrição: gera contexto local e grava artefatos somente dentro da base validada.

import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import pacoteCli from "../package.json" with { type: "json" };
import {
  compilarCodigo,
  formatarCodigo,
  formatarDiagnosticos,
  gerarRespostaValidacao,
  lerArquivoTexto,
  temErros,
  type IrModulo,
} from "@sema/nucleo";
import { descreverEstruturaModulo, type AlvoGeracao, type FrameworkGeracao } from "@sema/padroes";
import { gerarDart } from "@sema/gerador-dart";
import { gerarLua } from "@sema/gerador-lua";
import { gerarPython } from "@sema/gerador-python";
import { gerarTypeScript } from "@sema/gerador-typescript";
import { gerarJavaScript } from "@sema/gerador-javascript";
import { gerarHtml } from "@sema/gerador-html";
import { gerarCss } from "@sema/gerador-css";
import {
  carregarConfiguracaoProjeto,
  carregarProjeto,
  resolverAlvoPadrao,
  resolverAlvosVerificacao,
  resolverEstruturaSaidaPadrao,
  resolverFrameworkPadrao,
  resolverSaidaPadrao,
  type ContextoProjetoCarregado,
} from "./projeto.js";
import type { EstruturaSaida } from "./tipos.js";
import { importarProjetoLegado, resumoImportacao, type FonteImportacao } from "./importador.js";
import {
  analisarDriftLegado,
  assistirRenomeacaoSemantica,
  gerarMapaImpactoSemantico,
  type OpcoesDriftLegado,
} from "./drift.js";
import {
  compactarDocumentoObrigatorio,
  resolverDocumentacaoObrigatoria,
  verificarDocumentacaoMudanca,
} from "./docs.js";
import {
  avaliarOrcamentoArquivo,
  LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO,
  LIMITE_AVISO_LINHAS_CONTRATO_SEMA,
  LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO,
  LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA,
} from "./driftOrcamento.js";
import { REGISTRO_COMANDOS } from "./comandos.js";
import {
  ARQUIVO_AGENT_CONTEXT_PACK,
  ARQUIVO_DOC_AGENTES_CAPACIDADE,
  ARQUIVO_SEMA_BOOT,
  ARQUIVO_SEMA_SMALL_MODEL,
  ARQUIVOS_CANONICOS_IA_RAIZ,
  CAPACIDADES_IA_OPERACIONAIS,
  type AgentContextPack,
  type CapacidadeIa,
  type GuiaCapacidadeIaMap,
} from './agentContextTipos.js';
import { criarAgentContextPack, criarGuiaCapacidadeIa, LIMITE_CARACTERES_PAYLOAD_INLINE } from './agentContextPack.js';
import { criarEntradaCanonicaProjeto } from './agentContext.js';
import {
  renderizarDocumentoAgentesPorCapacidade,
  renderizarSemaBoot,
  renderizarSemaSmallModel,
  sincronizarEntrypointCodex,
} from './agentEntryPoints.js';
import { escreverArquivos, caminhoExiste } from './fsGovernado.js';
import { escreverArquivoWorkspaceSeguro, validarDestinosEscritaWorkspace } from './workspaceWrite.js';
import { localizarDiretorioExemplosOficiais, materializarExemplosOficiais } from './exemplosOficiais.js';
import { comandoIniciar, comandoInstalarExemplos } from './initCommand.js';
import type { TemplateIniciar } from './initTemplatesBase.js';
import { carregarModulos } from './carregarModulos.js';
import { obterOpcao, obterOpcoesRepetidas, obterPosicionais, possuiFlag } from './cliArgs.js';
import { limitarLista, resumirListaTexto, unicosOrdenados } from './textoListas.js';
import { EXTENSOES_CODIGO, listarArquivosRecursivosLimitado } from './projetoBusca.js';
import { comandoAuthor, comandoProfile, criarPayloadRulePacks, normalizarProfileGovernanca, renderizarRulePacksTexto } from './profileAuthorCommand.js';
import { EXEMPLOS_PROMPT_IA, PROMPT_BASE_IA, PROMPT_IA_REACT, PROMPT_IA_SEMA_PRIMEIRO, PROMPT_IA_UI, STARTER_IA } from './iaPrompts.js';
import {
  comandoDisponivel,
  resolverExecucaoPytest,
  TSX_EXECUTOR_CLI,
  type ExecucaoComandoExterno,
} from './execucoesExternas.js';
import { avaliarDependenciasVerificacao, comandoDoctor, imprimirFalhaDependenciasVerificacao } from './doctorCommand.js';
import {
  aplicarEstruturaSaida,
  contarCasosDeTesteGerados,
  executarTestesGerados,
  executarTestesParaVerificacao,
  gerarArquivosPorAlvo,
  garantirIr,
  nomeSubpastaModulo,
  normalizarFonteImportacao,
  normalizarTemplateIniciar,
  resolverConfiguracaoVerificacaoPorAlvo,
  validarCompatibilidadeFramework,
  type ResultadoExecucaoTestes,
  type ResumoAlvoVerificacao,
  type ResumoModuloVerificacao,
  type SaidaTesteCapturada,
} from './geracaoCore.js';

import { ContextoIaGerado, ResumoSemanticoModuloIa, VERSAO_CLI, type ResultadoDriftIa } from "./index.part01.js";
import { coletarResumoSemanticoModulo, descreverFontesConclusao, detectarFontesConclusaoSnapshot, detectarModoVerificacaoCodigo } from "./index.part02.js";
import { ARQUIVOS_RESUMO_MODULO_IA, carregarContextoModuloIa, criarBriefingAgente, criarBriefingAgenteContratos, gerarArquivosResumoModuloIa, renderizarResumoProjetoMarkdown, resumirDriftPorModulo } from "./index.part03.js";
import type { ResolucaoModoCacheDrift } from "./driftCacheModes.js";

export const ARQUIVOS_RESUMO_PROJETO_IA = [
  ARQUIVO_SEMA_BOOT,
  ARQUIVO_SEMA_SMALL_MODEL,
  "SEMA_BRIEF.md",
  "SEMA_BRIEF.micro.txt",
  "SEMA_BRIEF.curto.txt",
  "SEMA_INDEX.json",
  ARQUIVO_AGENT_CONTEXT_PACK,
  ARQUIVO_DOC_AGENTES_CAPACIDADE,
] as const;

async function listarTopArquivosCodigoDetectados(diretoriosCodigo: string[], limite = 24): Promise<string[]> {
  const encontrados = new Set<string>();
  for (const diretorio of diretoriosCodigo.sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    if (encontrados.size >= limite) {
      break;
    }
    const restantes = Math.max(limite - encontrados.size, 0);
    const arquivos = await listarArquivosRecursivosLimitado(diretorio, EXTENSOES_CODIGO, 4, restantes);
    for (const arquivo of arquivos) {
      encontrados.add(path.resolve(arquivo));
    }
  }
  return [...encontrados].sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, limite);
}

function escolherTopArquivosResumo(
  modulos: ResumoSemanticoModuloIa[],
  arquivosCodigoDetectados: string[],
): { arquivos: string[]; fonte: "vinculo_contrato" | "codigo_detectado_sem_vinculo" | "nenhum" } {
  const vinculados = unicosOrdenados(modulos.flatMap((modulo) => modulo.arquivosProvaveis));
  if (vinculados.length > 0) {
    return { arquivos: vinculados, fonte: "vinculo_contrato" };
  }
  if (arquivosCodigoDetectados.length > 0) {
    return { arquivos: arquivosCodigoDetectados, fonte: "codigo_detectado_sem_vinculo" };
  }
  return { arquivos: [], fonte: "nenhum" };
}

export async function gerarResumoProjetoIa(
  entrada: string | undefined,
  pastaSaidaOpcional?: string,
  escreverNaRaiz = false,
  analiseDrift: ResolucaoModoCacheDrift = { modo: "none", executar: false, avisos: [] },
): Promise<{
  geradoEm: string;
  baseProjeto: string;
  pastaSaida: string;
  modoVerificacaoCodigo: ResumoSemanticoModuloIa["modoVerificacaoCodigo"];
  artefatos: string[];
  modulos: ResumoSemanticoModuloIa[];
  guiaPorCapacidade: GuiaCapacidadeIaMap;
  analiseDrift: {
    modo: ResolucaoModoCacheDrift["modo"];
    executada: boolean;
    sucesso: boolean | null;
    aviso: string | null;
    cache: ResultadoDriftIa["escopo_aplicado"]["cache"] | null;
  };
}> {
  const contextoProjeto = await carregarProjeto(entrada, process.cwd(), {
    escopo: "projeto",
    adiarDescobertaCodigo: !analiseDrift.executar,
  });
  const geradoEm = new Date().toISOString();
  const guiaPorCapacidade = criarGuiaCapacidadeIa();
  const entradaCanonica = criarEntradaCanonicaProjeto(guiaPorCapacidade);
  const agentContextPack = entradaCanonica.agentContextPack;
  const modoVerificacaoCodigo = analiseDrift.executar
    ? await detectarModoVerificacaoCodigo(
      contextoProjeto.baseProjeto,
      contextoProjeto.diretoriosCodigo,
    )
    : "contratos_apenas";
  const fontesConclusao = analiseDrift.executar
    ? await detectarFontesConclusaoSnapshot(contextoProjeto.baseProjeto)
    : ["contrato"];
  const resultadoDrift = analiseDrift.executar
    ? await analisarDriftLegado(contextoProjeto, {
      escopo: "projeto",
      modoCache: analiseDrift.modo,
      avisosModoCache: analiseDrift.avisos,
    })
    : null;
  const modulos = contextoProjeto.modulosSelecionados.map((item) => {
    const modulo = item.resultado.modulo?.nome ?? path.basename(item.caminho, ".sema");
    const driftResumo = resultadoDrift
      ? resumirDriftPorModulo(modulo, item.caminho, resultadoDrift)
      : null;
    const briefing = resultadoDrift && driftResumo
      ? criarBriefingAgente(item.caminho, modulo, item.resultado.ir ?? null, driftResumo, resultadoDrift)
      : criarBriefingAgenteContratos(item.caminho, modulo, item.resultado.ir ?? null);
    return coletarResumoSemanticoModulo({
      arquivo: item.caminho,
      modulo,
      geradoEm,
      ir: item.resultado.ir ?? null,
      briefing,
      drift: {
        comando: "drift",
        caminho: item.caminho,
        modulo,
        modo: analiseDrift.modo,
        executada: analiseDrift.executar,
        sucesso: resultadoDrift?.sucesso ?? null,
        aviso: analiseDrift.executar
          ? null
          : "Análise de drift não executada; implementação, vínculos e rotas não foram verificados.",
        resumo: driftResumo,
        drift: resultadoDrift,
      },
      modoVerificacaoCodigo,
      fontesConclusao,
    });
  });
  const arquivosCodigoDetectados = analiseDrift.executar && modoVerificacaoCodigo === "codigo_completo"
    ? await listarTopArquivosCodigoDetectados(contextoProjeto.diretoriosCodigo)
    : [];
  const topArquivosResumo = escolherTopArquivosResumo(modulos, arquivosCodigoDetectados);

  const baseProjeto = contextoProjeto.baseProjeto;
  const pastaSaida = escreverNaRaiz
    ? baseProjeto
    : pastaSaidaOpcional
      ? path.resolve(pastaSaidaOpcional)
      : path.resolve(baseProjeto, ".tmp", "sema-resumo");

  await mkdir(pastaSaida, { recursive: true });

  const semaBrief = renderizarResumoProjetoMarkdown(geradoEm, modulos, guiaPorCapacidade);
  const semaBoot = renderizarSemaBoot(agentContextPack);
  const semaSmallModel = renderizarSemaSmallModel(agentContextPack);
  const docAgentesCapacidade = renderizarDocumentoAgentesPorCapacidade(agentContextPack);
  const indexJson = {
    comando: "resumo-projeto",
    geradoEm,
    cliVersao: VERSAO_CLI,
    baseProjeto,
    modoVerificacaoCodigo,
    analiseDrift: {
      modo: analiseDrift.modo,
      executada: analiseDrift.executar,
      sucesso: resultadoDrift?.sucesso ?? null,
      aviso: analiseDrift.executar
        ? null
        : "Análise de drift não executada; o resumo contém somente evidência contratual.",
      cache: resultadoDrift?.escopo_aplicado.cache ?? null,
    },
    fontesConclusao,
    conclusoesPorFonte: descreverFontesConclusao(fontesConclusao, modoVerificacaoCodigo),
    totalModulos: modulos.length,
    entradaCanonica,
    agentContextPack,
    guiaPorCapacidade,
    topArquivosCodigoDetectados: arquivosCodigoDetectados.map((item) => {
      const rel = path.relative(contextoProjeto.baseProjeto, item);
      return rel && !rel.startsWith("..") ? rel.replace(/[\\/]/g, "/") : item.replace(/[\\/]/g, "/");
    }),
    modulos,
  };
  const micro = [
    `PROJETO: ${path.basename(baseProjeto)}`,
    `MODULOS: ${modulos.length}`,
    `MODO_CODIGO: ${modoVerificacaoCodigo}`,
    `RESULTADO_DRIFT: ${resultadoDrift ? (resultadoDrift.sucesso ? "sucesso" : "falha") : "não avaliado"}`,
    `FONTES_CONCLUSAO: ${resumirListaTexto(fontesConclusao, 4)}`,
    `ENTRADA_IA: ${entradaCanonica.porCapacidade.fraca.join(" -> ")}`,
    `POLITICA_PLATAFORMA: Sema governa projeto e nao contorna politicas da plataforma; se houver alerta externo, pare e explique sem burlar filtro`,
    `TIMEOUT_SEMA: timeout local nao e falha; retry progressivo ${agentContextPack.politicaTimeoutResumo.escalonamentoSegundos.map((segundos) => `${segundos}s`).join(" -> ")}; escopar arquivo se projeto inteiro for lento`,
    `CODIGO_GOVERNADO: ${agentContextPack.politicaCodigoGovernado.marcador} -> chamar Sema antes de editar codigo gerado; validacao inline nao dispensa cabecalho fisico`,
    `ORCAMENTO_SEMANTICO: codigo aviso>${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO} bloqueio>${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO}; .sema aviso>${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} bloqueio>${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA}; .sema por capacidade, nunca parte_1/parte_2; docs Markdown fora do limite de codigo`,
    `PAYLOAD_INLINE: inline>${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres nao e timeout; modularize por responsabilidade ou use anexo/caminho autorizado`,
    `SINAL_VS_RITUAL: score/achados/decisaoAgente sao triagem; exigir evidencia concreta alem de palavra-chave ou regex`,
    `DESIGN_VISUAL: se houver UI, moderno obrigatorio; fraca=padrao seguro responsivo; media=tokens+estados; forte=screenshot+assets+microinteracoes`,
    `TOP_MODULOS: ${resumirListaTexto(modulos.map((modulo) => modulo.modulo), 3)}`,
    `TOP_RISCOS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.riscosPrincipais)), 3)}`,
    `TOP_LACUNAS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.lacunas)), 3)}`,
    `GERADO_EM: ${geradoEm}`,
    "",
  ].join("\n");
  const curto = [
    `PROJETO: ${path.basename(baseProjeto)}`,
    `BASE: ${baseProjeto}`,
    `MODULOS: ${modulos.length}`,
    `MODO_CODIGO: ${modoVerificacaoCodigo}`,
    `RESULTADO_DRIFT: ${resultadoDrift ? (resultadoDrift.sucesso ? "sucesso" : "falha") : "não avaliado"}`,
    ...(modoVerificacaoCodigo === "contratos_apenas"
      ? ["AVISO_CODIGO: somente contratos enviados; implementacao nao verificada neste modo"]
      : modoVerificacaoCodigo === "codigo_selecionado"
        ? ["AVISO_CODIGO: codigo selecionado enviado; conclusoes valem apenas para o snapshot"]
        : []),
    `FONTES_CONCLUSAO: ${resumirListaTexto(fontesConclusao, 6)}`,
    `ENTRADA_IA: ${entradaCanonica.porCapacidade.media.join(" -> ")}`,
    `POLITICA_PLATAFORMA: ${agentContextPack.politicaPlataforma.regra} ${agentContextPack.politicaPlataforma.quandoHouverBloqueio}`,
    `TIMEOUT_SEMA: ${agentContextPack.politicaTimeoutResumo.regra} Escale ${agentContextPack.politicaTimeoutResumo.escalonamentoSegundos.map((segundos) => `${segundos}s`).join(" -> ")} antes de declarar bloqueio.`,
    `CODIGO_GOVERNADO: ${agentContextPack.politicaCodigoGovernado.marcador} -> docs-impacto e drift antes de alterar comportamento`,
    `ORCAMENTO_SEMANTICO: codigo governado acima de ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO} linhas exige refatoracao e acima de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO} bloqueia; .sema acima de ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} diagnostica e acima de ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA} bloqueia criacao, edicao, drift, geracao e snapshot; varios .sema podem governar o mesmo arquivo via vinculos`,
    `PAYLOAD_INLINE: conteudo inline acima de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres deve virar arquivos logicos, anexo, caminho de servidor autorizado ou manifesto; nao aumente timeout para empurrar o mesmo payload`,
    `DESIGN_VISUAL: ${agentContextPack.politicaDesignVisual.regra} Fraca=${agentContextPack.politicaDesignVisual.porCapacidade.fraca} Media=${agentContextPack.politicaDesignVisual.porCapacidade.media} Forte=${agentContextPack.politicaDesignVisual.porCapacidade.forte}`,
    `TOP_MODULOS: ${resumirListaTexto(modulos.map((modulo) => modulo.modulo), 6)}`,
    `TOP_RISCOS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.riscosPrincipais)), 6)}`,
    `TOP_LACUNAS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.lacunas)), 6)}`,
    `TOP_ARQUIVOS: ${resumirListaTexto(topArquivosResumo.arquivos, 6)}`,
    `TOP_ARQUIVOS_FONTE: ${topArquivosResumo.fonte}`,
    `GERADO_EM: ${geradoEm}`,
    "",
  ].join("\n");

  const artefatosResumo = [
    { caminhoRelativo: "SEMA_BRIEF.md", conteudo: semaBrief },
    { caminhoRelativo: ARQUIVO_SEMA_BOOT, conteudo: semaBoot },
    { caminhoRelativo: ARQUIVO_SEMA_SMALL_MODEL, conteudo: semaSmallModel },
    { caminhoRelativo: "SEMA_BRIEF.micro.txt", conteudo: micro },
    { caminhoRelativo: "SEMA_BRIEF.curto.txt", conteudo: curto },
    { caminhoRelativo: "SEMA_INDEX.json", conteudo: `${JSON.stringify(indexJson, null, 2)}\n` },
    { caminhoRelativo: ARQUIVO_AGENT_CONTEXT_PACK, conteudo: `${JSON.stringify(agentContextPack, null, 2)}\n` },
    { caminhoRelativo: ARQUIVO_DOC_AGENTES_CAPACIDADE, conteudo: docAgentesCapacidade },
  ];
  await validarDestinosEscritaWorkspace(
    pastaSaida,
    artefatosResumo.map((artefato) => artefato.caminhoRelativo),
  );
  for (const artefato of artefatosResumo) {
    await escreverArquivoWorkspaceSeguro(
      pastaSaida,
      artefato.caminhoRelativo,
      artefato.conteudo,
      { sobrescrever: true },
    );
  }

  return {
    geradoEm,
    baseProjeto,
    pastaSaida,
    modoVerificacaoCodigo,
    artefatos: [...ARQUIVOS_RESUMO_PROJETO_IA],
    modulos,
    guiaPorCapacidade,
    analiseDrift: indexJson.analiseDrift,
  };
}

export async function gerarContextoIa(arquivoEntrada: string, pastaSaidaOpcional?: string): Promise<ContextoIaGerado> {
  const contexto = await carregarContextoModuloIa(arquivoEntrada);
  const pastaBase = pastaSaidaOpcional
    ? path.resolve(pastaSaidaOpcional)
    : path.resolve(process.cwd(), ".tmp", "contexto-ia", path.basename(contexto.arquivo, ".sema"));

  await mkdir(pastaBase, { recursive: true });

  const artefatosContexto = [
    { caminhoRelativo: "validar.json", conteudo: `${JSON.stringify(contexto.validar, null, 2)}\n` },
    { caminhoRelativo: "diagnosticos.json", conteudo: `${JSON.stringify(contexto.diagnosticosJson, null, 2)}\n` },
    { caminhoRelativo: "ast.json", conteudo: `${JSON.stringify(contexto.ast, null, 2)}\n` },
    { caminhoRelativo: "ir.json", conteudo: `${JSON.stringify(contexto.irJson, null, 2)}\n` },
    { caminhoRelativo: "drift.json", conteudo: `${JSON.stringify(contexto.drift, null, 2)}\n` },
    { caminhoRelativo: "briefing.json", conteudo: `${JSON.stringify(contexto.briefing, null, 2)}\n` },
  ];
  await validarDestinosEscritaWorkspace(
    pastaBase,
    [
      ...artefatosContexto.map((artefato) => artefato.caminhoRelativo),
      ...ARQUIVOS_RESUMO_MODULO_IA,
      "README.md",
    ],
  );
  for (const artefato of artefatosContexto) {
    await escreverArquivoWorkspaceSeguro(
      pastaBase,
      artefato.caminhoRelativo,
      artefato.conteudo,
      { sobrescrever: true },
    );
  }
  const resumoGerado = await gerarArquivosResumoModuloIa(contexto, pastaBase);

  const resumo = `# Contexto de IA para ${contexto.modulo}

- Arquivo alvo: \`${contexto.arquivo}\`
- Modulo: \`${contexto.modulo}\`
- Sucesso em validar: \`${contexto.sucesso}\`
- Quantidade de diagnosticos: \`${contexto.diagnosticos.length}\`
- Gerado em: \`${contexto.geradoEm}\`

## Arquivos gerados neste pacote

- \`agent-context-pack.json\`
- \`${ARQUIVO_SEMA_BOOT}\`
- \`${ARQUIVO_SEMA_SMALL_MODEL}\`
- \`resumo.micro.txt\`
- \`resumo.curto.txt\`
- \`resumo.md\`
- \`briefing.min.json\`
- \`prompt-curto.txt\`
- \`validar.json\`
- \`diagnosticos.json\`
- \`ast.json\`
- \`ir.json\`
- \`drift.json\`
- \`briefing.json\`

## Fluxo recomendado para o agente

Antes de escolher arquivo de código, leia \`${ARQUIVO_SEMA_BOOT}\` e \`agent-context-pack.json\`. Eles declaram regras obrigatórias, proibições, prioridades, idioma humano e quando abrir texto bruto como \`AGENTS.md\`, \`exemplos/\`, docs e contratos.

## Políticas da plataforma

- Sema governa contrato, escopo, drift, evidência e qualidade; não contorna políticas, termos, permissões, segurança ou leis.
- Se houver alerta externo, trate como bloqueio da plataforma ou falso positivo possível, explique de forma neutra e não tente burlar filtro.

### IA fraca, gratuita ou com pouca disciplina

1. Ler \`${ARQUIVO_SEMA_BOOT}\`.
2. Ler \`${ARQUIVO_SEMA_SMALL_MODEL}\`.
3. Ler \`agent-context-pack.json\`.
4. Ler \`resumo.micro.txt\`.
5. Ler \`briefing.min.json\`.
6. Se ainda couber contexto, ler \`resumo.curto.txt\`.

### IA média

1. Ler \`${ARQUIVO_SEMA_BOOT}\`.
2. Ler \`agent-context-pack.json\`.
3. Ler \`resumo.curto.txt\`.
4. Ler \`briefing.min.json\`.
5. Ler \`drift.json\`.
6. Se precisar, subir para \`resumo.md\`.

### IA forte ou com tool use

1. Ler \`${ARQUIVO_SEMA_BOOT}\`.
2. Ler \`agent-context-pack.json\`.
3. Ler \`README.md\`.
4. Ler \`resumo.md\`.
5. Ler \`briefing.json\`.
6. Ler \`drift.json\`.
7. Só depois abrir \`ir.json\` e \`ast.json\`.

## Idioma humano

- Responda no idioma do usuário.
- Em PT-BR, use acentos, cedilha, pontuação e símbolos normais.
- A DSL \`.sema\` pode ser ASCII; texto humano não precisa ser.

## Texto bruto sob demanda

- Abra \`AGENTS.md\` antes de editar código, contrato, docs operacionais, release ou deploy.
- Abra \`exemplos/\` antes de criar ou corrigir sintaxe \`.sema\`.
- Abra \`docs/syntax.md\` quando exemplos não bastarem para resolver a gramática.
- Abra \`contratos/\` antes de qualquer implementação ou mudança de comportamento.

## Timeout e retry

- Timeout local do agente não é falha do Sema.
- Se uma chamada Sema estourar, aumente o timeout e tente de novo.
- Se o projeto inteiro for lento, escopar para \`sema resumo "${contexto.arquivo}" --micro --para mudanca --drift none\`.
- Se o ambiente impedir continuar, pare bloqueado e não avance com código sem Sema.

## Fechamento

1. Editar o arquivo \`.sema\`.
2. Rodar \`sema formatar "${contexto.arquivo}"\`.
3. Rodar \`sema validar "${contexto.arquivo}" --json\`.
4. Rodar \`sema drift "${contexto.arquivo}" --cache fresh --json\`.
5. Fechar com \`sema verificar <arquivo-ou-pasta> --json --saida ./.tmp/verificacao-ia\`.

## Textos base para onboarding do agente

- \`sema starter-ia\`
- \`sema resumo "${contexto.arquivo}" --micro --para onboarding --drift none\`
- \`sema prompt-curto "${contexto.arquivo}" --para mudanca\`
- \`sema prompt-ia\`
`;

  await escreverArquivoWorkspaceSeguro(pastaBase, "README.md", resumo, {
    sobrescrever: true,
  });

  return {
    sucesso: contexto.sucesso,
    arquivo: contexto.arquivo,
    modulo: contexto.modulo,
    pastaSaida: pastaBase,
    artefatos: [
      "validar.json",
      "diagnosticos.json",
      "ast.json",
      "ir.json",
      "drift.json",
      "briefing.json",
      "README.md",
      ...resumoGerado.artefatosCompactos,
    ],
    artefatosCompactos: resumoGerado.artefatosCompactos,
    geradoEm: contexto.geradoEm,
    guiaPorCapacidade: resumoGerado.guiaPorCapacidade,
  };
}

export function resolverEntradaDocs(posicionais: string[], args: string[]): { intencao: string; arquivosAlvo: string[] } {
  const intencao = obterOpcao(args, "--intencao") ?? posicionais[0] ?? "";
  const arquivosPorFlag = obterOpcoesRepetidas(args, "--arquivo");
  const arquivosPosicionais = obterOpcao(args, "--intencao") ? posicionais : posicionais.slice(1);
  return {
    intencao,
    arquivosAlvo: [...new Set([...arquivosPorFlag, ...arquivosPosicionais])],
  };
}

export async function comandoDocsImpacto(posicionais: string[], args: string[], emJson: boolean): Promise<number> {
  const { intencao, arquivosAlvo } = resolverEntradaDocs(posicionais, args);
  if (!intencao.trim()) {
    console.error("Uso: sema docs-impacto --intencao <acao> [--arquivo <caminho>] [--criar-ausentes] [--completo] [--json]");
    return 1;
  }

  const resultado = await resolverDocumentacaoObrigatoria({
    baseProjeto: process.cwd(),
    intencao,
    arquivosAlvo,
    criarAusentes: possuiFlag(args, "--criar-ausentes"),
  });
  const completo = possuiFlag(args, "--completo");

  const payload = {
    comando: "docs-impacto",
    ...(completo ? resultado : {
      ...resultado,
      leituraObrigatoria: resultado.leituraObrigatoria.map(compactarDocumentoObrigatorio),
      docsAusentes: resultado.docsAusentes.map(compactarDocumentoObrigatorio),
      docsCriadas: resultado.docsCriadas.map(compactarDocumentoObrigatorio),
      modoDocumentos: "compacto",
    }),
  };

  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return resultado.sucesso ? 0 : 1;
  }

  console.log("Documentacao obrigatoria da mudanca");
  console.log(`- Intencao: ${resultado.intencao}`);
  console.log(`- Categorias: ${resumirListaTexto(resultado.categorias, 8)}`);
  console.log(`- Leitura obrigatoria: ${resultado.leituraObrigatoria.length}`);
  for (const doc of resultado.leituraObrigatoria) {
    console.log(`  - ${doc.relativo} (${doc.existe ? "ok" : "ausente"}) - ${doc.motivo}`);
  }
  if (resultado.docsCriadas.length > 0) {
    console.log(`- Docs criadas: ${resultado.docsCriadas.map((doc) => doc.relativo).join(", ")}`);
  }
  if (resultado.bloqueios.length > 0) {
    console.error("Bloqueios:");
    for (const bloqueio of resultado.bloqueios) {
      console.error(`- [SEM DOC ${bloqueio.severidade}] ${bloqueio.mensagem}`);
    }
  }

  return resultado.sucesso ? 0 : 1;
}

export async function comandoFinalizarMudanca(posicionais: string[], args: string[], emJson: boolean): Promise<number> {
  const { intencao, arquivosAlvo } = resolverEntradaDocs(posicionais, args);
  if (!intencao.trim()) {
    console.error("Uso: sema finalizar-mudanca --intencao <acao> [--arquivo <caminho>] [--doc-lida <caminho>] [--json]");
    return 1;
  }

  const resultado = await verificarDocumentacaoMudanca({
    baseProjeto: process.cwd(),
    intencao,
    arquivosAlvo,
    docsLidas: obterOpcoesRepetidas(args, "--doc-lida"),
  });

  const payload = {
    comando: "finalizar-mudanca",
    ...resultado,
  };

  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return resultado.sucesso ? 0 : 1;
  }

  if (resultado.sucesso) {
    console.log("Leitura documental comprovada para a mudanca.");
    return 0;
  }

  console.error("Mudanca bloqueada por documentacao obrigatoria:");
  for (const diagnostico of resultado.diagnosticos) {
    console.error(`- [severidade ${diagnostico.severidade}] ${diagnostico.mensagem}`);
  }
  return 1;
}

export async function comandoValidar(entrada?: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  console.log(formatarDiagnosticos(diagnosticos));
  return temErros(diagnosticos) ? 1 : 0;
}

export async function comandoValidarJson(entrada?: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  const resultado = gerarRespostaValidacao(diagnosticos);
  console.log(JSON.stringify(resultado, null, 2));
  return resultado.valido ? 0 : 1;
}

