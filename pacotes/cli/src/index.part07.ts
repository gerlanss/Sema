// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.governanca_ia.drift.cache.modos
// Descrição: preserva modos explícitos nas superfícies auxiliares de contexto.

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
  SCHEMA_CACHE_VERIFICACAO,
  calcularChaveVerificacao,
  carregarCacheVerificacao,
  gravarCacheVerificacao,
} from "./verificacaoCache.js";

export interface OpcoesVerificar {
  alvo?: string;
  semCache?: boolean;
}

const FONTES_POR_ALVO_SUPORTADO: Record<string, AlvoGeracao[]> = {
  typescript: ["typescript", "javascript"],
  javascript: ["typescript", "javascript"],
  nestjs: ["typescript", "javascript"],
  express: ["typescript", "javascript"],
  fastify: ["typescript", "javascript"],
  nextjs: ["typescript", "javascript"],
  "nextjs-consumer": ["typescript", "javascript"],
  "react-vite-consumer": ["typescript", "javascript"],
  "angular-consumer": ["typescript", "javascript"],
  firebase: ["typescript", "javascript"],
  python: ["python"],
  fastapi: ["python"],
  flask: ["python"],
  dart: ["dart"],
  "flutter-consumer": ["dart"],
  dotnet: ["dotnet"],
  java: ["javascript"],
  lua: ["lua"],
  php: ["php"],
  cpp: ["cpp"],
};

export function alvosSuportadosPelaStack(fontesLegado: string[] | undefined): AlvoGeracao[] | undefined {
  if (!fontesLegado?.length) {
    return undefined;
  }
  const suportados = new Set<AlvoGeracao>();
  for (const fonte of fontesLegado) {
    for (const alvo of FONTES_POR_ALVO_SUPORTADO[fonte] ?? []) {
      suportados.add(alvo);
    }
  }
  return suportados.size > 0 ? [...suportados] : undefined;
}

export function avisoEscopoStackVerificacao(
  fontesLegado: string[] | undefined,
  alvosEfetivos: AlvoGeracao[],
): string | undefined {
  const suportados = alvosSuportadosPelaStack(fontesLegado);
  if (!suportados) {
    return undefined;
  }
  const foraDaStack = alvosEfetivos.filter((alvo) => alvo !== "html" && alvo !== "css" && !suportados.includes(alvo));
  if (foraDaStack.length === 0) {
    return undefined;
  }
  return `Alvos fora da stack detectada (${(fontesLegado ?? []).join(", ")}): ${foraDaStack.join(", ")}. Considere reduzir "alvos" no sema.config.json, remover "fontesLegado" auto-declaradas ou usar --alvo unico.`;
}
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

import { normalizarModoResumo, normalizarTamanhoResumo } from "./index.part01.js";
import { carregarContextoModuloIa } from "./index.part03.js";
import { coletarResumoSemanticoModulo, criarPromptCurtoModulo } from "./index.part02.js";
import { gerarContextoIa, gerarResumoProjetoIa } from "./index.part04.js";

