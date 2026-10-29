import { executarDocumentacaoMudanca } from "./changeCommands.js";
import { lerPerfilContexto } from "./contextBudget.js";
import { selecionarContextoAtivo, arquivarResumosLegados, ARQUIVOS_CONTEXTO_PROJETO } from "./contextDelivery.js";
// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.escrita_segura_workspace, sema.produto.governanca_ia.drift.cache.modos
// Descrição: gera contexto local e grava artefatos somente dentro da base validada.

import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { diagnosticarEntradaContratos } from "./entradaContratos.js";
import { arquivosProtocoloDesatualizados } from "./agentProtocol.js";
import { createHash } from "node:crypto";
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
  ...ARQUIVOS_CONTEXTO_PROJETO,
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

async function calcularHashContratos(caminhosContratos: string[], baseProjeto?: string): Promise<string> {
  const hash = createHash("sha256");
  const base = baseProjeto ?? (caminhosContratos[0] ? path.dirname(caminhosContratos[0]) : process.cwd());
  const ordenados = [...caminhosContratos].sort();
  for (const caminho of ordenados) {
    const conteudo = await readFile(caminho, "utf8").catch(() => "");
    const relativo = path.relative(base, caminho).replace(/[\\/]/g, "/");
    hash.update(relativo);
    hash.update(":");
    hash.update(conteudo);
    hash.update(String.fromCharCode(0));
  }
  return hash.digest("hex").slice(0, 16);
}

