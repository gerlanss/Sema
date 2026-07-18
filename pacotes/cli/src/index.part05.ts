// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
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
  resolverDocumentacaoObrigatoria,
  verificarDocumentacaoMudanca,
} from "./docs.js";
import {
  avaliarOrcamentoArquivo,
  LIMITE_AVISO_LINHAS_ORCAMENTO_SEMANTICO,
  LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO,
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
import { criarAgentContextPack, criarGuiaCapacidadeIa } from './agentContextPack.js';
import { criarEntradaCanonicaProjeto } from './agentContext.js';
import {
  renderizarDocumentoAgentesPorCapacidade,
  renderizarSemaBoot,
  renderizarSemaSmallModel,
  sincronizarEntrypointCodex,
} from './agentEntryPoints.js';
import {
  escreverArquivos,
  caminhoExiste,
  formatarAvisoArtefatosGeradosAcimaDoLimite,
} from './fsGovernado.js';
import { localizarDiretorioExemplosOficiais, materializarExemplosOficiais } from './exemplosOficiais.js';
import { comandoIniciar, comandoInstalarExemplos } from './initCommand.js';
import type { TemplateIniciar } from './initTemplatesBase.js';
import { carregarModulos } from './carregarModulos.js';
import { obterOpcao, obterOpcoesRepetidas, obterPosicionais, possuiFlag } from './cliArgs.js';
import { limitarLista, resumirListaTexto, unicosOrdenados } from './textoListas.js';
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
import { resumirDriftPorModulo } from "./index.part03.js";
import { resolverOpcoesDriftCli } from "./index.part01.js";
export async function comandoInspecionar(entrada: string | undefined, emJson: boolean, cwd = process.cwd()): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const resultadoDrift = await analisarDriftLegado(contextoProjeto);
  const framework = resolverFrameworkPadrao(undefined, contextoProjeto.configCarregada);
  const estruturaSaida = resolverEstruturaSaidaPadrao(undefined, framework, contextoProjeto.configCarregada);
  const alvos = resolverAlvosVerificacao(contextoProjeto.configCarregada);
  const saidas = Object.fromEntries(alvos.map((alvo) => [alvo, resolverSaidaPadrao(undefined, alvo, contextoProjeto.configCarregada)]));
  const payload = {
    comando: "inspecionar",
    entrada: contextoProjeto.entradaResolvida,
    configuracao: {
      caminho: contextoProjeto.configCarregada?.caminho ?? null,
      baseProjeto: contextoProjeto.baseProjeto,
      framework,
      estruturaSaida,
      alvos,
      saidas,
      origens: contextoProjeto.origensProjeto,
      diretoriosCodigo: contextoProjeto.diretoriosCodigo,
      fontesLegado: contextoProjeto.fontesLegado,
      modoAdocao: contextoProjeto.modoAdocao,
      scoreDrift: resultadoDrift.resumo_operacional.scoreMedio,
      confiancaGeral: resultadoDrift.resumo_operacional.confiancaGeral,
      consumerFramework: resultadoDrift.consumerFramework,
      appRoutes: resultadoDrift.appRoutes,
      consumerSurfaces: resultadoDrift.consumerSurfaces,
      consumerBridges: resultadoDrift.consumerBridges,
    },
    projeto: {
      arquivos: contextoProjeto.arquivosProjeto,
      modulos: contextoProjeto.modulosSelecionados.map((item) => ({
        caminho: item.caminho,
        modulo: item.resultado.modulo?.nome ?? null,
        sucesso: !temErros(item.resultado.diagnosticos),
        diagnosticos: item.resultado.diagnosticos.length,
        superficies: item.resultado.ir?.superficies.map((superficie) => `${superficie.tipo}:${superficie.nome}`) ?? [],
        implementacao: resumirDriftPorModulo(item.resultado.modulo?.nome ?? null, item.caminho, resultadoDrift),
      })),
    },
  };
  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }
  console.log("Inspecao de projeto Sema");
  console.log(`- Entrada: ${payload.entrada}`);
  console.log(`- Configuracao: ${payload.configuracao.caminho ?? "nenhuma"}`);
  console.log(`- Base do projeto: ${payload.configuracao.baseProjeto}`);
  console.log(`- Framework: ${payload.configuracao.framework}`);
  console.log(`- Estrutura de saida: ${payload.configuracao.estruturaSaida}`);
  console.log(`- Alvos: ${payload.configuracao.alvos.join(", ")}`);
  console.log(`- Modo de adocao: ${payload.configuracao.modoAdocao}`);
  console.log(`- Score medio de drift: ${payload.configuracao.scoreDrift}`);
  console.log(`- Confianca geral: ${payload.configuracao.confiancaGeral}`);
  console.log("- Saidas por alvo:");
  for (const [alvo, saida] of Object.entries(payload.configuracao.saidas)) {
    console.log(`  - ${alvo}: ${saida}`);
  }
  console.log("- Origens do projeto:");
  for (const origem of payload.configuracao.origens) {
    console.log(`  - ${origem}`);
  }
  console.log("- Diretorios de codigo:");
  for (const diretorio of payload.configuracao.diretoriosCodigo) {
    console.log(`  - ${diretorio}`);
  }
  console.log(`- Fontes de legado detectadas: ${payload.configuracao.fontesLegado.join(", ") || "nenhuma"}`);
  console.log("- Modulos selecionados:");
  for (const modulo of payload.projeto.modulos) {
    console.log(`  - ${modulo.modulo ?? "(sem modulo)"} :: ${modulo.caminho} :: diagnosticos=${modulo.diagnosticos}`);
    console.log(`    impls validos=${modulo.implementacao.implsValidos} quebrados=${modulo.implementacao.implsQuebrados} recursos divergentes=${modulo.implementacao.recursosDivergentesCount} sem_impl=${modulo.implementacao.tasksSemImplementacao}`);
    for (const arquivoRelacionado of modulo.implementacao.arquivosRelacionados.slice(0, 5)) {
      console.log(`    arquivo relacionado: ${arquivoRelacionado}`);
    }
  }
  return 0;
}
export async function comandoDrift(entrada: string | undefined, args: string[], emJson: boolean, cwd = process.cwd()): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const resultado = await analisarDriftLegado(contextoProjeto, resolverOpcoesDriftCli(args));
  if (emJson) {
    console.log(JSON.stringify(resultado, null, 2));
    return resultado.sucesso ? 0 : 1;
  }
  console.log("Drift entre Sema e codigo legado");
  console.log(`- Escopo aplicado: ${resultado.escopo_aplicado.escopo}`);
  console.log(`- Ignorar worktrees: ${resultado.escopo_aplicado.ignorarWorktrees ? "sim" : "nao"}`);
  console.log(`- Ignorar consumidores laterais: ${resultado.escopo_aplicado.ignorarConsumidoresLaterais ? "sim" : "nao"}`);
  console.log(`- Modulos analisados: ${resultado.modulos.length}`);
  console.log(`- Tasks analisadas: ${resultado.tasks.length}`);
  console.log(`- Impl validos: ${resultado.impls_validos.length}`);
  console.log(`- Impl quebrados: ${resultado.impls_quebrados.length}`);
  console.log(`- Vinculos validos: ${resultado.vinculos_validos.length}`);
  console.log(`- Vinculos quebrados: ${resultado.vinculos_quebrados.length}`);
  console.log(`- Rotas divergentes: ${resultado.rotas_divergentes.length}`);
  console.log(`- Recursos vivos validos: ${resultado.recursos_validos.length}`);
  console.log(`- Recursos vivos divergentes: ${resultado.recursos_divergentes.length}`);
  console.log(`- Persistencia real mapeada: ${resultado.persistencia_real.length}`);
  console.log(`- Score medio: ${resultado.resumo_operacional.scoreMedio}`);
  console.log(`- Confianca geral: ${resultado.resumo_operacional.confiancaGeral}`);
  if (resultado.impls_quebrados.length > 0) {
    console.log("- Impl quebrados:");
    for (const impl of resultado.impls_quebrados) {
      console.log(`  - ${impl.modulo}.${impl.task} :: ${impl.origem}:${impl.caminho}`);
      if (impl.candidatos && impl.candidatos.length > 0) {
        console.log("    candidatos provaveis:");
        for (const candidato of impl.candidatos) {
          console.log(`      - [${candidato.confianca}] ${candidato.caminho} :: ${candidato.arquivo} :: ${candidato.simbolo}`);
        }
      }
    }
  }
  if (resultado.rotas_divergentes.length > 0) {
    console.log("- Rotas divergentes:");
    for (const rota of resultado.rotas_divergentes) {
      console.log(`  - ${rota.modulo}.${rota.route} :: ${rota.metodo ?? "?"} ${rota.caminho ?? "?"}`);
    }
  }
  if (resultado.recursos_divergentes.length > 0) {
    console.log("- Recursos divergentes:");
    for (const recurso of resultado.recursos_divergentes) {
      console.log(`  - ${recurso.modulo}.${recurso.task} :: ${recurso.categoria} ${recurso.alvo}`);
    }
  }
  const persistenciaDivergente = resultado.persistencia_real.filter((item) => item.status !== "materializado");
  if (persistenciaDivergente.length > 0) {
    console.log("- Persistencia que pede revisao:");
    for (const item of persistenciaDivergente.slice(0, 8)) {
      console.log(`  - ${item.modulo}.${item.task} :: ${item.alvo} :: ${item.status} :: categoria=${item.categoriaPersistencia} :: compat=${item.compatibilidade}`);
    }
  }
  const semImpl = resultado.tasks.filter((task) => task.semImplementacao);
  if (semImpl.length > 0) {
    console.log("- Tasks sem implementacao vinculada:");
    for (const task of semImpl) {
      console.log(`  - ${task.modulo}.${task.task}`);
      if (task.candidatosImpl.length > 0) {
        console.log("    candidatos provaveis:");
        for (const candidato of task.candidatosImpl) {
          console.log(`      - [${candidato.confianca}] ${candidato.caminho} :: ${candidato.arquivo} :: ${candidato.simbolo}`);
        }
      }
    }
  }
  if (resultado.vinculos_quebrados.length > 0) {
    console.log("- Vinculos quebrados:");
    for (const vinculo of resultado.vinculos_quebrados) {
      console.log(`  - ${vinculo.modulo}.${vinculo.dono} :: ${vinculo.tipo}=${vinculo.valor}`);
    }
  }
  if (resultado.resumo_operacional.oQueTocar.length > 0) {
    console.log("- O que tocar primeiro:");
    for (const alvo of resultado.resumo_operacional.oQueTocar.slice(0, 8)) {
      console.log(`  - ${alvo}`);
    }
  }
  if (resultado.resumo_operacional.oQueValidar.length > 0) {
    console.log("- O que validar:");
    for (const check of resultado.resumo_operacional.oQueValidar.slice(0, 8)) {
      console.log(`  - ${check}`);
    }
  }
  if (resultado.diagnosticos.length === 0) {
    console.log("Nenhum drift relevante encontrado.");
  }
  return resultado.sucesso ? 0 : 1;
}
export async function comandoImpacto(
  entrada: string | undefined,
  args: string[],
  emJson: boolean,
  cwd = process.cwd(),
): Promise<number> {
  const alvoSemantico = obterOpcao(args, "--alvo");
  if (!alvoSemantico) {
    console.error("Uso: sema impacto <arquivo-ou-pasta> --alvo <token-semântico> [--mudanca <descricao>] [--escopo <arquivo|modulo|projeto>] [--incluir-worktrees] [--incluir-consumidores-laterais] [--json]");
    return 1;
  }
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const resultado = await gerarMapaImpactoSemantico(
    contextoProjeto,
    alvoSemantico,
    obterOpcao(args, "--mudanca", `avaliar impacto de ${alvoSemantico}`)!,
    resolverOpcoesDriftCli(args),
  );
  if (emJson) {
    console.log(JSON.stringify(resultado, null, 2));
    return resultado.sucesso ? 0 : 1;
  }
  console.log("Impact map semantico");
  console.log(`- Escopo: ${resultado.escopo}`);
  console.log(`- Alvo: ${resultado.alvoSemantico}`);
  console.log(`- Mudanca: ${resultado.mudancaProposta}`);
  console.log(`- Arquivos impactados: ${resultado.arquivos.length}`);
  console.log(`- Tasks afetadas: ${resultado.tasksAfetadas.length}`);
  console.log(`- Rotas afetadas: ${resultado.routesAfetadas.length}`);
  console.log(`- Superficies afetadas: ${resultado.superficiesAfetadas.length}`);
  console.log(`- Persistencia afetada: ${resultado.persistenciaAfetada.length}`);
  if (resultado.arquivos.length > 0) {
    console.log("- Arquivos prioritarios:");
    for (const arquivo of resultado.arquivos.slice(0, 10)) {
      console.log(`  - [${arquivo.prioridade}] ${arquivo.tipo} :: ${arquivo.arquivo}`);
    }
  }
  console.log("- Ordem operacional:");
  for (const passo of resultado.ordemOperacional) {
    console.log(`  - ${passo}`);
  }
  return resultado.sucesso ? 0 : 1;
}
export async function comandoRenomearSemantico(
  entrada: string | undefined,
  args: string[],
  emJson: boolean,
  cwd = process.cwd(),
): Promise<number> {
  const nomeAtual = obterOpcao(args, "--de");
  const nomeNovo = obterOpcao(args, "--para");
  if (!nomeAtual || !nomeNovo) {
    console.error("Uso: sema renomear-semantico <arquivo-ou-pasta> --de <nome-atual> --para <nome-novo> [--escopo <arquivo|modulo|projeto>] [--incluir-worktrees] [--incluir-consumidores-laterais] [--json]");
    return 1;
  }
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const resultado = await assistirRenomeacaoSemantica(
    contextoProjeto,
    nomeAtual,
    nomeNovo,
    resolverOpcoesDriftCli(args),
  );
  if (emJson) {
    console.log(JSON.stringify(resultado, null, 2));
    return resultado.sucesso ? 0 : 1;
  }
  console.log("Renomeacao semantica assistida");
  console.log(`- Escopo: ${resultado.escopo}`);
  console.log(`- De: ${resultado.de}`);
  console.log(`- Para: ${resultado.para}`);
  console.log(`- Arquivos afetados: ${resultado.arquivos.length}`);
  console.log(`- Sugestoes: ${resultado.sugestoes.length}`);
  if (resultado.sugestoes.length > 0) {
    console.log("- Primeiras sugestoes:");
    for (const sugestao of resultado.sugestoes.slice(0, 12)) {
      console.log(`  - ${sugestao.arquivo}:${sugestao.linha} :: ${sugestao.atual} -> ${sugestao.sugerido}`);
    }
  }
  console.log("- Ordem operacional:");
  for (const passo of resultado.ordemOperacional) {
    console.log(`  - ${passo}`);
  }
  return resultado.sucesso ? 0 : 1;
}
export async function comandoImportar(
  fonte: FonteImportacao,
  diretorio: string,
  saida: string,
  namespaceBase: string | undefined,
  emJson: boolean,
): Promise<number> {
  const resultado = await importarProjetoLegado(fonte, diretorio, namespaceBase);
  const resumo = resumoImportacao(resultado);
  if (!resumo.sucesso) {
    const payloadErro = {
      comando: "importar",
      fonte,
      diretorio: path.resolve(diretorio),
      namespaceBase: resultado.namespaceBase,
      resumo,
      arquivos: resultado.arquivos.map((arquivo) => ({
        caminho: path.join(path.resolve(saida), arquivo.caminhoRelativo),
        modulo: arquivo.modulo,
        tarefas: arquivo.tarefas,
        rotas: arquivo.rotas,
        entidades: arquivo.entidades,
        enums: arquivo.enums,
      })),
      diagnosticos: resultado.diagnosticos,
    };
    if (emJson) {
      console.log(JSON.stringify(payloadErro, null, 2));
    } else {
      console.error("Falha na importacao assistida. O rascunho gerado ainda nao ficou semanticamente valido.");
      console.error(formatarDiagnosticos(resultado.diagnosticos));
    }
    return 1;
  }
  const escrita = await escreverArquivos(saida, resultado.arquivos.map((arquivo) => ({
    caminhoRelativo: arquivo.caminhoRelativo,
    conteudo: arquivo.conteudo,
  })), { artefatoGerado: true });
  const payload = {
    comando: "importar",
    fonte,
    diretorio: path.resolve(diretorio),
    saida: path.resolve(saida),
    namespaceBase: resultado.namespaceBase,
    resumo,
    arquivos: resultado.arquivos.map((arquivo) => ({
      caminho: path.join(path.resolve(saida), arquivo.caminhoRelativo),
      modulo: arquivo.modulo,
      tarefas: arquivo.tarefas,
      rotas: arquivo.rotas,
      entidades: arquivo.entidades,
      enums: arquivo.enums,
    })),
    artefatosGeradosAcimaDoLimite: escrita.artefatosGeradosAcimaDoLimite,
  };
  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }
  const avisoGerados = formatarAvisoArtefatosGeradosAcimaDoLimite(escrita.artefatosGeradosAcimaDoLimite);
  if (avisoGerados) {
    console.warn(avisoGerados);
  }
  console.log("Importacao assistida para Sema concluida.");
  console.log(`- Fonte: ${fonte}`);
  console.log(`- Diretorio analisado: ${payload.diretorio}`);
  console.log(`- Namespace base: ${payload.namespaceBase}`);
  console.log(`- Saida: ${payload.saida}`);
  console.log(`- Modulos: ${resumo.modulos}`);
  console.log(`- Tarefas: ${resumo.tarefas}`);
  console.log(`- Rotas: ${resumo.rotas}`);
  console.log(`- Entidades: ${resumo.entidades}`);
  console.log(`- Enums: ${resumo.enums}`);
  console.log("- Arquivos gerados:");
  for (const arquivo of payload.arquivos) {
    console.log(`  - ${arquivo.caminho} :: modulo=${arquivo.modulo} tarefas=${arquivo.tarefas} rotas=${arquivo.rotas}`);
  }
  console.log("Ajuste os rascunhos .sema, rode `sema formatar`, `sema validar --json` e depois `sema compilar`.");
  return 0;
}
export async function comandoAst(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify(resultado.modulo ?? null, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}
export async function comandoAstJson(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify({
    comando: "ast",
    caminho: path.resolve(arquivo),
    modulo: resultado.modulo?.nome ?? null,
    sucesso: !temErros(resultado.diagnosticos),
    diagnosticos: resultado.diagnosticos,
    ast: resultado.modulo ?? null,
  }, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}
export async function comandoIr(arquivo: string): Promise<number> {
  if (!arquivo) {
    console.error("Informe o arquivo .sema para gerar a IR.");
    return 1;
  }
  const modulos = await carregarModulos(arquivo);
  const resultado = modulos[0]?.resultado;
  console.log(JSON.stringify(resultado?.ir ?? null, null, 2));
  return resultado && !temErros(resultado.diagnosticos) ? 0 : 1;
}
export async function comandoIrJson(arquivo: string): Promise<number> {
  if (!arquivo) {
    console.log(JSON.stringify({
      comando: "ir",
      caminho: null,
      modulo: null,
      sucesso: false,
      diagnosticos: [{
        codigo: "SEM_CLI_IR_ENTRADA_AUSENTE",
        mensagem: "Informe o arquivo .sema para gerar a IR.",
        severidade: "erro",
      }],
      ir: null,
    }, null, 2));
    return 1;
  }
  const modulos = await carregarModulos(arquivo);
  const item = modulos[0];
  const resultado = item?.resultado;
  console.log(JSON.stringify({
    comando: "ir",
    caminho: item?.caminho ? path.resolve(item.caminho) : path.resolve(arquivo),
    modulo: resultado?.modulo?.nome ?? null,
    sucesso: Boolean(resultado && !temErros(resultado.diagnosticos)),
    diagnosticos: resultado?.diagnosticos ?? [],
    ir: resultado?.ir ?? null,
  }, null, 2));
  return resultado && !temErros(resultado.diagnosticos) ? 0 : 1;
}