export async function comandoPromptCurto(
  entrada: string | undefined,
  args: string[],
  emJson: boolean,
): Promise<number> {
  const tamanho = normalizarTamanhoResumo(args);
  const modo = normalizarModoResumo(obterOpcao(args, "--para"));
  const alvo = entrada ? path.resolve(process.cwd(), entrada) : process.cwd();

  if (entrada && entrada.toLowerCase().endsWith(".sema")) {
    const contexto = await carregarContextoModuloIa(alvo, {
      modo: "none",
      executar: false,
      avisos: [],
    });
    const resumoSemantico = coletarResumoSemanticoModulo(contexto);
    const capacidade: CapacidadeIa = tamanho === "micro" ? "fraca" : tamanho === "curto" ? "media" : "forte";
    const prompt = criarPromptCurtoModulo(resumoSemantico, modo, tamanho, capacidade);

    if (emJson) {
      console.log(JSON.stringify({
        comando: "prompt-curto",
        modo,
        tamanho,
        capacidade,
        geradoEm: contexto.geradoEm,
        arquivo: contexto.arquivo,
        modulo: contexto.modulo,
        prompt,
      }, null, 2));
      return 0;
    }

    console.log(prompt);
    return 0;
  }

  const resumoProjeto = await gerarResumoProjetoIa(alvo);
  const arquivoResumo = tamanho === "micro"
    ? "SEMA_BRIEF.micro.txt"
    : tamanho === "curto"
      ? "SEMA_BRIEF.curto.txt"
      : "SEMA_BRIEF.md";
  const contextoProjeto = await readFile(path.join(resumoProjeto.pastaSaida, arquivoResumo), "utf8");
  const capacidade: CapacidadeIa = tamanho === "micro" ? "fraca" : tamanho === "curto" ? "media" : "forte";
  const prompt = `⚠️ REGRA OBRIGATÓRIA DE GOVERNANÇA:

ANTES DE QUALQUER AÇÃO (editar, criar, deletar, executar, consultar ou modificar):
1. Rode \`sema docs-impacto --intencao "<ação>" --json\` com sua intenção declarada.
2. Aguarde a resposta com as docs obrigatórias.
3. Leia as docs antes de agir.
4. Antes de concluir, rode \`sema finalizar-mudanca --intencao "<ação>" --doc-lida <arquivo> --json\` com todas as docs lidas.

Você está operando Sema em modo IA-first.

Isto é contexto comprimido para IA operar contrato semântico antes de tocar código vivo.

Capacidade alvo: ${capacidade}
Modo da tarefa: ${modo}

Regras:
- ANTES DE TUDO: rode \`sema docs-impacto --intencao "<ação>" --json\`.
- Comece pelo resumo compacto abaixo.
- Se a tarefa pedir mais contexto, abra \`AGENT_CONTEXT_PACK.json\` e depois \`SEMA_INDEX.json\`.
- Não tente ler o repositório inteiro se o resumo já disser onde tocar.
- Preserve contrato, risco, lacuna e checks sugeridos.

Contexto do projeto:
${contextoProjeto.trim()}
`;

  if (emJson) {
    console.log(JSON.stringify({
      comando: "prompt-curto",
      modo,
      tamanho,
      capacidade,
      geradoEm: resumoProjeto.geradoEm,
      baseProjeto: resumoProjeto.baseProjeto,
      pastaSaida: resumoProjeto.pastaSaida,
      prompt,
    }, null, 2));
    return 0;
  }

  console.log(prompt);
  return 0;
}

export async function comandoContextoIa(arquivo: string, pastaSaida: string | undefined, emJson: boolean): Promise<number> {
  const resultado = await gerarContextoIa(arquivo, pastaSaida);

  if (emJson) {
    console.log(JSON.stringify(resultado, null, 2));
    return 0;
  }

  const resumoGerado = await readFile(path.join(resultado.pastaSaida, "README.md"), "utf8");
  console.log(`Pacote de contexto gerado em ${resultado.pastaSaida}`);
  console.log("");
  console.log(resumoGerado);
  return 0;
}

export async function comandoTestar(
  arquivo: string,
  alvo: AlvoGeracao,
  saida: string,
  estrutura: EstruturaSaida,
  framework: FrameworkGeracao,
): Promise<number> {
  const incompatibilidade = validarCompatibilidadeFramework(alvo, framework);
  if (incompatibilidade) {
    console.error(incompatibilidade);
    return 1;
  }
  if (framework === "base") {
    const configuracaoAlvo = {
      alvo,
      ...resolverConfiguracaoVerificacaoPorAlvo(alvo),
    };
    const verificacaoDependencias = avaliarDependenciasVerificacao([configuracaoAlvo]);
    if (!verificacaoDependencias.ok) {
      imprimirFalhaDependenciasVerificacao(verificacaoDependencias);
      return 1;
    }
  }
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  if (temErros(resultado.diagnosticos)) {
    console.error(formatarDiagnosticos(resultado.diagnosticos));
    return 1;
  }
  const ir = garantirIr(resultado, arquivo);
  const arquivos = aplicarEstruturaSaida(gerarArquivosPorAlvo(ir, alvo, framework), ir, estrutura);
  const escrita = await escreverArquivos(saida, arquivos, { artefatoGerado: true });
  const avisoGerados = formatarAvisoArtefatosGeradosAcimaDoLimite(escrita.artefatosGeradosAcimaDoLimite);
  if (avisoGerados) {
    console.warn(avisoGerados);
  }
  if (framework !== "base") {
    console.log(`Scaffold ${framework} gerado em ${saida}. A execucao automatica de testes continua focada no framework base da Sema.`);
    return 0;
  }
  return executarTestesGerados(alvo, saida, arquivos).codigoSaida;
}

