// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.governanca_ia.drift.cache.modos
// Descrição: resume contrato ou projeto com política explícita de análise de drift.

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
  type ArtefatoGeradoAcimaDoLimite,
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

import { ResultadoFormatacaoArquivo, descobrirDocsIa, normalizarModoResumo, normalizarTamanhoResumo, renderizarCabecalhoDocsIa, renderizarCaixaAscii, renderizarSecaoAscii, resolverAnaliseDriftConsultaCli } from "./index.part01.js";
import { gerarResumoProjetoIa } from "./index.part04.js";
import { carregarContextoModuloIa, gerarArquivosResumoModuloIa } from "./index.part03.js";
import { coletarResumoSemanticoModulo, renderizarResumoModuloMarkdown, renderizarResumoModuloTexto } from "./index.part02.js";

export async function comandoCompilar(
  entrada: string | undefined,
  alvo: AlvoGeracao,
  saida: string,
  estrutura: EstruturaSaida,
  framework: FrameworkGeracao,
  cwd = process.cwd(),
): Promise<number> {
  const incompatibilidade = validarCompatibilidadeFramework(alvo, framework);
  if (incompatibilidade) {
    console.error(incompatibilidade);
    return 1;
  }

  const modulos = await carregarModulos(entrada, cwd);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.error(formatarDiagnosticos(diagnosticos));
    return 1;
  }

  const artefatosGeradosAcimaDoLimite: ArtefatoGeradoAcimaDoLimite[] = [];
  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    const arquivos = aplicarEstruturaSaida(gerarArquivosPorAlvo(ir, alvo, framework), ir, estrutura);
    const escrita = await escreverArquivos(saida, arquivos, { artefatoGerado: true });
    artefatosGeradosAcimaDoLimite.push(...escrita.artefatosGeradosAcimaDoLimite);
  }
  const avisoGerados = formatarAvisoArtefatosGeradosAcimaDoLimite(artefatosGeradosAcimaDoLimite);
  if (avisoGerados) {
    console.warn(avisoGerados);
  }
  console.log(`Compilacao concluida para o alvo ${alvo} com estrutura ${estrutura} e framework ${framework}.`);
  return 0;
}

export async function comandoDiagnosticos(arquivo: string, emJson: boolean): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  if (emJson) {
    console.log(JSON.stringify(resultado.diagnosticos, null, 2));
  } else {
    console.log(formatarDiagnosticos(resultado.diagnosticos));
  }
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

export async function comandoFormatar(entrada: string | undefined, verificarApenas: boolean, emJson: boolean): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, process.cwd());
  const entradaResolvida = contextoProjeto.entradaResolvida;
  const estatisticas = await stat(entradaResolvida);
  const arquivos = estatisticas.isFile()
    ? [entradaResolvida]
    : contextoProjeto.arquivosProjeto.filter((arquivo) => arquivo.startsWith(path.resolve(entradaResolvida)));
  const resultados: ResultadoFormatacaoArquivo[] = [];

  for (const arquivo of arquivos) {
    const codigo = await lerArquivoTexto(arquivo);
    const resultado = formatarCodigo(codigo, arquivo);
    const sucesso = !temErros(resultado.diagnosticos) && Boolean(resultado.codigoFormatado);
    resultados.push({
      caminho: arquivo,
      alterado: resultado.alterado,
      sucesso,
      diagnosticos: resultado.diagnosticos,
    });

    if (sucesso && !verificarApenas && resultado.alterado && resultado.codigoFormatado) {
      await writeFile(arquivo, resultado.codigoFormatado, "utf8");
    }
  }

  const possuiErros = resultados.some((resultado) => !resultado.sucesso);
  const possuiDiferencas = resultados.some((resultado) => resultado.alterado);
  const codigoSaida = possuiErros ? 1 : verificarApenas && possuiDiferencas ? 1 : 0;

  if (emJson) {
    console.log(JSON.stringify({
      comando: "formatar",
      sucesso: codigoSaida === 0,
      modo: verificarApenas ? "check" : "write",
      arquivos: resultados,
      totais: {
        arquivos: resultados.length,
        alterados: resultados.filter((resultado) => resultado.alterado).length,
        erros: resultados.filter((resultado) => !resultado.sucesso).length,
      },
    }, null, 2));
    return codigoSaida;
  }

  if (possuiErros) {
    console.error(formatarDiagnosticos(resultados.flatMap((resultado) => resultado.diagnosticos)));
    return 1;
  }

  if (verificarApenas) {
    if (possuiDiferencas) {
      console.error("Arquivos fora do formato canonico:");
      for (const resultado of resultados.filter((item) => item.alterado)) {
        console.error(`- ${resultado.caminho}`);
      }
      return 1;
    }
    console.log("Todos os arquivos ja estao no formato canonico.");
    return 0;
  }

  console.log(`Formatacao concluida. Arquivos verificados=${resultados.length} alterados=${resultados.filter((resultado) => resultado.alterado).length}`);
  return 0;
}

