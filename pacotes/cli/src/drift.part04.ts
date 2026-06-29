// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type {
  EngineBanco,
  IrBancoDados,
  IrFlow,
  IrModulo,
  IrRecursoPersistencia,
  IrRoute,
  IrSuperficie,
  IrTask,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  TipoRecursoPersistencia,
} from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type { FonteLegado } from "./tipos.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { extrairSimbolosLua } from "./lua-symbols.js";
import { contarIndentacaoPython, extrairRotasFlaskDecoradas, normalizarCaminhoFlask } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import { extrairRotasTypeScriptHttp } from "./typescript-http.js";
import { emitirDiagnosticosArquivosOrcamento } from "./driftOrcamento.js";

import { ResultadoDrift, SimboloResolvido, diretoriosIgnoradosAtivos } from "./drift.part01.js";
import { escolherArquivoPorVinculo, escolherSimboloPorVinculo } from "./drift.part03.js";
import { avaliarPontuacaoSemantica, resolverPoliticaPontuacaoSemantica, type PoliticaPontuacaoSemantica } from "./driftScore.js";

export function resolverArquivoOuSimboloAncora(
  vinculos: IrVinculo[],
  simbolos: SimboloResolvido[],
  mapaImpl: Map<string, SimboloResolvido>,
  arquivos: string[],
): { arquivo?: string; simbolo?: string; confianca: NivelConfiancaSemantica } | undefined {
  for (const vinculo of vinculos) {
    if (vinculo.simbolo) {
      const resolucaoSimbolo = escolherSimboloPorVinculo(simbolos, mapaImpl, vinculo.simbolo);
      if (resolucaoSimbolo.status !== "nao_encontrado") {
        return {
          arquivo: resolucaoSimbolo.simbolo?.arquivo,
          simbolo: resolucaoSimbolo.simbolo?.simbolo,
          confianca: resolucaoSimbolo.confianca,
        };
      }
    }

    if (vinculo.arquivo) {
      const resolucaoArquivo = escolherArquivoPorVinculo(arquivos, vinculo.arquivo);
      if (resolucaoArquivo.status !== "nao_encontrado") {
        return {
          arquivo: resolucaoArquivo.arquivo,
          confianca: resolucaoArquivo.confianca,
        };
      }
    }
  }

  return undefined;
}

export function encontrarAncoraSuperficie(
  ir: IrModulo,
  superficie: IrSuperficie,
  simbolos: SimboloResolvido[],
  mapaImpl: Map<string, SimboloResolvido>,
  arquivos: string[],
): { arquivo?: string; simbolo?: string; confianca: NivelConfiancaSemantica } | undefined {
  const ancoraDireta = resolverArquivoOuSimboloAncora(superficie.vinculos, simbolos, mapaImpl, arquivos);
  if (ancoraDireta) {
    return ancoraDireta;
  }

  for (const impl of superficie.implementacoesExternas) {
    const resolvido = mapaImpl.get(impl.caminho);
    if (resolvido) {
      return {
        arquivo: resolvido.arquivo,
        simbolo: resolvido.simbolo,
        confianca: "alta",
      };
    }
  }

  if (!superficie.task) {
    return undefined;
  }

  const taskAssociada = ir.tasks.find((task) => task.nome === superficie.task);
  if (!taskAssociada) {
    return undefined;
  }

  const ancoraTask = resolverArquivoOuSimboloAncora(taskAssociada.vinculos, simbolos, mapaImpl, arquivos);
  if (ancoraTask) {
    return ancoraTask;
  }

  for (const impl of taskAssociada.implementacoesExternas) {
    const resolvido = mapaImpl.get(impl.caminho);
    if (resolvido) {
      return {
        arquivo: resolvido.arquivo,
        simbolo: resolvido.simbolo,
        confianca: "alta",
      };
    }
  }

  return undefined;
}

export function calcularRiscoOperacional(task: IrTask): NivelRiscoSemantico {
  const dadosSensiveis = Boolean(
    task.dados.classificacaoPadrao && ["pii", "financeiro", "credencial", "segredo"].includes(task.dados.classificacaoPadrao)
    || task.dados.campos.some((campo) => ["pii", "financeiro", "credencial", "segredo"].includes(campo.classificacao))
  );
  const efeitoPrivilegiado = task.efeitosEstruturados.some((efeito) =>
    ["db.read", "db.write", "queue.publish", "queue.consume", "fs.read", "fs.write", "network.egress", "secret.read", "shell.exec"].includes(efeito.categoria)
    || ["alta", "critica"].includes(efeito.criticidade ?? ""),
  );
  if (
    task.execucao.criticidadeOperacional === "alta"
    || task.execucao.criticidadeOperacional === "critica"
    || dadosSensiveis
    || efeitoPrivilegiado
    || task.efeitosEstruturados.some((efeito) => efeito.categoria === "persistencia" || efeito.criticidade === "critica")
  ) {
    return "alto";
  }

  if (task.efeitosEstruturados.length > 0 || task.vinculos.length > 0 || task.errosDetalhados.length > 0) {
    return "medio";
  }

  return "baixo";
}