export function imprimirResumoVerificacao(resumos: ResumoModuloVerificacao[]): void {
  console.log("\nResumo da verificacao:");
  let totalArquivos = 0;
  let totalTestes = 0;
  let totalAlvos = 0;

  for (const resumo of resumos) {
    console.log(`- Modulo ${resumo.modulo} (${resumo.arquivoFonte})`);
    for (const alvo of resumo.alvos) {
      totalArquivos += alvo.arquivosGerados;
      totalTestes += alvo.quantidadeTestes;
      totalAlvos += 1;
      console.log(
        `  alvo=${alvo.alvo} framework=${alvo.framework} estrutura=${alvo.estrutura} status=${alvo.sucesso ? "ok" : "falhou"} arquivos=${alvo.arquivosGerados} testes=${alvo.quantidadeTestes}${alvo.testesExecutados ? "" : " (skip)"} saida=${alvo.pastaSaida}`,
      );
    }
  }

  console.log(`Totais: modulos=${resumos.length} alvos=${totalAlvos} arquivos=${totalArquivos} testes=${totalTestes}`);
}

export async function comandoVerificar(
  entrada: string | undefined,
  baseSaida: string,
  cwd = process.cwd(),
  opcoes: OpcoesVerificar = {},
): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const modulos = contextoProjeto.modulosSelecionados;
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.error(formatarDiagnosticos(diagnosticos));
    return 1;
  }

  const alvos = opcoes.alvo
    ? [opcoes.alvo as AlvoGeracao]
    : resolverAlvosVerificacao(contextoProjeto.configCarregada);
  const avisoEscopo = avisoEscopoStackVerificacao(
    contextoProjeto.configCarregada?.config.fontesLegado,
    alvos,
  );
  if (avisoEscopo) {
    console.warn(avisoEscopo);
  }
  const configuracoesAlvo = alvos.map((alvo) => ({
    alvo,
    ...resolverConfiguracaoVerificacaoPorAlvo(alvo, contextoProjeto.configCarregada),
  }));
  const incompatibilidade = configuracoesAlvo.find((item) => item.incompatibilidade);
  if (incompatibilidade?.incompatibilidade) {
    console.error(incompatibilidade.incompatibilidade);
    return 1;
  }

  const verificacaoDependencias = avaliarDependenciasVerificacao(configuracoesAlvo);
  if (!verificacaoDependencias.ok) {
    imprimirFalhaDependenciasVerificacao(verificacaoDependencias);
    return 1;
  }

  const resumos: ResumoModuloVerificacao[] = [];
  const artefatosGeradosAcimaDoLimite: ArtefatoGeradoAcimaDoLimite[] = [];
  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    console.log(`Verificando modulo ${modulo.caminho}`);
    const resumoModulo: ResumoModuloVerificacao = {
      modulo: ir.nome,
      arquivoFonte: modulo.caminho,
      alvos: [],
    };
    const conteudoContrato = await readFile(modulo.caminho, "utf8").catch(() => "");
    for (const configuracaoAlvo of configuracoesAlvo) {
      const { alvo, framework, estrutura } = configuracaoAlvo;
      const pastaAlvo = path.join(baseSaida, alvo, nomeSubpastaModulo(modulo.caminho));
      const chave = calcularChaveVerificacao({
        versaoCli: pacoteCli.version,
        versaoNode: process.versions.node ?? "",
        modulo: ir.nome,
        alvo,
        framework: framework ?? "",
        estrutura,
        conteudoContrato,
      });
      const emCache = opcoes.semCache ? undefined : await carregarCacheVerificacao(chave, pastaAlvo);
      if (emCache) {
        resumoModulo.alvos.push({
          alvo,
          arquivosGerados: emCache.arquivosGerados.length,
          quantidadeTestes: emCache.quantidadeTestes,
          pastaSaida: pastaAlvo,
          sucesso: emCache.sucesso,
          framework,
          estrutura,
          testesExecutados: false,
          origem: "cache",
        });
        if (!emCache.sucesso) {
          imprimirResumoVerificacao([...resumos, resumoModulo]);
          console.error(`Falha registrada em cache na verificacao do modulo ${modulo.caminho} para o alvo ${alvo}.`);
          return 1;
        }
        continue;
      }
      const arquivos = aplicarEstruturaSaida(gerarArquivosPorAlvo(ir, alvo, framework), ir, estrutura);
      const escrita = await escreverArquivos(pastaAlvo, arquivos, { artefatoGerado: true });
      artefatosGeradosAcimaDoLimite.push(...escrita.artefatosGeradosAcimaDoLimite);
      const { execucao, testesExecutados } = executarTestesParaVerificacao(alvo, pastaAlvo, arquivos, framework);
      await gravarCacheVerificacao({
        schemaVersion: SCHEMA_CACHE_VERIFICACAO,
        chave,
        versaoCli: pacoteCli.version,
        alvo,
        modulo: ir.nome,
        sucesso: execucao.codigoSaida === 0,
        quantidadeTestes: execucao.quantidadeTestes,
        testesExecutados,
        arquivosGerados: arquivos.map((arquivo) => arquivo.caminhoRelativo),
        geradoEm: new Date().toISOString(),
      });
      resumoModulo.alvos.push({
        alvo,
        arquivosGerados: arquivos.length,
        quantidadeTestes: execucao.quantidadeTestes,
        pastaSaida: pastaAlvo,
        sucesso: execucao.codigoSaida === 0,
        framework,
        estrutura,
        testesExecutados,
        origem: "executado",
      });
      if (execucao.codigoSaida !== 0) {
        imprimirResumoVerificacao([...resumos, resumoModulo]);
        console.error(`Falha na verificacao do modulo ${modulo.caminho} para o alvo ${alvo}.`);
        return execucao.codigoSaida;
      }
    }
    resumos.push(resumoModulo);
  }

  const avisoGerados = formatarAvisoArtefatosGeradosAcimaDoLimite(artefatosGeradosAcimaDoLimite);
  if (avisoGerados) {
    console.warn(avisoGerados);
  }
  imprimirResumoVerificacao(resumos);
  console.log("Verificacao completa concluida com sucesso.");
  return 0;
}