export async function comandoStarterIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Starter de IA da Sema");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(STARTER_IA);
  return 0;
}

export async function comandoSyncCodex(emJson: boolean): Promise<number> {
  const resumoProjeto = await gerarResumoProjetoIa(process.cwd(), undefined, true, {
    modo: "fresh",
    executar: true,
    avisos: [],
  });
  const exemplos = await materializarExemplosOficiais(resumoProjeto.baseProjeto, true);
  if (!exemplos.sucesso) {
    if (emJson) {
      console.log(JSON.stringify({
        comando: "sync-codex",
        sucesso: false,
        baseProjeto: resumoProjeto.baseProjeto,
        erro: exemplos.erro,
        exemplos,
      }, null, 2));
      return 1;
    }

    console.error(exemplos.erro);
    return 1;
  }

  const indexJson = JSON.parse(await readFile(path.join(resumoProjeto.pastaSaida, "SEMA_INDEX.json"), "utf8"));
  const resultadosCodex = await sincronizarEntrypointCodex(
    resumoProjeto.baseProjeto,
    indexJson.agentContextPack as AgentContextPack,
  );
  const artefatos = [...new Set([
    ...ARQUIVOS_CANONICOS_IA_RAIZ,
    ...resumoProjeto.artefatos,
    ...resultadosCodex.arquivos.map((item) => item.caminho),
    "exemplos",
  ])];
  const sucesso = resultadosCodex.entrypointsLegadosLimpos;

  if (emJson) {
    console.log(JSON.stringify({
      comando: "sync-codex",
      sucesso,
      erro: sucesso ? undefined : "Entrypoints legados com conteudo Sema incompleto ou sem bloco gerenciado exigem revisao manual.",
      baseProjeto: resumoProjeto.baseProjeto,
      pastaSaida: resumoProjeto.pastaSaida,
      artefatos,
      entradaCanonica: indexJson.entradaCanonica,
      resultadosCodex,
      exemplos,
    }, null, 2));
    return sucesso ? 0 : 1;
  }

  if (!sucesso) {
    console.error("Entrypoints legados pendentes de revisao manual:");
    for (const caminho of resultadosCodex.entrypointsLegadosPendentes) {
      console.error(`- ${caminho}`);
    }
    return 1;
  }

  console.log("Entrypoint do Codex sincronizado");
  console.log("");
  console.log(`Base do projeto: ${resumoProjeto.baseProjeto}`);
  console.log(`Ordem canônica: ${indexJson.entradaCanonica.ordemLeitura.join(" -> ")}`);
  console.log(`IA fraca: ${indexJson.entradaCanonica.porCapacidade.fraca.join(" -> ")}`);
  console.log(`IA média: ${indexJson.entradaCanonica.porCapacidade.media.join(" -> ")}`);
  console.log(`IA forte: ${indexJson.entradaCanonica.porCapacidade.forte.join(" -> ")}`);
  console.log(`Codex: ${resultadosCodex.criados.length} criados, ${resultadosCodex.atualizados.length} atualizados, ${resultadosCodex.preservados.length} preservados`);
  console.log(`Exemplos oficiais: ${exemplos.criados.length} criados, ${exemplos.preservados.length} preservados em ${exemplos.destino}`);
  return 0;
}