export function calcularConfiancaTask(
  task: IrTask,
  implsValidos: number,
  implsQuebrados: number,
  vinculosValidos: number,
  vinculosQuebrados: number,
): NivelConfiancaSemantica {
  if ((implsValidos > 0 || vinculosValidos > 0) && implsQuebrados === 0 && vinculosQuebrados === 0) {
    return "alta";
  }
  if (implsValidos > 0 || vinculosValidos > 0 || task.implementacoesExternas.length > 0 || task.vinculos.length > 0) {
    return "media";
  }
  return "baixa";
}

export function calcularScoreTask(
  task: IrTask,
  implsValidos: number,
  implsQuebrados: number,
  vinculosValidos: number,
  vinculosQuebrados: number,
  semImplementacao: boolean,
): number {
  let score = 45;
  if (!semImplementacao && task.implementacoesExternas.length > 0) {
    score += 15;
  }
  score += Math.min(implsValidos * 10, 20);
  score -= Math.min(implsQuebrados * 20, 30);
  score += Math.min(vinculosValidos * 5, 15);
  score -= Math.min(vinculosQuebrados * 10, 20);
  if (task.guarantees.length > 0) {
    score += 5;
  }
  if (task.execucao.explicita) {
    score += 5;
  }
  return Math.max(0, Math.min(100, score));
}

export function resumirLacunasTask(
  task: IrTask,
  semImplementacao: boolean,
  implsQuebrados: number,
  vinculosQuebrados: number,
  guardrails: {
    publica: boolean;
    sensivel: boolean;
    auth: boolean;
    authz: boolean;
    dados: boolean;
    audit: boolean;
    segredos: boolean;
    forbidden: boolean;
    dadosSensiveis: boolean;
    efeitoPrivilegiado: boolean;
    exigeSegredos: boolean;
  },
): string[] {
  const lacunas: string[] = [];
  if (semImplementacao) {
    lacunas.push("sem_impl");
  }
  if (implsQuebrados > 0) {
    lacunas.push("impl_quebrado");
  }
  if (task.vinculos.length === 0) {
    lacunas.push("sem_vinculos");
  }
  if (vinculosQuebrados > 0) {
    lacunas.push("vinculo_quebrado");
  }
  if (!task.execucao.explicita) {
    lacunas.push("execucao_implicita");
  }
  if (guardrails.publica && !task.execucao.explicita) {
    lacunas.push("superficie_publica_sem_execucao");
  }
  if (guardrails.sensivel && !task.execucao.explicita) {
    lacunas.push("execucao_critica_sem_bloco");
  }
  if ((guardrails.publica || guardrails.sensivel) && semImplementacao && task.vinculos.length === 0) {
    lacunas.push("rastreabilidade_fraca");
  }
  if (guardrails.publica && !guardrails.auth) {
    lacunas.push("auth_ausente");
  }
  if ((guardrails.publica || guardrails.sensivel || guardrails.efeitoPrivilegiado || guardrails.dadosSensiveis) && !guardrails.authz) {
    lacunas.push("authz_frouxa");
  }
  if ((guardrails.publica || guardrails.sensivel || guardrails.efeitoPrivilegiado) && !guardrails.dados) {
    lacunas.push("dados_nao_classificados");
  }
  if ((guardrails.publica || guardrails.sensivel || guardrails.efeitoPrivilegiado || guardrails.dadosSensiveis) && !guardrails.audit) {
    lacunas.push("audit_ausente");
  }
  if (guardrails.exigeSegredos && !guardrails.segredos) {
    lacunas.push("segredo_sem_governanca");
  }
  if ((guardrails.efeitoPrivilegiado || guardrails.dadosSensiveis) && !guardrails.forbidden) {
    lacunas.push("proibicoes_ausentes");
  }
  return lacunas;
}

