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

import { ConfiguracaoEscopoDriftAplicada, DIRETORIOS_CONSUMIDOR_LATERAL, DIRETORIOS_WORKTREE, RegistroConsumerBridgeDrift, RegistroConsumerSurfaceDrift, RegistroVinculoDrift, ResumoTaskDrift, caminhoTemSegmentoIgnorado, normalizarFragmentoArquivo } from "./drift.part01.js";
import { paraIdentificadorModulo } from "./drift.part04.js";
import { normalizarCaminhoRota } from "./drift.part09.js";

export function normalizarCaminhoComparacao(caminhoArquivo: string): string {
  return path.resolve(caminhoArquivo).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function caminhoEstaDentroDe(base: string, alvo: string): boolean {
  const baseNormalizada = normalizarCaminhoComparacao(base);
  const alvoNormalizado = normalizarCaminhoComparacao(alvo);
  return alvoNormalizado === baseNormalizada || alvoNormalizado.startsWith(`${baseNormalizada}/`);
}

export function resolverRaizEscopoReal(contexto: ContextoProjetoCarregado): string {
  const entrada = path.resolve(contexto.entradaResolvida);
  return path.extname(entrada) ? path.dirname(entrada) : entrada;
}

export function resolverRaizesExplicitasConfiguradas(contexto: ContextoProjetoCarregado): string[] {
  const configCarregada = contexto.configCarregada;
  if (!configCarregada) {
    return [];
  }

  const origensDeclaradas = configCarregada.config.origens ?? (configCarregada.config.origem ? [configCarregada.config.origem] : []);
  return [...new Set([
    ...(configCarregada.config.diretoriosCodigo ?? []).map((diretorio) => path.resolve(configCarregada.baseDiretorio, diretorio)),
    ...origensDeclaradas.map((origem) => path.resolve(configCarregada.baseDiretorio, origem)),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function resolverRaizesIgnoradasPermitidas(
  contexto: ContextoProjetoCarregado,
  segmentosIgnorados: string[],
  incluirRaizesConfiguradas = false,
): string[] {
  return [...new Set([
    path.resolve(contexto.baseProjeto),
    resolverRaizEscopoReal(contexto),
    ...(incluirRaizesConfiguradas ? resolverRaizesExplicitasConfiguradas(contexto) : []),
  ])]
    .filter((raiz) => caminhoTemSegmentoIgnorado(raiz, segmentosIgnorados))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function caminhoIgnoradoForaDoEscopoReal(
  caminhoArquivo: string,
  segmentosIgnorados: string[],
  raizesPermitidas: string[],
): boolean {
  if (!caminhoTemSegmentoIgnorado(caminhoArquivo, segmentosIgnorados)) {
    return false;
  }
  if (raizesPermitidas.length === 0) {
    return true;
  }
  return !raizesPermitidas.some((raiz) => caminhoEstaDentroDe(raiz, caminhoArquivo));
}

export function filtrarCaminhosEscopoReal(
  caminhos: string[],
  contexto: ContextoProjetoCarregado,
  configuracao: Pick<ConfiguracaoEscopoDriftAplicada, "ignorarWorktrees" | "ignorarConsumidoresLaterais">,
): string[] {
  const escopoJaEstaEmWorktree = caminhoTemSegmentoIgnorado(contexto.baseProjeto, DIRETORIOS_WORKTREE)
    || caminhoTemSegmentoIgnorado(resolverRaizEscopoReal(contexto), DIRETORIOS_WORKTREE);
  const escopoJaEstaEmConsumer = caminhoTemSegmentoIgnorado(contexto.baseProjeto, DIRETORIOS_CONSUMIDOR_LATERAL)
    || caminhoTemSegmentoIgnorado(resolverRaizEscopoReal(contexto), DIRETORIOS_CONSUMIDOR_LATERAL);
  const raizesWorktreePermitidas = resolverRaizesIgnoradasPermitidas(contexto, DIRETORIOS_WORKTREE, escopoJaEstaEmWorktree);
  const raizesConsumidorPermitidas = resolverRaizesIgnoradasPermitidas(contexto, DIRETORIOS_CONSUMIDOR_LATERAL, escopoJaEstaEmConsumer);
  return caminhos.filter((caminho) => {
    if (configuracao.ignorarWorktrees && caminhoIgnoradoForaDoEscopoReal(caminho, DIRETORIOS_WORKTREE, raizesWorktreePermitidas)) {
      return false;
    }
    if (configuracao.ignorarConsumidoresLaterais
      && caminhoIgnoradoForaDoEscopoReal(caminho, DIRETORIOS_CONSUMIDOR_LATERAL, raizesConsumidorPermitidas)) {
      return false;
    }
    return true;
  });
}

export function resolverDiretoriosCodigoEscopoReal(
  contexto: ContextoProjetoCarregado,
  configuracao: Pick<ConfiguracaoEscopoDriftAplicada, "ignorarWorktrees" | "ignorarConsumidoresLaterais">,
): string[] {
  return filtrarCaminhosEscopoReal(contexto.diretoriosCodigo, contexto, configuracao);
}

export function textoCombinaEscopo(texto: string, termos: string[]): boolean {
  if (termos.length === 0) {
    return true;
  }
  const normalizado = paraIdentificadorModulo(texto);
  return termos.some((termo) => normalizado.includes(termo));
}

export interface ContextoRelevanciaConsumerDrift {
  arquivosAncora: string[];
  rotasAncora: string[];
}

export function construirContextoRelevanciaConsumer(
  contexto: ContextoProjetoCarregado,
  tasksResumo: ResumoTaskDrift[],
  vinculosValidos: RegistroVinculoDrift[],
): ContextoRelevanciaConsumerDrift {
  const arquivosAncora = new Set<string>();
  const rotasAncora = new Set<string>();

  for (const modulo of contexto.modulosSelecionados) {
    const ir = modulo.resultado.ir;
    if (!ir) {
      continue;
    }
    for (const route of ir.routes) {
      if (route.caminho) {
        rotasAncora.add(normalizarCaminhoRota(route.caminho));
      }
    }
  }

  for (const task of tasksResumo) {
    for (const arquivo of [...task.arquivosReferenciados, ...task.arquivosProvaveisEditar]) {
      arquivosAncora.add(arquivo);
    }
  }

  for (const vinculo of vinculosValidos) {
    if (vinculo.arquivo) {
      arquivosAncora.add(vinculo.arquivo);
    }
    if (vinculo.tipo === "superficie" || vinculo.tipo === "rota") {
      rotasAncora.add(normalizarCaminhoRota(vinculo.valor));
    }
  }

  return {
    arquivosAncora: [...arquivosAncora].sort((a, b) => a.localeCompare(b, "pt-BR")),
    rotasAncora: [...rotasAncora].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export function pontuarTextoEscopo(texto: string, termos: string[]): number {
  if (termos.length === 0) {
    return 0;
  }
  const normalizado = paraIdentificadorModulo(texto);
  const segmentos = new Set(normalizado.split("_").filter(Boolean));
  let score = 0;
  for (const termo of termos) {
    if (segmentos.has(termo)) {
      score += 4;
      continue;
    }
    if (normalizado.includes(termo)) {
      score += 2;
    }
  }
  return Math.min(score, 8);
}

export function pontuarProximidadeArquivoConsumer(arquivo: string, arquivosAncora: string[]): number {
  if (arquivosAncora.length === 0) {
    return 0;
  }

  const alvo = normalizarFragmentoArquivo(arquivo);
  const diretorioAlvo = path.posix.dirname(alvo);
  let scoreMaximo = 0;

  for (const ancora of arquivosAncora) {
    const ancoraNormalizada = normalizarFragmentoArquivo(ancora);
    const diretorioAncora = path.posix.dirname(ancoraNormalizada);

    if (alvo === ancoraNormalizada) {
      return 8;
    }
    if (diretorioAlvo === diretorioAncora) {
      scoreMaximo = Math.max(scoreMaximo, 6);
      continue;
    }

    const ultimoDiretorioAlvo = diretorioAlvo.split("/").filter(Boolean).at(-1);
    const ultimoDiretorioAncora = diretorioAncora.split("/").filter(Boolean).at(-1);
    if (ultimoDiretorioAlvo && ultimoDiretorioAlvo === ultimoDiretorioAncora) {
      scoreMaximo = Math.max(scoreMaximo, 4);
    }
  }

  return scoreMaximo;
}

export function pontuarProximidadeRotaConsumer(rota: string, rotasAncora: string[]): number {
  if (rotasAncora.length === 0) {
    return 0;
  }

  const rotaNormalizada = normalizarCaminhoRota(rota);
  const segmentosRota = rotaNormalizada.split("/").filter(Boolean);
  let scoreMaximo = 0;

  for (const ancora of rotasAncora) {
    const rotaAncora = normalizarCaminhoRota(ancora);
    if (rotaNormalizada === rotaAncora) {
      return 8;
    }

    const segmentosAncora = rotaAncora.split("/").filter(Boolean);
    if (segmentosRota[0] && segmentosRota[0] === segmentosAncora[0]) {
      scoreMaximo = Math.max(scoreMaximo, 4);
    }
  }

  return scoreMaximo;
}

export function caminhoConsumerParaTextoEscopo(contexto: ContextoProjetoCarregado, arquivo: string): string {
  return path.isAbsolute(arquivo)
    ? path.relative(contexto.baseProjeto, arquivo)
    : arquivo;
}

export function filtrarConsumerSurfacesPorEscopo(
  consumerSurfaces: RegistroConsumerSurfaceDrift[],
  consumerBridges: RegistroConsumerBridgeDrift[],
  contexto: ContextoProjetoCarregado,
  configuracao: ConfiguracaoEscopoDriftAplicada,
  relevancia?: ContextoRelevanciaConsumerDrift,
): {
  consumerSurfaces: RegistroConsumerSurfaceDrift[];
  consumerBridges: RegistroConsumerBridgeDrift[];
} {
  const raizesWorktreePermitidas = resolverRaizesIgnoradasPermitidas(contexto, DIRETORIOS_WORKTREE);
  const raizesConsumidorPermitidas = resolverRaizesIgnoradasPermitidas(contexto, DIRETORIOS_CONSUMIDOR_LATERAL);
  const limiar = configuracao.escopo === "arquivo" ? 5 : 4;
  const manterSurface = (surface: RegistroConsumerSurfaceDrift) => {
    if (configuracao.ignorarWorktrees
      && caminhoIgnoradoForaDoEscopoReal(surface.arquivo, DIRETORIOS_WORKTREE, raizesWorktreePermitidas)) {
      return false;
    }
    if (configuracao.ignorarConsumidoresLaterais
      && caminhoIgnoradoForaDoEscopoReal(surface.arquivo, DIRETORIOS_CONSUMIDOR_LATERAL, raizesConsumidorPermitidas)) {
      return false;
    }
    if (!configuracao.ignorarConsumidoresLaterais) {
      return true;
    }
    if (configuracao.escopo === "projeto") {
      return true;
    }

    const arquivoTexto = caminhoConsumerParaTextoEscopo(contexto, surface.arquivo);
    const scoreTexto = pontuarTextoEscopo(`${surface.rota} ${arquivoTexto} ${surface.tipoArquivo}`, configuracao.termosEscopo);
    const scoreRota = pontuarProximidadeRotaConsumer(surface.rota, relevancia?.rotasAncora ?? []);
    if (scoreTexto === 0 && scoreRota === 0) {
      return false;
    }
    const scoreArquivo = pontuarProximidadeArquivoConsumer(surface.arquivo, relevancia?.arquivosAncora ?? []);
    return scoreTexto + scoreArquivo + scoreRota >= limiar;
  };

  const manterBridge = (bridge: RegistroConsumerBridgeDrift) => {
    if (configuracao.ignorarWorktrees
      && caminhoIgnoradoForaDoEscopoReal(bridge.arquivo, DIRETORIOS_WORKTREE, raizesWorktreePermitidas)) {
      return false;
    }
    if (configuracao.ignorarConsumidoresLaterais
      && caminhoIgnoradoForaDoEscopoReal(bridge.arquivo, DIRETORIOS_CONSUMIDOR_LATERAL, raizesConsumidorPermitidas)) {
      return false;
    }
    if (!configuracao.ignorarConsumidoresLaterais) {
      return true;
    }
    if (configuracao.escopo === "projeto") {
      return true;
    }

    const arquivoTexto = caminhoConsumerParaTextoEscopo(contexto, bridge.arquivo);
    const scoreTexto = pontuarTextoEscopo(`${bridge.caminho} ${arquivoTexto} ${bridge.simbolo}`, configuracao.termosEscopo);
    if (scoreTexto === 0) {
      return false;
    }
    const scoreArquivo = pontuarProximidadeArquivoConsumer(bridge.arquivo, relevancia?.arquivosAncora ?? []);
    return scoreTexto + scoreArquivo >= limiar;
  };

  return {
    consumerSurfaces: consumerSurfaces.filter(manterSurface),
    consumerBridges: consumerBridges.filter(manterBridge),
  };
}

export const NOMES_RECURSO_IGNORADOS = new Set([
  "all",
  "and",
  "as",
  "by",
  "create",
  "delete",
  "from",
  "group",
  "inner",
  "into",
  "join",
  "left",
  "limit",
  "offset",
  "on",
  "or",
  "order",
  "outer",
  "returning",
  "right",
  "select",
  "set",
  "table",
  "update",
  "values",
  "view",
  "where",
]);

export const OPERACOES_REDIS_KEYSPACE = [
  "append",
  "decr",
  "del",
  "expire",
  "expireat",
  "get",
  "getdel",
  "getex",
  "getrange",
  "hdel",
  "hexists",
  "hget",
  "hgetall",
  "hincrby",
  "hkeys",
  "hlen",
  "hmget",
  "hmset",
  "hrandfield",
  "hscan",
  "hset",
  "hsetnx",
  "hvals",
  "incr",
  "incrby",
  "lindex",
  "llen",
  "lpop",
  "lpush",
  "lrange",
  "lrem",
  "lset",
  "rpop",
  "rpush",
  "sadd",
  "scard",
  "set",
  "setex",
  "setnx",
  "smembers",
  "spop",
  "srem",
  "ttl",
  "type",
  "zadd",
  "zcard",
  "zrange",
  "zrem",
];

export const OPERACOES_REDIS_STREAM = [
  "xadd",
  "xdel",
  "xgroupcreate",
  "xgroupdestroy",
  "xlen",
  "xrange",
  "xread",
  "xreadgroup",
  "xrevrange",
  "xtrim",
];

export function limparLiteralRecurso(valor: string): string {
  return valor
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\$\{[^}]+\}/g, "")
    .replace(/\{[^}]+\}/g, "")
    .replace(/%[sdifjo]/gi, "")
    .trim();
}

export function fecharPrefixoRecurso(valor: string): string {
  return valor.replace(/[:/_\-.]+$/g, "").trim();
}

export function normalizarNomeRecursoDrift(valor: string): string {
  return fecharPrefixoRecurso(limparLiteralRecurso(valor))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\s+/g, "");
}