export async function comandoAjudaIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Ajuda de IA da Sema");
  console.log("");
  console.log(renderizarCaixaAscii([
    "IA-first para greenfield, edicao guiada e legado sem contrato inicial",
    "use o menor artefato semantico que resolva a tarefa",
  ]));
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(renderizarSecaoAscii("Tres jeitos de usar a Sema", [
    "[1] Producao inicial: modele, valide, compile e verifique antes de subir codigo derivado.",
    "[2] Edicao em projeto com Sema: inspecione, leia resumo, rode drift e gere contexto antes de editar codigo vivo.",
    "[3] Projeto sem Sema ainda: importe, revise o rascunho, formate, valide e use drift como juiz da adocao incremental.",
  ]));
  console.log("");
  console.log(renderizarSecaoAscii("Capacidade de IA", [
    "fraca: `sema resumo <arquivo> --micro --drift none --json` usa stdout compacto sem inventar evidência de implementação",
    "média: `sema resumo <arquivo> --curto --drift none --json` + `sema drift <arquivo> --cache fresh --json`",
    "forte: `sema contexto-ia <arquivo.sema> --saida <diretorio> --json` materializa o pacote completo",
  ]));
  console.log("");
  console.log(renderizarSecaoAscii("Fluxo recomendado", [
    "Use `sema starter-ia` para um texto curto de onboarding.",
    "Use `sema descobrir recomendar --intencao <objetivo> --json` quando ainda não souber qual profile, workflow, pipeline, gerador ou adaptador usar.",
    "Use `sema descobrir catalogo --json` ou `sema capabilities --json` para expor o mapa completo de capacidades à IA.",
    "Use `sema interativo pipelines --json` para jogos, simulações e híbridos 3D, 2D, retro, texto, XR ou headless.",
    "Use `sema sync-codex` para regenerar o contexto governado do Codex na raiz.",
    "Use `sema instalar-exemplos` para materializar `exemplos/` oficiais sem sobrescrever arquivos locais.",
    "Use `sema resumo <arquivo> --micro --para onboarding --drift none --json` para IA fraca; o resumo contratual vem no stdout e campos derivados ficam não avaliados.",
    "Se `sema resumo` ou outro gate estourar timeout local, aumente o timeout e tente de novo; timeout do agente nao e falha do Sema.",
    "Use `sema prompt-curto <arquivo> --curto --para mudanca` para colar contexto em modelo gratuito.",
    "Use `sema prompt-ia`, `sema prompt-ia-ui`, `sema prompt-ia-react` e `sema prompt-ia-sema-primeiro` conforme a tarefa.",
    "Use `sema exemplos-prompt-ia` para pegar modelos prontos de prompt.",
    "Use `sema inspecionar --drift none` para descobrir a superfície contratual sem executar drift implicitamente.",
    "Use `sema drift --cache fresh` para medir impls, vínculos, rotas, score e lacunas no fechamento; cache é aceleração, não prova final.",
    "Use `sema docs-impacto --intencao <acao>` para ler ou criar docs obrigatorias antes de agir.",
    "Use `sema finalizar-mudanca --intencao <acao>` para bloquear conclusao sem leitura documental comprovada.",
    "Use `sema contexto-ia <arquivo.sema> --saida <diretorio> --json` para gerar AST, IR, drift, `briefing.json` e `briefing.min.json`.",
    "Use `sema compilar <arquivo-ou-pasta> --alvo <typescript|python|php|dart|lua|javascript|html|css|dotnet|cpp> --saida <diretorio>` quando a tarefa pedir codigo derivado.",
  ]));
  console.log("");
  console.log(renderizarSecaoAscii("Regras praticas", [
    "Foi feita para IA operar melhor; leitura humana e consequencia, nao centro de produto.",
    "Governa contrato, intencao, erro, efeito, garantia, fluxo, vinculos e execucao.",
    "Nao escreve contrato final sozinho nem substitui decisao arquitetural.",
    "Se voce quer testar a Sema de verdade, nao peca so HTML solto.",
    "Peca `.sema` + arquitetura + React + TypeScript, ou use o modo `Sema primeiro`.",
    "Se o projeto ja existe, trate `importar` como rascunho e `drift` como juiz.",
    "IA fraca comeca no menor artefato que resolve a tarefa; nao enfie `ast.json` inteiro nela de bobeira.",
    "Timeout local e so limite do agente: escale e tente de novo antes de chamar Sema de inativo.",
    "Antes de editar software vivo, rode os gates locais; se precisar do pacote materializado, gere-o com `sema contexto-ia ... --saida <diretorio>` antes de ler `briefing.min.json` ou `briefing.json`.",
    "Trate `route`, `worker`, `evento`, `fila`, `cron`, `webhook`, `cache`, `storage` e `policy` como superficies de primeira classe.",
  ]));
  return 0;
}

export async function comandoPromptIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Prompt-base de IA da Sema");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(PROMPT_BASE_IA);
  return 0;
}

export async function comandoPromptIaUi(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Prompt de IA da Sema para UI");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(PROMPT_IA_UI);
  return 0;
}