export function resumirOperacional(
  resultado: Omit<ResultadoDrift, "comando" | "sucesso">,
  politicaPontuacao: PoliticaPontuacaoSemantica = resolverPoliticaPontuacaoSemantica(),
): ResultadoDrift["resumo_operacional"] {
  const scoreMedio = resultado.tasks.length > 0
    ? Math.round(resultado.tasks.reduce((total, task) => total + task.scoreSemantico, 0) / resultado.tasks.length)
    : 0;
  const avaliacaoPontuacao = avaliarPontuacaoSemantica(scoreMedio, politicaPontuacao);
  const riscosPrincipais = [...new Set([
    ...resultado.tasks.filter((task) => task.riscoOperacional !== "baixo").map((task) => `${task.task}:${task.riscoOperacional}`),
    ...resultado.persistencia_real
      .filter((item) => item.status !== "materializado")
      .map((item) => `${item.task}:${item.alvo}:persistencia_${item.status}`),
  ])];
  const oQueTocar = [...new Set([
    ...resultado.tasks.flatMap((task) => task.arquivosProvaveisEditar),
    ...resultado.persistencia_real.flatMap((item) => [...item.arquivos, ...item.repositorios]),
  ])].slice(0, 20);
  const oQueValidar = [...new Set([
    ...resultado.tasks.flatMap((task) => task.checksSugeridos),
    ...resultado.persistencia_real
      .filter((item) => item.status !== "materializado")
      .map((item) => `validar persistencia real de ${item.task} em ${item.alvo}`),
  ])];
  const oQueEstaFrouxo = [...new Set([
    ...avaliacaoPontuacao.travasPontuacao,
    ...resultado.tasks.flatMap((task) => task.lacunas),
    ...resultado.persistencia_real
      .filter((item) => item.status !== "materializado" || item.compatibilidade === "desconhecida" || item.compatibilidade === "invalido")
      .map((item) => `persistencia:${item.alvo}:${item.status}:${item.compatibilidade}`),
  ])];
  const oQueFoiInferido = [
    ...new Set([
      ...resultado.impls_quebrados.flatMap((impl) => impl.candidatos?.map((candidato) => candidato.caminho) ?? []),
      ...resultado.vinculos_quebrados.filter((vinculo) => vinculo.status === "parcial").map((vinculo) => `${vinculo.dono}:${vinculo.valor}`),
      ...resultado.persistencia_real
        .filter((item) => item.compatibilidade === "desconhecida")
        .map((item) => `${item.task}:${item.alvo}:compatibilidade_nao_confirmada`),
    ]),
  ];

  return {
    scoreMedio,
    confiancaGeral: avaliacaoPontuacao.confiancaGeral,
    pontuacaoMinimaOperacional: avaliacaoPontuacao.pontuacaoMinimaOperacional,
    pontuacaoAlvoAtual: avaliacaoPontuacao.pontuacaoAlvoAtual,
    pontuacaoAlvoFinal: avaliacaoPontuacao.pontuacaoAlvoFinal,
    passoEvolucaoPontuacao: avaliacaoPontuacao.passoEvolucaoPontuacao,
    proximaPontuacaoAlvo: avaliacaoPontuacao.proximaPontuacaoAlvo,
    pontuacaoAbaixoDoPiso: avaliacaoPontuacao.pontuacaoAbaixoDoPiso,
    pontuacaoAbaixoDoAlvo: avaliacaoPontuacao.pontuacaoAbaixoDoAlvo,
    travasPontuacao: avaliacaoPontuacao.travasPontuacao,
    riscosPrincipais,
    oQueTocar,
    oQueValidar,
    oQueEstaFrouxo,
    oQueFoiInferido,
  };
}

export function paraIdentificadorModulo(valor: string): string {
  return valor
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function extrairTextoLiteral(expr?: ts.Expression): string | undefined {
  if (!expr) {
    return undefined;
  }
  if (ts.isStringLiteralLike(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  if (ts.isNumericLiteral(expr)) {
    return expr.text;
  }
  return undefined;
}

export function listarDecoradores(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
}

export function lerDecorator(node: ts.Node, nomes: string[]): { nome: string; argumentos: ts.NodeArray<ts.Expression> } | undefined {
  for (const decorator of listarDecoradores(node)) {
    const expressao = decorator.expression;
    if (ts.isCallExpression(expressao)) {
      const alvo = expressao.expression;
      if (ts.isIdentifier(alvo) && nomes.includes(alvo.text)) {
        return { nome: alvo.text, argumentos: expressao.arguments };
      }
    } else if (ts.isIdentifier(expressao) && nomes.includes(expressao.text)) {
      return { nome: expressao.text, argumentos: ts.factory.createNodeArray() };
    }
  }
  return undefined;
}

export function juntarCaminhoHttp(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base ?? "", sufixo ?? ""]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\/+|\/+$/g, ""));

  const caminho = `/${partes.join("/")}`.replace(/\/+/g, "/");
  return caminho === "//" ? "/" : caminho;
}