export async function comandoVerificarJson(
  entrada: string | undefined,
  baseSaida: string,
  cwd = process.cwd(),
  opcoes: OpcoesVerificar = {},
): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const modulos = contextoProjeto.modulosSelecionados;
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.log(JSON.stringify({
      comando: "verificar",
      sucesso: false,
      diagnosticos,
      modulos: [],
      totais: { modulos: 0, alvos: 0, arquivos: 0, testes: 0 },
    }, null, 2));
    return 1;
  }

  const alvos = opcoes.alvo
    ? [opcoes.alvo as AlvoGeracao]
    : resolverAlvosVerificacao(contextoProjeto.configCarregada);
  const avisoEscopo = avisoEscopoStackVerificacao(
    contextoProjeto.configCarregada?.config.fontesLegado,
    alvos,
  );
  const configuracoesAlvo = alvos.map((alvo) => ({
    alvo,
    ...resolverConfiguracaoVerificacaoPorAlvo(alvo, contextoProjeto.configCarregada),
  }));
  const incompatibilidade = configuracoesAlvo.find((item) => item.incompatibilidade);
  if (incompatibilidade?.incompatibilidade) {
    console.log(JSON.stringify({
      comando: "verificar",
      sucesso: false,
      erro: incompatibilidade.incompatibilidade,
      modulos: [],
      totais: { modulos: 0, alvos: 0, arquivos: 0, testes: 0 },
    }, null, 2));
    return 1;
  }

  const verificacaoDependencias = avaliarDependenciasVerificacao(configuracoesAlvo);
  if (!verificacaoDependencias.ok) {
    console.log(JSON.stringify({
      comando: "verificar",
      sucesso: false,
      erro: "Dependencias obrigatorias ausentes para executar a verificacao.",
      dependencias: verificacaoDependencias,
      modulos: [],
      totais: { modulos: 0, alvos: 0, arquivos: 0, testes: 0 },
    }, null, 2));
    return 1;
  }

  const resumos: Array<ResumoModuloVerificacao & { saidaTestes?: Array<{ alvo: string; stdout: string; stderr: string }> }> = [];
  const artefatosGeradosAcimaDoLimite: ArtefatoGeradoAcimaDoLimite[] = [];
  let codigoSaida = 0;

  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    const resumoModulo: ResumoModuloVerificacao & { saidaTestes: Array<{ alvo: string; stdout: string; stderr: string }> } = {
      modulo: ir.nome,
      arquivoFonte: modulo.caminho,
      alvos: [],
      saidaTestes: [],
    };
    const conteudoContrato = await readFile(modulo.caminho, "utf8").catch(() => "");

    for (const configuracaoAlvo of configuracoesAlvo) {
      const { alvo, framework, estrutura } = configuracaoAlvo;
      const pastaAlvo = path.join(baseSaida, alvo, nomeSubpastaModulo(modulo.caminho));
      const chave = calcularChaveVerificacao({
        versaoCli: pacoteCli.version,
        versaoNode: process.versions.node ?? "",
        modulo: ir.nome,
        alvo,
        framework: framework ?? "",
        estrutura,
        conteudoContrato,
      });
      const emCache = opcoes.semCache ? undefined : await carregarCacheVerificacao(chave, pastaAlvo);
      if (emCache) {
        resumoModulo.alvos.push({
          alvo,
          arquivosGerados: emCache.arquivosGerados.length,
          quantidadeTestes: emCache.quantidadeTestes,
          pastaSaida: pastaAlvo,
          sucesso: emCache.sucesso,
          framework,
          estrutura,
          testesExecutados: false,
          origem: "cache",
        });
        resumoModulo.saidaTestes.push({ alvo, stdout: "", stderr: `resultado reutilizado do cache de verificacao (chave ${chave.slice(0, 12)})` });
        if (!emCache.sucesso) {
          codigoSaida = 1;
        }
        continue;
      }
      const arquivos = aplicarEstruturaSaida(gerarArquivosPorAlvo(ir, alvo, framework), ir, estrutura);
      const escrita = await escreverArquivos(pastaAlvo, arquivos, { artefatoGerado: true });
      artefatosGeradosAcimaDoLimite.push(...escrita.artefatosGeradosAcimaDoLimite);
      const { execucao, testesExecutados } = executarTestesParaVerificacao(alvo, pastaAlvo, arquivos, framework, true);
      await gravarCacheVerificacao({
        schemaVersion: SCHEMA_CACHE_VERIFICACAO,
        chave,
        versaoCli: pacoteCli.version,
        alvo,
        modulo: ir.nome,
        sucesso: execucao.codigoSaida === 0,
        quantidadeTestes: execucao.quantidadeTestes,
        testesExecutados,
        arquivosGerados: arquivos.map((arquivo) => arquivo.caminhoRelativo),
        geradoEm: new Date().toISOString(),
      });
      resumoModulo.alvos.push({
        alvo,
        arquivosGerados: arquivos.length,
        quantidadeTestes: execucao.quantidadeTestes,
        pastaSaida: pastaAlvo,
        sucesso: execucao.codigoSaida === 0,
        framework,
        estrutura,
        testesExecutados,
        origem: "executado",
      });
      resumoModulo.saidaTestes.push({ alvo, stdout: execucao.saidaPadrao, stderr: execucao.saidaErro });
      if (execucao.codigoSaida !== 0) {
        codigoSaida = execucao.codigoSaida;
      }
    }

    resumos.push(resumoModulo);
  }

  const totais = {
    modulos: resumos.length,
    alvos: resumos.reduce((total, resumo) => total + resumo.alvos.length, 0),
    arquivos: resumos.reduce((total, resumo) => total + resumo.alvos.reduce((subTotal, alvo) => subTotal + alvo.arquivosGerados, 0), 0),
    testes: resumos.reduce((total, resumo) => total + resumo.alvos.reduce((subTotal, alvo) => subTotal + alvo.quantidadeTestes, 0), 0),
  };

  console.log(JSON.stringify({
    comando: "verificar",
    sucesso: codigoSaida === 0,
    avisoEscopo,
    modulos: resumos,
    totais,
    artefatosGeradosAcimaDoLimite,
  }, null, 2));

  return codigoSaida;
}