export async function comandoPromptIaReact(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Prompt de IA da Sema para React");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(PROMPT_IA_REACT);
  return 0;
}

export async function comandoPromptIaSemaPrimeiro(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Prompt de IA da Sema no modo Sema primeiro");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(PROMPT_IA_SEMA_PRIMEIRO);
  return 0;
}

export async function comandoExemplosPromptIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Exemplos de prompt de IA da Sema");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(EXEMPLOS_PROMPT_IA);
  return 0;
}

export async function comandoResumo(
  entrada: string | undefined,
  args: string[],
  emJson: boolean,
): Promise<number> {
  const tamanho = normalizarTamanhoResumo(args);
  const modo = normalizarModoResumo(obterOpcao(args, "--para"));
  const pastaSaida = obterOpcao(args, "--saida");
  const escreverNaRaiz = possuiFlag(args, "--raiz");
  const alvo = entrada ? path.resolve(process.cwd(), entrada) : process.cwd();
  const analiseDrift = resolverAnaliseDriftConsultaCli(args, "resumo");
  const alvoEhArquivo = (await stat(alvo)).isFile();

  if (alvoEhArquivo) {
    const contexto = await carregarContextoModuloIa(alvo, analiseDrift);
    const resumoSemantico = coletarResumoSemanticoModulo(contexto);
    const guiaPorCapacidade = criarGuiaCapacidadeIa();
    const texto = tamanho === "medio"
      ? renderizarResumoModuloMarkdown(resumoSemantico, modo, guiaPorCapacidade)
      : renderizarResumoModuloTexto(resumoSemantico, tamanho, modo);

    let pastaResumo: string | undefined;
    let artefatosCompactos: string[] = [];
    if (pastaSaida) {
      pastaResumo = path.resolve(pastaSaida);
      await mkdir(pastaResumo, { recursive: true });
      const gerado = await gerarArquivosResumoModuloIa(contexto, pastaResumo);
      artefatosCompactos = gerado.artefatosCompactos;
    }

    if (emJson) {
      console.log(JSON.stringify({
        comando: "resumo",
        modo,
        tamanho,
        geradoEm: contexto.geradoEm,
        arquivo: contexto.arquivo,
        modulo: contexto.modulo,
        pastaSaida: pastaResumo ?? null,
        artefatosCompactos,
        analiseDrift: {
          modo: contexto.drift.modo,
          executada: contexto.drift.executada,
          sucesso: contexto.drift.sucesso,
          aviso: contexto.drift.aviso,
          avisos: analiseDrift.avisos,
          cache: contexto.drift.drift?.escopo_aplicado.cache ?? null,
        },
        guiaPorCapacidade,
        resumo: resumoSemantico,
        texto,
      }, null, 2));
      return contexto.drift.sucesso === false ? 1 : 0;
    }

    if (pastaResumo) {
      console.log(`Resumo IA-first gerado em ${pastaResumo}`);
      console.log("");
    }
    console.log(texto);
    return contexto.drift.sucesso === false ? 1 : 0;
  }

  const resumoProjeto = await gerarResumoProjetoIa(alvo, pastaSaida, escreverNaRaiz, analiseDrift);
  const arquivoResumo = tamanho === "micro"
    ? "SEMA_BRIEF.micro.txt"
    : tamanho === "curto"
      ? "SEMA_BRIEF.curto.txt"
      : "SEMA_BRIEF.md";
  const texto = await readFile(path.join(resumoProjeto.pastaSaida, arquivoResumo), "utf8");

  if (emJson) {
    console.log(JSON.stringify({
      comando: "resumo",
      modo,
      tamanho,
      geradoEm: resumoProjeto.geradoEm,
      baseProjeto: resumoProjeto.baseProjeto,
      pastaSaida: resumoProjeto.pastaSaida,
      artefatos: resumoProjeto.artefatos,
      analiseDrift: {
        ...resumoProjeto.analiseDrift,
        avisos: analiseDrift.avisos,
      },
      guiaPorCapacidade: resumoProjeto.guiaPorCapacidade,
      modulos: resumoProjeto.modulos,
      texto,
    }, null, 2));
    return resumoProjeto.analiseDrift.sucesso === false ? 1 : 0;
  }

  console.log(`Resumo IA-first do projeto gerado em ${resumoProjeto.pastaSaida}`);
  console.log("");
  console.log(texto);
  return resumoProjeto.analiseDrift.sucesso === false ? 1 : 0;
}