export async function listarArquivosRecursivos(diretorio: string, extensoes: string[]): Promise<string[]> {
  let entradas;
  try {
    entradas = await readdir(diretorio, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return [];
  }

  const encontrados: string[] = [];
  for (const entrada of entradas) {
    if (diretoriosIgnoradosAtivos.has(entrada.name.toLowerCase())) {
      continue;
    }
    const caminhoAtual = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...await listarArquivosRecursivos(caminhoAtual, extensoes));
      continue;
    }
    if (extensoes.some((extensao) => entrada.name.endsWith(extensao))) {
      encontrados.push(caminhoAtual);
    }
  }

  return encontrados.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export const EXTENSOES_ARQUIVOS_RASTREAVEIS_DRIFT = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".dart", ".lua", ".cs", ".java", ".go", ".rs",
  ".cpp", ".cc", ".cxx", ".hpp", ".h",
  ".sql", ".psql", ".ddl", ".prisma",
  ".md", ".mdx", ".txt", ".json", ".jsonl",
  ".yml", ".yaml", ".toml", ".xml", ".html", ".htm", ".css",
  ".Caddyfile", ".caddyfile",
];

export async function indexarArquivosRastreaveis(diretorios: string[]): Promise<string[]> {
  const arquivos = new Set<string>();
  for (const diretorio of diretorios) {
    for (const arquivo of await listarArquivosRecursivos(diretorio, EXTENSOES_ARQUIVOS_RASTREAVEIS_DRIFT)) {
      arquivos.add(arquivo);
    }
  }
  return [...arquivos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function caminhosSimbolicos(baseDiretorio: string, arquivo: string): string[] {
  const relativo = path.relative(baseDiretorio, arquivo).replace(/\.[^.]+$/, "");
  const semPrefixo = relativo
    .split(path.sep)
    .map((segmento) => paraIdentificadorModulo(segmento))
    .filter(Boolean)
    .join(".");
  const prefixo = paraIdentificadorModulo(path.basename(baseDiretorio));
  const comPrefixo = prefixo ? [prefixo, semPrefixo].filter(Boolean).join(".") : semPrefixo;
  const aliasesIndex = path.basename(relativo) === "index"
    ? [
        semPrefixo.replace(/(?:^|\.)index$/, ""),
        comPrefixo.replace(/(?:^|\.)index$/, ""),
      ]
    : [];
  return [...new Set([semPrefixo, comPrefixo, ...aliasesIndex].filter(Boolean))];
}

export function registrarSimboloTypeScript(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  nome: string,
  nomeClasse?: string,
  origem: "ts" | "js" = "ts",
): void {
  for (const baseSimbolica of basesSimbolicas) {
    const caminho = nomeClasse
      ? `${baseSimbolica}.${nomeClasse}.${nome}`
      : `${baseSimbolica}.${nome}`;
    simbolos.set(caminho, {
      origem,
      caminho,
      arquivo,
      simbolo: nomeClasse ? `${nomeClasse}.${nome}` : nome,
    });
  }
}

export function desembrulharExpressaoTypeScript(expr: ts.Expression): ts.Expression {
  let atual = expr;
  while (true) {
    if (ts.isParenthesizedExpression(atual) || ts.isAsExpression(atual) || ts.isSatisfiesExpression(atual) || ts.isTypeAssertionExpression(atual)) {
      atual = atual.expression;
      continue;
    }
    if (ts.isAwaitExpression(atual)) {
      atual = atual.expression;
      continue;
    }
    return atual;
  }
}

export function extrairNomePropriedadeTypeScript(nome: ts.PropertyName, sourceFile: ts.SourceFile): string | undefined {
  if (ts.isIdentifier(nome) || ts.isStringLiteralLike(nome) || ts.isNumericLiteral(nome)) {
    return nome.text;
  }
  if (ts.isComputedPropertyName(nome) && ts.isStringLiteralLike(nome.expression)) {
    return nome.expression.text;
  }
  const texto = nome.getText(sourceFile).trim();
  return texto.length > 0 ? texto : undefined;
}

export function extrairNomeClassePrototypeTypeScript(expr: ts.Expression, sourceFile: ts.SourceFile): string | undefined {
  const alvo = desembrulharExpressaoTypeScript(expr);
  if (ts.isPropertyAccessExpression(alvo) && alvo.name.text === "prototype") {
    return alvo.expression.getText(sourceFile).trim() || undefined;
  }
  return undefined;
}