export async function verificarFrescorArtefatos(baseProjeto: string): Promise<{
  fresco: boolean;
  hashArtefato: string | null;
  hashAtual: string;
  contratosMudaram: boolean;
  protocoloAtualizado: boolean;
  arquivosProtocoloDesatualizados: string[];
  sugestao: string;
}> {
  const caminhoIndex = path.join(baseProjeto, "SEMA_INDEX.json");
  let hashArtefato: string | null = null;
  let perfilArtefato: unknown = undefined;
  try {
    const index = JSON.parse(await readFile(caminhoIndex, "utf8")) as { hashContratos?: string; perfilContexto?: unknown };
    perfilArtefato = index.perfilContexto;
    hashArtefato = index.hashContratos ?? null;
  } catch {
    hashArtefato = null;
  }

  const origens = await (await import("./projetoOrigens.js")).resolverOrigensProjeto(baseProjeto, baseProjeto, undefined);
  const { listarArquivosDeOrigens } = await import("./projetoOrigens.js");
  const contratos = await listarArquivosDeOrigens(origens);
  const hashAtual = await calcularHashContratos(contratos, baseProjeto);

  const protocoloPendente = await arquivosProtocoloDesatualizados(baseProjeto);
  const contratosMudaram = hashArtefato !== hashAtual;
  const perfilMudou = perfilArtefato !== undefined && JSON.stringify(perfilArtefato) !== JSON.stringify(await lerPerfilContexto(baseProjeto) ?? null);
  if (perfilMudou) protocoloPendente.push(".sema/contexto-ia.json");
  const fresco = !contratosMudaram && protocoloPendente.length === 0;
  return {
    fresco,
    hashArtefato,
    hashAtual,
    contratosMudaram,
    protocoloAtualizado: protocoloPendente.length === 0,
    arquivosProtocoloDesatualizados: protocoloPendente,
    sugestao: fresco ? "" : "Índice ou protocolo de entrada desatualizado; rode sema sync-codex --json para atualizar o bloco gerenciado e preservar as regras manuais.",
  };
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
  const executarDrift = analiseDrift.executar && contextoProjeto.modulosSelecionados.length > 0;
  const geradoEm = new Date().toISOString();
  const guiaPorCapacidade = criarGuiaCapacidadeIa();
  const entradaCanonica = criarEntradaCanonicaProjeto(guiaPorCapacidade);
  const agentContextPack = entradaCanonica.agentContextPack;
  const modoVerificacaoCodigo = executarDrift
    ? await detectarModoVerificacaoCodigo(
      contextoProjeto.baseProjeto,
      contextoProjeto.diretoriosCodigo,
    )
    : "contratos_apenas";
  const fontesConclusao = executarDrift
    ? await detectarFontesConclusaoSnapshot(contextoProjeto.baseProjeto)
    : contextoProjeto.modulosSelecionados.length > 0 ? ["contrato"] : [];
  const resultadoDrift = executarDrift
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
        executada: executarDrift,
        sucesso: resultadoDrift?.sucesso ?? null,
        aviso: executarDrift
          ? null
          : "Análise de drift não executada; implementação, vínculos e rotas não foram verificados.",
        resumo: driftResumo,
        drift: resultadoDrift,
      },
      modoVerificacaoCodigo,
      fontesConclusao,
    });
  });
  const arquivosCodigoDetectados = executarDrift && modoVerificacaoCodigo === "codigo_completo"
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

  const semaBoot = renderizarSemaBoot(agentContextPack);
  const docAgentesCapacidade = renderizarDocumentoAgentesPorCapacidade(agentContextPack);
  const caminhosContratos = contextoProjeto.modulosSelecionados.map((item) => item.caminho);
  const hashContratos = await calcularHashContratos(caminhosContratos, contextoProjeto.baseProjeto);
  const indexJson = {
    comando: "resumo-projeto",
    geradoEm,
    cliVersao: VERSAO_CLI,
    perfilContexto: await lerPerfilContexto(baseProjeto) ?? null,
    hashContratos,
    baseProjeto,
    modoVerificacaoCodigo,
    analiseDrift: {
      modo: analiseDrift.modo,
      executada: executarDrift,
      sucesso: resultadoDrift?.sucesso ?? null,
      aviso: executarDrift
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

  const descreverModulo = (modulo: ResumoSemanticoModuloIa) => `${modulo.modulo}: ${modulo.faz}\nContrato: ${modulo.arquivo}`;
  const selecionado = await selecionarContextoAtivo(baseProjeto, {
    micro,
    curto: micro + "\nCONTRATOS (até 6):\n" + modulos.slice(0, 6).map(descreverModulo).join("\n"),
    medio: micro + "\nCONTRATOS:\n" + modulos.map(descreverModulo).join("\n"),
  });
  Object.assign(indexJson, { contextoSelecionado: selecionado ? { arquivo: selecionado.caminhoRelativo, nivel: selecionado.nivel } : null });
  const artefatosResumo = [
    ...(selecionado ? [selecionado] : []),
    { caminhoRelativo: ARQUIVO_SEMA_BOOT, conteudo: semaBoot },
    { caminhoRelativo: "SEMA_INDEX.json", conteudo: `${JSON.stringify(indexJson, null, 2)}\n` },
    { caminhoRelativo: ARQUIVO_AGENT_CONTEXT_PACK, conteudo: `${JSON.stringify(agentContextPack, null, 2)}\n` },
    { caminhoRelativo: ARQUIVO_DOC_AGENTES_CAPACIDADE, conteudo: docAgentesCapacidade },
  ];
  await validarDestinosEscritaWorkspace(
    pastaSaida,
    artefatosResumo.map((artefato) => artefato.caminhoRelativo),
  );
  await arquivarResumosLegados(pastaSaida);
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
    artefatos: artefatosResumo.map(item => item.caminhoRelativo),
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

  await validarDestinosEscritaWorkspace(pastaBase, [...ARQUIVOS_RESUMO_MODULO_IA, "README.md"]);
  const resumoGerado = await gerarArquivosResumoModuloIa(contexto, pastaBase);

  const resumo = `# Contexto de IA para ${contexto.modulo}

Contrato: ${contexto.arquivo}. Validação: ${contexto.sucesso}.
Resumo selecionado: ${resumoGerado.artefatosCompactos.join(", ") || "nenhum: configure o perfil ou refine o orçamento"}. Consulte-o somente se a sessão ainda não entregou o contexto necessário.
Para evidências específicas, consulte validar, diagnosticos, drift --pacote, ast ou ir pela CLI. Não carregue todos os resultados de uma vez.
Use sema sessao com intenção e --arquivo para obter o recorte da tarefa.
Preserve os gates do AGENTS.md e SEMA_BOOT.md do projeto, sem relê-los quando já estiverem no contexto.
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
  return executarDocumentacaoMudanca("docs-impacto", posicionais, args, emJson);
}

export async function comandoFinalizarMudanca(posicionais: string[], args: string[], emJson: boolean): Promise<number> {
  return executarDocumentacaoMudanca("finalizar-mudanca", posicionais, args, emJson);
}

export async function comandoValidar(entrada?: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = [...diagnosticarEntradaContratos(modulos.map((item) => item.caminho)),
    ...modulos.flatMap((item) => item.resultado.diagnosticos)];
  console.log(formatarDiagnosticos(diagnosticos));
  return temErros(diagnosticos) ? 1 : 0;
}

export async function comandoValidarJson(entrada?: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = [...diagnosticarEntradaContratos(modulos.map((item) => item.caminho)),
    ...modulos.flatMap((item) => item.resultado.diagnosticos)];
  const resultado = gerarRespostaValidacao(diagnosticos);
  console.log(JSON.stringify(resultado, null, 2));
  return resultado.valido ? 0 : 1;
}

