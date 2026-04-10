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
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { contarIndentacaoPython, extrairRotasFlaskDecoradas, normalizarCaminhoFlask } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import { extrairRotasTypeScriptHttp } from "./typescript-http.js";

interface SimboloResolvido {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  arquivo: string;
  simbolo: string;
}

type ConsumerFramework = "nextjs-consumer" | "react-vite-consumer" | "angular-consumer" | "flutter-consumer";

interface RotaResolvida {
  origem: "nestjs" | "fastapi" | "flask" | "nextjs" | ConsumerFramework | "firebase" | "dotnet" | "java" | "go" | "rust";
  metodo: string;
  caminho: string;
  arquivo: string;
  simbolo: string;
}

interface RegistroConsumerSurfaceDrift {
  rota: string;
  arquivo: string;
  tipoArquivo: string;
}

interface RegistroConsumerBridgeDrift {
  caminho: string;
  arquivo: string;
  simbolo: string;
}

export type EscopoDriftReal = "arquivo" | "modulo" | "projeto";

export interface OpcoesDriftLegado {
  escopo?: EscopoDriftReal;
  ignorarWorktrees?: boolean;
  ignorarConsumidoresLaterais?: boolean;
}

export interface DiagnosticoDrift {
  tipo: "impl_quebrado" | "task_sem_impl" | "rota_divergente" | "recurso_divergente" | "vinculo_quebrado" | "seguranca_frouxa";
  modulo: string;
  task?: string;
  route?: string;
  mensagem: string;
}

interface RegistroImplDrift {
  modulo: string;
  task: string;
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  arquivo?: string;
  simbolo?: string;
  caminhoResolvido?: string;
  status: "resolvido" | "quebrado";
  candidatos?: SimboloCandidatoDrift[];
}

interface RegistroRotaDivergente {
  modulo: string;
  route: string;
  metodo?: string;
  caminho?: string;
  motivo: string;
}

type OrigemRecursoDrift = "firebase" | EngineBanco | "arquivo";
type TipoRecursoDrift = "colecao" | TipoRecursoPersistencia | "arquivo_local";
type CategoriaPersistenciaDrift = "relacional" | "documental" | "chave_valor" | "local_arquivo" | "desconhecida";

interface RecursoResolvido {
  origem: OrigemRecursoDrift;
  nome: string;
  arquivo: string;
  simbolo?: string;
  tipo: TipoRecursoDrift;
}

interface RegistroRecursoDrift {
  modulo: string;
  task: string;
  categoria: "persistencia";
  alvo: string;
  arquivo: string;
  origem: OrigemRecursoDrift;
  tipo: TipoRecursoDrift;
  status: "resolvido" | "divergente";
}

interface RecursoEsperadoDrift {
  categoria: "persistencia";
  alvo: string;
  origem?: OrigemRecursoDrift;
  tiposAceitos: TipoRecursoDrift[];
  nomes: string[];
}

interface RegistroColunaPersistenciaDrift {
  origem: OrigemRecursoDrift;
  categoriaPersistencia: CategoriaPersistenciaDrift;
  recurso: string;
  coluna: string;
  arquivo: string;
}

interface RegistroRepositorioPersistenciaDrift {
  origem: OrigemRecursoDrift;
  categoriaPersistencia: CategoriaPersistenciaDrift;
  recurso: string;
  arquivo: string;
}

interface SimboloCandidatoDrift {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  arquivo: string;
  simbolo: string;
  confianca: "alta" | "media";
  motivo: string;
}

interface ResumoTaskDrift {
  modulo: string;
  task: string;
  impls: number;
  implsValidos: number;
  implsQuebrados: number;
  semImplementacao: boolean;
  scoreSemantico: number;
  confiancaVinculo: NivelConfiancaSemantica;
  riscoOperacional: NivelRiscoSemantico;
  lacunas: string[];
  arquivosReferenciados: string[];
  arquivosProvaveisEditar: string[];
  simbolosReferenciados: string[];
  candidatosImpl: SimboloCandidatoDrift[];
  checksSugeridos: string[];
}

interface RegistroVinculoDrift {
  modulo: string;
  donoTipo: "modulo" | "task" | "flow" | "route" | "superficie";
  dono: string;
  tipo: string;
  valor: string;
  arquivo?: string;
  simbolo?: string;
  status: "resolvido" | "parcial" | "nao_encontrado";
  confianca: NivelConfiancaSemantica;
}

export interface RegistroPersistenciaRealDrift {
  modulo: string;
  task: string;
  alvo: string;
  engine: OrigemRecursoDrift | "desconhecido";
  categoriaPersistencia: CategoriaPersistenciaDrift;
  tipo: TipoRecursoDrift;
  status: "materializado" | "parcial" | "divergente";
  arquivos: string[];
  colunas: string[];
  repositorios: string[];
  compatibilidade: "nativo" | "adaptado" | "parcial" | "invalido" | "desconhecida";
  motivoCompatibilidade?: string;
}

export interface ConfiguracaoEscopoDriftAplicada {
  escopo: EscopoDriftReal;
  ignorarWorktrees: boolean;
  ignorarConsumidoresLaterais: boolean;
  termosEscopo: string[];
}

export interface RegistroImpactoSemanticoArquivo {
  arquivo: string;
  tipo: "contrato" | "persistencia" | "repositorio" | "rota" | "worker" | "ui" | "teste" | "codigo";
  prioridade: "alta" | "media" | "baixa";
  linhas: number[];
  motivos: string[];
}

export interface ResultadoImpactoSemantico {
  comando: "impacto";
  sucesso: boolean;
  escopo: EscopoDriftReal;
  alvoSemantico: string;
  mudancaProposta: string;
  contratosAfetados: string[];
  tasksAfetadas: string[];
  routesAfetadas: string[];
  superficiesAfetadas: string[];
  persistenciaAfetada: string[];
  arquivos: RegistroImpactoSemanticoArquivo[];
  ordemOperacional: string[];
  validacoes: string[];
}

export interface SugestaoRenomeacaoSemantica {
  arquivo: string;
  linha: number;
  atual: string;
  sugerido: string;
  contexto: string;
}

export interface ResultadoRenomeacaoSemantica {
  comando: "renomear-semantico";
  sucesso: boolean;
  escopo: EscopoDriftReal;
  de: string;
  para: string;
  arquivos: RegistroImpactoSemanticoArquivo[];
  sugestoes: SugestaoRenomeacaoSemantica[];
  ordemOperacional: string[];
  validacoes: string[];
}

export interface ResultadoDrift {
  comando: "drift";
  sucesso: boolean;
  escopo_aplicado: ConfiguracaoEscopoDriftAplicada;
  consumerFramework: ConsumerFramework | null;
  appRoutes: string[];
  consumerSurfaces: RegistroConsumerSurfaceDrift[];
  consumerBridges: RegistroConsumerBridgeDrift[];
  modulos: Array<{
    caminho: string;
    modulo: string | null;
    tasks: number;
    routes: number;
  }>;
  tasks: ResumoTaskDrift[];
  impls_validos: RegistroImplDrift[];
  impls_quebrados: RegistroImplDrift[];
  vinculos_validos: RegistroVinculoDrift[];
  vinculos_quebrados: RegistroVinculoDrift[];
  rotas_divergentes: RegistroRotaDivergente[];
  recursos_validos: RegistroRecursoDrift[];
  recursos_divergentes: RegistroRecursoDrift[];
  persistencia_real: RegistroPersistenciaRealDrift[];
  resumo_operacional: {
    scoreMedio: number;
    confiancaGeral: NivelConfiancaSemantica;
    riscosPrincipais: string[];
    oQueTocar: string[];
    oQueValidar: string[];
    oQueEstaFrouxo: string[];
    oQueFoiInferido: string[];
  };
  diagnosticos: DiagnosticoDrift[];
}

const DIRETORIOS_IGNORADOS_BASE = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".dart_tool",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
  ".tmp",
  "generated",
]);

const DIRETORIOS_WORKTREE = [
  ".claude",
  "worktrees",
];

const DIRETORIOS_CONSUMIDOR_LATERAL = [
  "showcase",
  "showcases",
  "storybook",
  "stories",
  "playground",
  "sandbox",
  "fixture",
  "fixtures",
  "demo",
  "demos",
  "sample",
  "samples",
  "mini-web",
];

const TERMOS_ESCopo_IGNORADOS = new Set([
  "api",
  "app",
  "apps",
  "base",
  "codigo",
  "config",
  "controller",
  "controllers",
  "data",
  "drift",
  "flow",
  "int",
  "module",
  "modulo",
  "publico",
  "route",
  "routes",
  "schema",
  "sema",
  "service",
  "services",
  "src",
  "task",
  "tasks",
  "tests",
  "ui",
  "web",
]);

let diretoriosIgnoradosAtivos = new Set(DIRETORIOS_IGNORADOS_BASE);

function normalizarFragmentoArquivo(valor: string): string {
  return valor.replace(/\\/g, "/").replace(/^\.?\//, "").trim().toLowerCase();
}

function normalizarEscopoDrift(valor?: string): EscopoDriftReal {
  if (valor === "arquivo" || valor === "modulo" || valor === "projeto") {
    return valor;
  }
  return "modulo";
}

function resolverOpcoesDrift(opcoes?: OpcoesDriftLegado): Required<OpcoesDriftLegado> {
  return {
    escopo: normalizarEscopoDrift(opcoes?.escopo),
    ignorarWorktrees: opcoes?.ignorarWorktrees !== false,
    ignorarConsumidoresLaterais: opcoes?.ignorarConsumidoresLaterais !== false,
  };
}

function resolverDiretoriosIgnoradosAtivos(opcoes?: OpcoesDriftLegado): Set<string> {
  const resolvidas = resolverOpcoesDrift(opcoes);
  const diretorios = new Set(DIRETORIOS_IGNORADOS_BASE);
  if (resolvidas.ignorarWorktrees) {
    for (const diretorio of DIRETORIOS_WORKTREE) {
      diretorios.add(diretorio);
    }
  }
  if (resolvidas.ignorarConsumidoresLaterais) {
    for (const diretorio of DIRETORIOS_CONSUMIDOR_LATERAL) {
      diretorios.add(diretorio);
    }
  }
  return diretorios;
}

function quebrarTermosEscopo(valor: string): string[] {
  return paraIdentificadorModulo(valor)
    .split("_")
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !TERMOS_ESCopo_IGNORADOS.has(item));
}

function quebrarTermosModuloEscopo(nomeModulo: string): string[] {
  const segmentos = nomeModulo
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);
  const relevantes = segmentos.length > 1 ? segmentos.slice(1) : segmentos;
  return relevantes.flatMap((segmento) => quebrarTermosEscopo(segmento));
}

function extrairTermosEscopoDrift(contexto: ContextoProjetoCarregado, escopo: EscopoDriftReal): string[] {
  if (escopo === "projeto") {
    return [];
  }

  const termos = new Set<string>();
  const termosRaizProjeto = new Set(quebrarTermosEscopo(path.basename(contexto.baseProjeto)));
  if (escopo === "arquivo" || path.extname(contexto.entradaResolvida)) {
    termos.add(paraIdentificadorModulo(path.basename(contexto.entradaResolvida, path.extname(contexto.entradaResolvida))));
  }

  for (const modulo of contexto.modulosSelecionados) {
    const ir = modulo.resultado.ir;
    if (!ir) {
      continue;
    }
    for (const termo of quebrarTermosModuloEscopo(ir.nome)) {
      termos.add(termo);
    }
    for (const task of ir.tasks) {
      for (const termo of quebrarTermosEscopo(task.nome)) {
        termos.add(termo);
      }
    }
    for (const route of ir.routes) {
      for (const termo of quebrarTermosEscopo(route.nome)) {
        termos.add(termo);
      }
      if (route.caminho) {
        for (const termo of quebrarTermosEscopo(route.caminho)) {
          termos.add(termo);
        }
      }
    }
  }

  return [...termos]
    .filter((termo) => Boolean(termo) && !termosRaizProjeto.has(termo))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function categorizarPersistenciaPorOrigem(origem?: OrigemRecursoDrift): CategoriaPersistenciaDrift {
  switch (origem) {
    case "postgres":
    case "mysql":
    case "sqlite":
      return "relacional";
    case "mongodb":
    case "firebase":
      return "documental";
    case "redis":
      return "chave_valor";
    case "arquivo":
      return "local_arquivo";
    default:
      return "desconhecida";
  }
}

function caminhoTemSegmentoIgnorado(arquivo: string, segmentos: string[]): boolean {
  const partes = normalizarFragmentoArquivo(arquivo).split("/").filter(Boolean);
  return partes.some((parte) => segmentos.includes(parte));
}

function normalizarCaminhoComparacao(caminhoArquivo: string): string {
  return path.resolve(caminhoArquivo).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function caminhoEstaDentroDe(base: string, alvo: string): boolean {
  const baseNormalizada = normalizarCaminhoComparacao(base);
  const alvoNormalizado = normalizarCaminhoComparacao(alvo);
  return alvoNormalizado === baseNormalizada || alvoNormalizado.startsWith(`${baseNormalizada}/`);
}

function resolverRaizEscopoReal(contexto: ContextoProjetoCarregado): string {
  const entrada = path.resolve(contexto.entradaResolvida);
  return path.extname(entrada) ? path.dirname(entrada) : entrada;
}

function resolverRaizesExplicitasConfiguradas(contexto: ContextoProjetoCarregado): string[] {
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

function resolverRaizesIgnoradasPermitidas(
  contexto: ContextoProjetoCarregado,
  segmentosIgnorados: string[],
): string[] {
  return [...new Set([
    path.resolve(contexto.baseProjeto),
    resolverRaizEscopoReal(contexto),
    ...resolverRaizesExplicitasConfiguradas(contexto),
  ])]
    .filter((raiz) => caminhoTemSegmentoIgnorado(raiz, segmentosIgnorados))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function caminhoIgnoradoForaDoEscopoReal(
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

function filtrarCaminhosEscopoReal(
  caminhos: string[],
  contexto: ContextoProjetoCarregado,
  configuracao: Pick<ConfiguracaoEscopoDriftAplicada, "ignorarWorktrees" | "ignorarConsumidoresLaterais">,
): string[] {
  const raizesWorktreePermitidas = resolverRaizesIgnoradasPermitidas(contexto, DIRETORIOS_WORKTREE);
  const raizesConsumidorPermitidas = resolverRaizesIgnoradasPermitidas(contexto, DIRETORIOS_CONSUMIDOR_LATERAL);
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

function resolverDiretoriosCodigoEscopoReal(
  contexto: ContextoProjetoCarregado,
  configuracao: Pick<ConfiguracaoEscopoDriftAplicada, "ignorarWorktrees" | "ignorarConsumidoresLaterais">,
): string[] {
  return filtrarCaminhosEscopoReal(contexto.diretoriosCodigo, contexto, configuracao);
}

function textoCombinaEscopo(texto: string, termos: string[]): boolean {
  if (termos.length === 0) {
    return true;
  }
  const normalizado = paraIdentificadorModulo(texto);
  return termos.some((termo) => normalizado.includes(termo));
}

interface ContextoRelevanciaConsumerDrift {
  arquivosAncora: string[];
  rotasAncora: string[];
}

function construirContextoRelevanciaConsumer(
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

function pontuarTextoEscopo(texto: string, termos: string[]): number {
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

function pontuarProximidadeArquivoConsumer(arquivo: string, arquivosAncora: string[]): number {
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

function pontuarProximidadeRotaConsumer(rota: string, rotasAncora: string[]): number {
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

function filtrarConsumerSurfacesPorEscopo(
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
    if (configuracao.escopo === "projeto") {
      return true;
    }

    const score = pontuarTextoEscopo(`${surface.rota} ${surface.arquivo} ${surface.tipoArquivo}`, configuracao.termosEscopo)
      + pontuarProximidadeArquivoConsumer(surface.arquivo, relevancia?.arquivosAncora ?? [])
      + pontuarProximidadeRotaConsumer(surface.rota, relevancia?.rotasAncora ?? []);
    return score >= limiar;
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
    if (configuracao.escopo === "projeto") {
      return true;
    }

    const score = pontuarTextoEscopo(`${bridge.caminho} ${bridge.arquivo} ${bridge.simbolo}`, configuracao.termosEscopo)
      + pontuarProximidadeArquivoConsumer(bridge.arquivo, relevancia?.arquivosAncora ?? []);
    return score >= limiar;
  };

  return {
    consumerSurfaces: consumerSurfaces.filter(manterSurface),
    consumerBridges: consumerBridges.filter(manterBridge),
  };
}

const NOMES_RECURSO_IGNORADOS = new Set([
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

const OPERACOES_REDIS_KEYSPACE = [
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

const OPERACOES_REDIS_STREAM = [
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

function limparLiteralRecurso(valor: string): string {
  return valor
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\$\{[^}]+\}/g, "")
    .replace(/\{[^}]+\}/g, "")
    .replace(/%[sdifjo]/gi, "")
    .trim();
}

function fecharPrefixoRecurso(valor: string): string {
  return valor.replace(/[:/_\-.]+$/g, "").trim();
}

function normalizarNomeRecursoDrift(valor: string): string {
  return fecharPrefixoRecurso(limparLiteralRecurso(valor))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\s+/g, "");
}

function variantesNomeRecursoDrift(valor: string): string[] {
  const base = fecharPrefixoRecurso(limparLiteralRecurso(valor));
  if (!base) {
    return [];
  }

  const variantes = new Set<string>();
  const registrar = (candidato?: string) => {
    if (!candidato) {
      return;
    }
    const normalizado = normalizarNomeRecursoDrift(candidato);
    if (normalizado) {
      variantes.add(normalizado);
    }
  };

  registrar(base);
  registrar(base.replace(/[.:/_-]+/g, "_"));
  registrar(base.replace(/[.:/_-]+/g, ""));

  const partes = base.split(/[.:/_-]+/).filter(Boolean);
  if (partes.length > 1) {
    registrar(partes.join("_"));
    registrar(partes.join(""));
  }

  const singular = base.replace(/s$/i, "");
  if (singular && singular !== base) {
    registrar(singular);
  } else if (!/s$/i.test(base)) {
    registrar(`${base}s`);
  }

  return [...variantes];
}

function recursoEhIgnorado(nome: string): boolean {
  const normalizado = normalizarNomeRecursoDrift(nome);
  if (!normalizado || normalizado.length < 2) {
    return true;
  }
  return NOMES_RECURSO_IGNORADOS.has(normalizado);
}

function registrarRecursoDrift(
  recursos: Map<string, RecursoResolvido>,
  origem: OrigemRecursoDrift,
  tipo: TipoRecursoDrift,
  nome: string,
  arquivo: string,
  simbolo?: string,
): void {
  const nomeLimpo = fecharPrefixoRecurso(limparLiteralRecurso(nome));
  if (!nomeLimpo || recursoEhIgnorado(nomeLimpo)) {
    return;
  }

  const chave = `${origem}:${tipo}:${normalizarNomeRecursoDrift(nomeLimpo)}:${arquivo}:${simbolo ?? ""}`;
  if (!recursos.has(chave)) {
    recursos.set(chave, {
      origem,
      nome: nomeLimpo,
      arquivo,
      simbolo,
      tipo,
    });
  }
}

function inferirMotoresRelacionais(codigo: string, arquivo: string): EngineBanco[] {
  const motores = new Set<EngineBanco>();
  const caminho = normalizarFragmentoArquivo(arquivo);
  if (
    /\b(?:from|require)\s*\(?["'`]pg["'`]/i.test(codigo)
    || /\bpostgres(?:ql)?\b/i.test(codigo)
    || /\bon\s+conflict\b/i.test(codigo)
    || /\breturning\b/i.test(codigo)
    || /\bjsonb\b/i.test(codigo)
    || /\bilike\b/i.test(codigo)
    || /(?:^|\/)(?:postgres|pgsql)(?:\/|[-_.])/i.test(caminho)
  ) {
    motores.add("postgres");
  }
  if (
    /\b(?:from|require)\s*\(?["'`](?:mysql2?(?:\/promise)?|mysql)["'`]/i.test(codigo)
    || /\bon\s+duplicate\s+key\b/i.test(codigo)
    || /\bauto_increment\b/i.test(codigo)
    || /\binnodb\b/i.test(codigo)
    || /\bunsigned\b/i.test(codigo)
    || /(?:^|\/)mysql(?:\/|[-_.])/i.test(caminho)
  ) {
    motores.add("mysql");
  }
  if (
    /\b(?:from|require)\s*\(?["'`](?:sqlite3|better-sqlite3|bun:sqlite|sqlite)["'`]/i.test(codigo)
    || /\bpragma\b/i.test(codigo)
    || /\bwithout\s+rowid\b/i.test(codigo)
    || /\bsqlite\b/i.test(codigo)
    || /(?:^|\/)sqlite(?:\/|[-_.])/i.test(caminho)
  ) {
    motores.add("sqlite");
  }

  const temSqlGenerico = /\b(?:select\b[\s\S]*?\bfrom\b|insert\s+into|update\s+[A-Za-z_][\w$.-]*\s+set|delete\s+from|create\s+(?:table|view)|alter\s+table|drop\s+(?:table|view)|join\s+[A-Za-z_][\w$.-]*)/i.test(codigo)
    || /\.(?:from|into|table)\s*\(\s*["'`]/i.test(codigo)
    || /\b(?:knex|db|trx)\s*\(\s*["'`][A-Za-z_][^"'`]+["'`]\s*\)/i.test(codigo)
    || /\bprisma\.[A-Za-z_]\w*\.(?:find\w+|create|update|delete|upsert|aggregate|count)\b/i.test(codigo);
  if (temSqlGenerico && motores.size === 0) {
    motores.add("postgres");
    motores.add("mysql");
    motores.add("sqlite");
  }

  return [...motores];
}

function extrairRecursosSql(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();
  const motores = inferirMotoresRelacionais(codigo, arquivo);
  if (motores.length === 0) {
    return [];
  }

  const registrarParaMotores = (tipo: TipoRecursoDrift, nome: string) => {
    for (const motor of motores) {
      registrarRecursoDrift(recursos, motor, tipo, nome, arquivo);
    }
  };

  const registrarTextoSql = (texto: string) => {
    if (!/\b(?:select\b[\s\S]*?\bfrom\b|insert\s+into|update\s+[A-Za-z_][\w$.-]*\s+set|delete\s+from|create\s+(?:table|view)|alter\s+table|drop\s+(?:table|view)|join\s+[A-Za-z_][\w$.-]*|create\s+(?:unique\s+)?index)\b/i.test(texto)) {
      return;
    }

    for (const match of texto.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(table|view)\s+(?:if\s+not\s+exists\s+)?["'`]?([A-Za-z_][\w$.-]*)["'`]?/gi)) {
      registrarParaMotores(match[1]!.toLowerCase() as TipoRecursoDrift, match[2]!);
    }

    for (const match of texto.matchAll(/\bcreate\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?["'`]?([A-Za-z_][\w$.-]*)["'`]?/gi)) {
      registrarParaMotores("index", match[1]!);
    }

    for (const match of texto.matchAll(/\b(?:insert\s+into|update|from|join|delete\s+from|truncate\s+table)\s+["'`]?([A-Za-z_][\w$.-]*)["'`]?/gi)) {
      registrarParaMotores("table", match[1]!);
    }
  };

  if (/\.(?:sql|psql|ddl)$/i.test(arquivo)) {
    registrarTextoSql(codigo);
  } else {
    for (const literal of codigo.matchAll(/(["'`])([\s\S]*?)\1/g)) {
      registrarTextoSql(literal[2] ?? "");
    }
  }

  for (const match of codigo.matchAll(/\.(?:from|into|table)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/gi)) {
    registrarParaMotores("table", match[1]!);
  }

  for (const match of codigo.matchAll(/\b(?:knex|db|trx)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/gi)) {
    registrarParaMotores("table", match[1]!);
  }

  for (const match of codigo.matchAll(/\bprisma\.([A-Za-z_]\w*)\.(?:find\w+|create|update|delete|upsert|aggregate|count)\b/gi)) {
    registrarParaMotores("table", match[1]!);
  }

  return [...recursos.values()];
}

function extrairRecursosMongoDb(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();
  const contextoMongo = /\b(?:mongodb|mongoose|mongoclient|objectid)\b/i.test(codigo)
    || /\bdb\.collection\s*\(/i.test(codigo)
    || /(?:^|\/)mongo(?:db)?(?:\/|[-_.])/i.test(normalizarFragmentoArquivo(arquivo));
  if (!contextoMongo) {
    return [];
  }

  for (const match of codigo.matchAll(/\b(?:db\.)?collection\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/gi)) {
    registrarRecursoDrift(recursos, "mongodb", "collection", match[1]!, arquivo);
  }

  for (const match of codigo.matchAll(/\bgetCollection\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/gi)) {
    registrarRecursoDrift(recursos, "mongodb", "collection", match[1]!, arquivo);
  }

  for (const match of codigo.matchAll(/\bmongoose\.model\s*\(\s*["'`]([^"'`]+)["'`](?:\s*,[\s\S]*?,\s*["'`]([^"'`]+)["'`])?/gi)) {
    registrarRecursoDrift(recursos, "mongodb", "document", match[1]!, arquivo);
    if (match[2]) {
      registrarRecursoDrift(recursos, "mongodb", "collection", match[2], arquivo);
    }
  }

  for (const match of codigo.matchAll(/\bdb\.([A-Za-z_]\w*)\.(?:find|findOne|aggregate|insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|countDocuments)\b/gi)) {
    registrarRecursoDrift(recursos, "mongodb", "collection", match[1]!, arquivo);
  }

  return [...recursos.values()];
}

function extrairRecursosRedis(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();
  const contextoRedis = /\b(?:from|require)\s*\(?["'`](?:redis|ioredis)["'`]/i.test(codigo)
    || /\bcreateClient\s*\(/i.test(codigo)
    || /\bx(?:add|read|readgroup|groupcreate|groupdestroy)\s*\(/i.test(codigo)
    || /(?:^|\/)redis(?:\/|[-_.])/i.test(normalizarFragmentoArquivo(arquivo));
  if (!contextoRedis) {
    return [];
  }

  const operacoesKeyspace = OPERACOES_REDIS_KEYSPACE.join("|");
  const operacoesStream = OPERACOES_REDIS_STREAM.join("|");
  const padraoKeyspace = new RegExp(`\\b(?:${operacoesKeyspace})\\s*\\(\\s*['"\\\`]([^'"\\\`]+)['"\\\`]`, "gi");
  const padraoStream = new RegExp(`\\b(?:${operacoesStream})\\s*\\(\\s*['"\\\`]([^'"\\\`]+)['"\\\`]`, "gi");

  for (const match of codigo.matchAll(padraoKeyspace)) {
    registrarRecursoDrift(recursos, "redis", "keyspace", match[1]!, arquivo);
  }

  for (const match of codigo.matchAll(padraoStream)) {
    registrarRecursoDrift(recursos, "redis", "stream", match[1]!, arquivo);
  }

  return [...recursos.values()];
}

function extrairRecursosArquivoLocal(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();
  const contextoArquivoLocal = /\b(?:json|jsonl|ndjson)\b/i.test(codigo)
    || /\b(?:read_text|write_text|readFile(?:Sync)?|writeFile(?:Sync)?|open)\b/i.test(codigo)
    || /\.(?:json|jsonl|ndjson|db|sqlite|sqlite3)\b/i.test(codigo)
    || /(?:repository|repositories|repositorio|repo|store|storage|persist|cache)/i.test(normalizarFragmentoArquivo(arquivo));
  if (!contextoArquivoLocal) {
    return [];
  }

  for (const match of codigo.matchAll(/["'`]([^"'`]+\.(?:json|jsonl|ndjson|db|sqlite|sqlite3))["'`]/gi)) {
    const literal = match[1] ?? "";
    const nomeBase = path.basename(literal, path.extname(literal));
    registrarRecursoDrift(recursos, "arquivo", "arquivo_local", nomeBase, arquivo);
  }

  const nomeArquivo = path.basename(arquivo).replace(/\.(?:ts|tsx|js|jsx|mjs|cjs|py|dart|cs|java|go|rs|cpp|cc|cxx|hpp|h)$/i, "");
  const nomeStore = nomeArquivo
    .replace(/(?:[_.-]?(?:repository|repositories|repo|store|storage|persistencia|persistence))$/i, "")
    .trim();
  if (nomeStore && /(?:repository|repositories|repositorio|repo|store|storage|persist|cache)/i.test(nomeArquivo)) {
    registrarRecursoDrift(recursos, "arquivo", "arquivo_local", nomeStore, arquivo);
  }

  return [...recursos.values()];
}

function extrairRecursosPersistenciaCodigoVivo(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();

  for (const recurso of extrairColecoesFirebase(arquivo, codigo)) {
    registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
  }
  for (const recurso of extrairRecursosSql(arquivo, codigo)) {
    registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
  }
  for (const recurso of extrairRecursosMongoDb(arquivo, codigo)) {
    registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
  }
  for (const recurso of extrairRecursosRedis(arquivo, codigo)) {
    registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
  }
  for (const recurso of extrairRecursosArquivoLocal(arquivo, codigo)) {
    registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
  }

  return [...recursos.values()];
}

function extrairRecursosPrisma(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();
  const provider = codigo.match(/\bprovider\s*=\s*["'`](postgresql|mysql|sqlite)["'`]/i)?.[1]?.toLowerCase();
  const origem = provider === "postgresql"
    ? "postgres"
    : provider === "mysql"
      ? "mysql"
      : provider === "sqlite"
        ? "sqlite"
        : undefined;
  if (!origem) {
    return [];
  }

  for (const match of codigo.matchAll(/\bmodel\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\n\}/g)) {
    const nomeModelo = match[1]!;
    const corpo = match[2] ?? "";
    const tabelaMapeada = corpo.match(/@@map\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/)?.[1];
    registrarRecursoDrift(recursos, origem, "table", tabelaMapeada ?? nomeModelo, arquivo);
    if (tabelaMapeada) {
      registrarRecursoDrift(recursos, origem, "table", nomeModelo, arquivo);
    }
  }

  return [...recursos.values()];
}

function escolherArquivoPorVinculo(arquivos: string[], valor: string): { arquivo?: string; confianca: NivelConfiancaSemantica; status: RegistroVinculoDrift["status"] } {
  const normalizado = normalizarFragmentoArquivo(valor);
  const exato = arquivos.find((arquivo) => normalizarFragmentoArquivo(arquivo) === normalizado);
  if (exato) {
    return { arquivo: exato, confianca: "alta", status: "resolvido" };
  }

  const porSufixo = arquivos.find((arquivo) => normalizarFragmentoArquivo(arquivo).endsWith(normalizado));
  if (porSufixo) {
    return { arquivo: porSufixo, confianca: "media", status: "parcial" };
  }

  return { confianca: "baixa", status: "nao_encontrado" };
}

function escolherSimboloPorVinculo(
  simbolos: SimboloResolvido[],
  mapaImpl: Map<string, SimboloResolvido>,
  valor: string,
): { simbolo?: SimboloResolvido; confianca: NivelConfiancaSemantica; status: RegistroVinculoDrift["status"] } {
  const exato = mapaImpl.get(valor);
  if (exato) {
    return { simbolo: exato, confianca: "alta", status: "resolvido" };
  }

  const ultimoSegmento = valor.split(".").at(-1)?.toLowerCase();
  const aproximado = simbolos.find((simbolo) =>
    simbolo.caminho.toLowerCase() === valor.toLowerCase()
    || simbolo.simbolo.toLowerCase() === ultimoSegmento
    || simbolo.caminho.toLowerCase().endsWith(`.${ultimoSegmento}`));

  if (aproximado) {
    return { simbolo: aproximado, confianca: "media", status: "parcial" };
  }

  return { confianca: "baixa", status: "nao_encontrado" };
}

function resolverArquivoOuSimboloAncora(
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

function encontrarAncoraSuperficie(
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

function calcularRiscoOperacional(task: IrTask): NivelRiscoSemantico {
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

function calcularConfiancaTask(
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

function calcularScoreTask(
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

function resumirLacunasTask(
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

function resumirOperacional(resultado: Omit<ResultadoDrift, "comando" | "sucesso">): ResultadoDrift["resumo_operacional"] {
  const scoreMedio = resultado.tasks.length > 0
    ? Math.round(resultado.tasks.reduce((total, task) => total + task.scoreSemantico, 0) / resultado.tasks.length)
    : 0;
  const confiancaGeral: NivelConfiancaSemantica = scoreMedio >= 80 ? "alta" : scoreMedio >= 55 ? "media" : "baixa";
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
    confiancaGeral,
    riscosPrincipais,
    oQueTocar,
    oQueValidar,
    oQueEstaFrouxo,
    oQueFoiInferido,
  };
}

function paraIdentificadorModulo(valor: string): string {
  return valor
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function extrairTextoLiteral(expr?: ts.Expression): string | undefined {
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

function listarDecoradores(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
}

function lerDecorator(node: ts.Node, nomes: string[]): { nome: string; argumentos: ts.NodeArray<ts.Expression> } | undefined {
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

function juntarCaminhoHttp(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base ?? "", sufixo ?? ""]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\/+|\/+$/g, ""));

  const caminho = `/${partes.join("/")}`.replace(/\/+/g, "/");
  return caminho === "//" ? "/" : caminho;
}

async function listarArquivosRecursivos(diretorio: string, extensoes: string[]): Promise<string[]> {
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

function caminhosSimbolicos(baseDiretorio: string, arquivo: string): string[] {
  const relativo = path.relative(baseDiretorio, arquivo).replace(/\.[^.]+$/, "");
  const semPrefixo = relativo
    .split(path.sep)
    .map((segmento) => paraIdentificadorModulo(segmento))
    .filter(Boolean)
    .join(".");
  const prefixo = paraIdentificadorModulo(path.basename(baseDiretorio));
  const comPrefixo = prefixo ? [prefixo, semPrefixo].filter(Boolean).join(".") : semPrefixo;
  return [...new Set([semPrefixo, comPrefixo].filter(Boolean))];
}

function registrarSimboloTypeScript(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  nome: string,
  nomeClasse?: string,
): void {
  for (const baseSimbolica of basesSimbolicas) {
    const caminho = nomeClasse
      ? `${baseSimbolica}.${nomeClasse}.${nome}`
      : `${baseSimbolica}.${nome}`;
    simbolos.set(caminho, {
      origem: "ts",
      caminho,
      arquivo,
      simbolo: nomeClasse ? `${nomeClasse}.${nome}` : nome,
    });
  }
}

function desembrulharExpressaoTypeScript(expr: ts.Expression): ts.Expression {
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

function extrairNomePropriedadeTypeScript(nome: ts.PropertyName, sourceFile: ts.SourceFile): string | undefined {
  if (ts.isIdentifier(nome) || ts.isStringLiteralLike(nome) || ts.isNumericLiteral(nome)) {
    return nome.text;
  }
  if (ts.isComputedPropertyName(nome) && ts.isStringLiteralLike(nome.expression)) {
    return nome.expression.text;
  }
  const texto = nome.getText(sourceFile).trim();
  return texto.length > 0 ? texto : undefined;
}

function extrairNomeClassePrototypeTypeScript(expr: ts.Expression, sourceFile: ts.SourceFile): string | undefined {
  const alvo = desembrulharExpressaoTypeScript(expr);
  if (ts.isPropertyAccessExpression(alvo) && alvo.name.text === "prototype") {
    return alvo.expression.getText(sourceFile).trim() || undefined;
  }
  return undefined;
}

function registrarMetodoTypeScriptProtoOuObjeto(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  nomeMetodo: string,
  nomeClasse?: string,
): void {
  if (!nomeMetodo) {
    return;
  }
  if (nomeClasse) {
    registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, nomeMetodo, nomeClasse);
  }
  registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, nomeMetodo);
}

function registrarMetodosObjectAssignTypeScript(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  objeto: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  nomeClasse?: string,
): void {
  for (const propriedade of objeto.properties) {
    if (ts.isMethodDeclaration(propriedade) && propriedade.name) {
      const nomeMetodo = extrairNomePropriedadeTypeScript(propriedade.name, sourceFile);
      if (nomeMetodo) {
        registrarMetodoTypeScriptProtoOuObjeto(simbolos, basesSimbolicas, arquivo, nomeMetodo, nomeClasse);
      }
      continue;
    }

    if (!ts.isPropertyAssignment(propriedade)) {
      continue;
    }

    const nomeMetodo = extrairNomePropriedadeTypeScript(propriedade.name, sourceFile);
    const valor = desembrulharExpressaoTypeScript(propriedade.initializer);
    if (nomeMetodo && (ts.isFunctionExpression(valor) || ts.isArrowFunction(valor))) {
      registrarMetodoTypeScriptProtoOuObjeto(simbolos, basesSimbolicas, arquivo, nomeMetodo, nomeClasse);
    }
  }
}

function registrarAtribuicaoPrototypeTypeScript(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  sourceFile: ts.SourceFile,
  esquerda: ts.Expression,
  direita: ts.Expression,
): void {
  const alvo = desembrulharExpressaoTypeScript(esquerda);
  const valor = desembrulharExpressaoTypeScript(direita);
  if (!ts.isPropertyAccessExpression(alvo) || !ts.isPropertyAccessExpression(alvo.expression)) {
    return;
  }
  if (alvo.expression.name.text !== "prototype") {
    return;
  }
  if (!ts.isFunctionExpression(valor) && !ts.isArrowFunction(valor)) {
    return;
  }

  const nomeClasse = alvo.expression.expression.getText(sourceFile).trim();
  const nomeMetodo = alvo.name.getText(sourceFile).trim();
  registrarMetodoTypeScriptProtoOuObjeto(simbolos, basesSimbolicas, arquivo, nomeMetodo, nomeClasse || undefined);
}

function normalizarRelacaoConsumer(relacaoArquivo: string): string {
  return relacaoArquivo.replace(/\\/g, "/");
}

function normalizarSegmentoRotaConsumer(segmento: string): string {
  const opcionalCatchAll = segmento.match(/^\[\[\.\.\.([A-Za-z_]\w*)\]\]$/);
  if (opcionalCatchAll) {
    return `{${opcionalCatchAll[1]}}`;
  }
  const catchAll = segmento.match(/^\[\.\.\.([A-Za-z_]\w*)\]$/);
  if (catchAll) {
    return `{${catchAll[1]}}`;
  }
  const dinamico = segmento.match(/^\[([A-Za-z_]\w*)\]$/);
  if (dinamico) {
    return `{${dinamico[1]}}`;
  }
  return segmento;
}

function montarRotaConsumer(partes: string[]): string {
  const filtradas = partes
    .filter((segmento) => segmento && segmento !== "index" && !/^\(.*\)$/.test(segmento) && !segmento.startsWith("@"))
    .map(normalizarSegmentoRotaConsumer);
  return filtradas.length > 0 ? `/${filtradas.join("/")}`.replace(/\/+/g, "/") : "/";
}

function arquivoEhBridgeNextJsConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

function arquivoEhBridgeReactViteConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

function arquivoEhBridgeAngularConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|js)$/i.test(relacao);
}

function arquivoEhSuperficieNextJsConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/(?:(?!api\/).)*?(?:page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

function arquivoEhSuperficieReactViteConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /^(?:src\/)?pages\/.+\.(?:ts|tsx|js|jsx)$/i.test(relacao)
    || /^(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

function arquivoEhRotasReactViteConsumer(relacaoArquivo: string, codigo?: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?(?:app\/)?(?:router|routes)\.(?:ts|tsx|js|jsx)$/i.test(relacao)
    || /from\s+["']react-router-dom["']|createBrowserRouter|RouterProvider|useRoutes\s*\(|<Routes\b|<Route\b/.test(codigo ?? "");
}

function arquivoEhRotasAngularConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app(?:\/.+)?\/[^/]+\.routes\.(?:ts|js)$/i.test(relacao);
}

function arquivoEhRotasAngularConsumerRaiz(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/[^/]+\.routes\.(?:ts|js)$/i.test(relacao);
}

function arquivoEhBridgeFlutterConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:sema_consumer_bridge|api\/sema_contract_bridge|sema\/.+)\.dart$/i.test(relacao);
}

function arquivoEhSuperficieFlutterConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:screens|pages)\/.+\.dart$/i.test(relacao)
    || /(?:^|\/)(?:lib\/)?main\.dart$/i.test(relacao);
}

function arquivoEhRotasFlutterConsumer(relacaoArquivo: string, codigo?: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:router|app_router|routes)\.dart$/i.test(relacao)
    || /MaterialApp(?:\.router)?\s*\(|CupertinoApp(?:\.router)?\s*\(|GoRouter\s*\(/.test(codigo ?? "");
}

function inferirRotaNextJsConsumer(relacaoArquivo: string): RegistroConsumerSurfaceDrift | undefined {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  const segmentos = relacao.split("/");
  const indiceSrcApp = segmentos.findIndex((segmento, indice) => segmento === "src" && segmentos[indice + 1] === "app");
  const indiceApp = segmentos.findIndex((segmento) => segmento === "app");
  const inicioApp = indiceSrcApp >= 0 ? indiceSrcApp + 2 : indiceApp >= 0 ? indiceApp + 1 : -1;
  if (inicioApp < 0) {
    return undefined;
  }

  const arquivoFinal = segmentos.at(-1) ?? "";
  const tipoArquivo = arquivoFinal.match(/^(page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/)?.[1] as RegistroConsumerSurfaceDrift["tipoArquivo"] | undefined;
  if (!tipoArquivo) {
    return undefined;
  }

  const caminhoAteArquivo = segmentos.slice(inicioApp, -1);
  if (caminhoAteArquivo[0] === "api") {
    return undefined;
  }

  return {
    rota: montarRotaConsumer(caminhoAteArquivo),
    arquivo: relacaoArquivo,
    tipoArquivo,
  };
}

function inferirRotaReactViteConsumer(relacaoArquivo: string): RegistroConsumerSurfaceDrift | undefined {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  if (/(?:^|\/)(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(relacao)) {
    return {
      rota: "/",
      arquivo: relacaoArquivo,
      tipoArquivo: "app",
    };
  }

  const segmentos = relacao.split("/");
  const indiceSrcPages = segmentos.findIndex((segmento, indice) => segmento === "src" && segmentos[indice + 1] === "pages");
  const indicePages = segmentos.findIndex((segmento) => segmento === "pages");
  const inicioPages = indiceSrcPages >= 0 ? indiceSrcPages + 2 : indicePages >= 0 ? indicePages + 1 : -1;
  if (inicioPages < 0) {
    return undefined;
  }

  const arquivoFinal = segmentos.at(-1) ?? "";
  const nomeBase = arquivoFinal.replace(/\.(?:ts|tsx|js|jsx)$/i, "");
  return {
    rota: montarRotaConsumer([...segmentos.slice(inicioPages, -1), nomeBase]),
    arquivo: relacaoArquivo,
    tipoArquivo: "page",
  };
}

function inferirRotaFlutterConsumer(relacaoArquivo: string): RegistroConsumerSurfaceDrift | undefined {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  if (!arquivoEhSuperficieFlutterConsumer(relacao)) {
    return undefined;
  }
  if (/(?:^|\/)(?:lib\/)?main\.dart$/i.test(relacao)) {
    return {
      rota: "/",
      arquivo: relacaoArquivo,
      tipoArquivo: "app",
    };
  }

  const segmentos = relacao.split("/");
  const indiceLibScreens = segmentos.findIndex((segmento, indice) => segmento === "lib" && ["screens", "pages"].includes(segmentos[indice + 1] ?? ""));
  const indiceScreens = segmentos.findIndex((segmento) => segmento === "screens" || segmento === "pages");
  const inicio = indiceLibScreens >= 0 ? indiceLibScreens + 2 : indiceScreens >= 0 ? indiceScreens + 1 : -1;
  if (inicio < 0) {
    return undefined;
  }

  const arquivoFinal = segmentos.at(-1) ?? "";
  const nomeBase = arquivoFinal
    .replace(/\.(?:dart)$/i, "")
    .replace(/_(screen|page)$/i, "");
  return {
    rota: montarRotaConsumer([...segmentos.slice(inicio, -1), nomeBase]),
    arquivo: relacaoArquivo,
    tipoArquivo: "screen",
  };
}

interface RotaReactViteConsumerDrift {
  rota: string;
  arquivoRotas: string;
  arquivoComponente?: string;
}

interface RotaFlutterConsumerDrift {
  rota: string;
  arquivoRotas: string;
}

interface RotaAngularConsumerDrift {
  rota: string;
  arquivoRotas: string;
  componente?: string;
  arquivoComponente?: string;
  arquivoRotasFilhas?: string;
}

function normalizarRotaDeclaradaConsumer(caminhoCru: string, prefixo = "/"): string {
  const partesPrefixo = prefixo.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const partesCaminho = (caminhoCru ?? "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  return montarRotaConsumer([...partesPrefixo, ...partesCaminho]);
}

function resolverImportRelativoConsumer(relacaoArquivoBase: string, especificador: string): string | undefined {
  if (!especificador.startsWith(".")) {
    return undefined;
  }
  const baseDir = path.posix.dirname(normalizarRelacaoConsumer(relacaoArquivoBase));
  for (const sufixo of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"]) {
    const candidato = path.posix.normalize(path.posix.join(baseDir, `${especificador}${sufixo}`));
    if (/\.(?:ts|tsx|js|jsx)$/i.test(candidato)) {
      return candidato;
    }
  }
  return undefined;
}

function extrairImportsTypeScriptConsumer(relacaoArquivo: string, codigo: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const match of codigo.matchAll(/import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["']/g)) {
    const arquivoImportado = resolverImportRelativoConsumer(relacaoArquivo, match[2]);
    if (!arquivoImportado) {
      continue;
    }
    for (const bruto of match[1].split(",")) {
      const local = bruto.trim().split(/\s+as\s+/i).at(-1)?.trim();
      if (local) {
        imports.set(local, arquivoImportado);
      }
    }
  }
  for (const match of codigo.matchAll(/import\s+([A-Za-z_]\w*)\s+from\s*["']([^"']+)["']/g)) {
    const arquivoImportado = resolverImportRelativoConsumer(relacaoArquivo, match[2]);
    const local = match[1]?.trim();
    if (arquivoImportado && local) {
      imports.set(local, arquivoImportado);
    }
  }
  return imports;
}

function extrairRotasReactViteConsumer(relacaoArquivo: string, codigo: string): RotaReactViteConsumerDrift[] {
  const imports = extrairImportsTypeScriptConsumer(relacaoArquivo, codigo);
  const rotas = new Map<string, RotaReactViteConsumerDrift>();
  const registrar = (caminhoCru: string, componente?: string) => {
    const rota = normalizarRotaDeclaradaConsumer(caminhoCru);
    const chave = `${rota}:${normalizarRelacaoConsumer(relacaoArquivo)}:${componente ?? "router"}`;
    rotas.set(chave, {
      rota,
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
      arquivoComponente: componente ? imports.get(componente) : undefined,
    });
  };

  for (const match of codigo.matchAll(/(?:path\s*:\s*["'`]([^"'`]*)["'`]|index\s*:\s*true)[\s\S]{0,260}?(?:element\s*:\s*<\s*([A-Za-z_]\w*)|Component\s*:\s*([A-Za-z_]\w*))/g)) {
    const caminhoCru = match[1] ?? "";
    const componente = match[2] ?? match[3];
    registrar(caminhoCru, componente);
  }

  for (const match of codigo.matchAll(/<Route\b[^>]*?(?:path=["'`]([^"'`]*)["'`][^>]*?)?(index\b)?[^>]*?(?:element=\{\s*<\s*([A-Za-z_]\w*)|Component=\{\s*([A-Za-z_]\w*))/g)) {
    const caminhoCru = match[2] ? "" : (match[1] ?? "");
    const componente = match[3] ?? match[4];
    registrar(caminhoCru, componente);
  }

  return [...rotas.values()];
}

function normalizarRotaDeclaradaFlutter(caminhoCru: string): string {
  return montarRotaConsumer((caminhoCru ?? "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean));
}

function extrairRotasFlutterConsumer(relacaoArquivo: string, codigo: string): RotaFlutterConsumerDrift[] {
  const rotas = new Map<string, RotaFlutterConsumerDrift>();
  const registrar = (caminhoCru: string) => {
    const rota = normalizarRotaDeclaradaFlutter(caminhoCru);
    rotas.set(`${rota}:${normalizarRelacaoConsumer(relacaoArquivo)}`, {
      rota,
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
    });
  };

  for (const match of codigo.matchAll(/GoRoute\s*\([\s\S]{0,220}?path\s*:\s*["'`]([^"'`]+)["'`]/g)) {
    registrar(match[1] ?? "");
  }

  for (const match of codigo.matchAll(/["'`]([^"'`]+)["'`]\s*:\s*\([^)]*\)\s*=>/g)) {
    registrar(match[1] ?? "");
  }

  if (/home\s*:\s*(?:const\s+)?[A-Za-z_]\w*\(/.test(codigo)) {
    registrar("/");
  }

  return [...rotas.values()];
}

function extrairRotasAngularConsumerDiretas(relacaoArquivo: string, codigo: string, prefixo = "/"): RotaAngularConsumerDrift[] {
  const imports = extrairImportsTypeScriptConsumer(relacaoArquivo, codigo);

  const rotas: RotaAngularConsumerDrift[] = [];
  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,320}?component\s*:\s*([A-Za-z_]\w*)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const componente = match[2];
    rotas.push({
      rota: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
      componente,
      arquivoComponente: imports.get(componente),
    });
  }

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,320}?loadComponent\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const arquivoComponente = resolverImportRelativoConsumer(relacaoArquivo, match[2] ?? "");
    rotas.push({
      rota: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
      arquivoComponente,
    });
  }

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,360}?loadChildren\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const arquivoRotasFilhas = resolverImportRelativoConsumer(relacaoArquivo, match[2] ?? "");
    rotas.push({
      rota: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
      arquivoRotasFilhas,
    });
  }

  return rotas;
}

async function extrairRotasAngularConsumer(
  diretorioBase: string,
  relacaoArquivo: string,
  prefixo = "/",
  visitados = new Set<string>(),
): Promise<RotaAngularConsumerDrift[]> {
  const relacaoNormalizada = normalizarRelacaoConsumer(relacaoArquivo);
  if (visitados.has(relacaoNormalizada)) {
    return [];
  }
  visitados.add(relacaoNormalizada);

  let codigo = "";
  try {
    codigo = await readFile(path.join(diretorioBase, relacaoNormalizada), "utf8");
  } catch {
    return [];
  }

  const rotas = extrairRotasAngularConsumerDiretas(relacaoNormalizada, codigo, prefixo);
  const filhas: RotaAngularConsumerDrift[] = [];
  for (const rota of rotas) {
    if (!rota.arquivoRotasFilhas) {
      continue;
    }
    filhas.push(...await extrairRotasAngularConsumer(diretorioBase, rota.arquivoRotasFilhas, rota.rota, visitados));
  }
  return [...rotas, ...filhas];
}

function simboloEhBridgeConsumer(caminho: string, arquivo: string): boolean {
  return arquivoEhBridgeNextJsConsumer(arquivo)
    || arquivoEhBridgeReactViteConsumer(arquivo)
    || arquivoEhBridgeAngularConsumer(arquivo)
    || arquivoEhBridgeFlutterConsumer(arquivo)
    || /(?:^|\.)(?:src\.)?lib\.(?:sema_consumer_bridge|sema\.)/i.test(caminho)
    || /(?:^|\.)(?:src\.)?app\.(?:sema_consumer_bridge|sema\.)/i.test(caminho)
    || /(?:^|\.)(?:lib\.)?(?:sema_consumer_bridge|api\.sema_contract_bridge|sema\.)/i.test(caminho);
}

function inferirConsumerFrameworkPrincipal(
  fontesLegado: FonteLegado[],
  consumerSurfaces: RegistroConsumerSurfaceDrift[],
  consumerBridges: RegistroConsumerBridgeDrift[],
): ConsumerFramework | null {
  const arquivos = [
    ...consumerSurfaces.map((item) => item.arquivo),
    ...consumerBridges.map((item) => item.arquivo),
  ].map(normalizarRelacaoConsumer);
  if (arquivos.some((arquivo) => /(?:^|\/)(?:src\/)?app\/(?:(?!api\/).)*?(?:page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/i.test(arquivo))) {
    return "nextjs-consumer";
  }
  if (arquivos.some((arquivo) =>
    /^(?:src\/)?pages\/.+\.(?:ts|tsx|js|jsx)$/i.test(arquivo)
    || /^(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(arquivo)
    || /(?:^|\/)(?:src\/)?(?:app\/)?(?:router|routes)\.(?:ts|tsx|js|jsx)$/i.test(arquivo))) {
    return "react-vite-consumer";
  }
  if (arquivos.some((arquivo) => /(?:^|\/)(?:src\/)?app\/.+\.component\.(?:ts|js)$/i.test(arquivo) || arquivoEhRotasAngularConsumer(arquivo))) {
    return "angular-consumer";
  }
  if (arquivos.some((arquivo) =>
    /(?:^|\/)(?:lib\/)?(?:screens|pages)\/.+\.dart$/i.test(arquivo)
    || /(?:^|\/)(?:lib\/)?(?:router|app_router|routes|main)\.dart$/i.test(arquivo))) {
    return "flutter-consumer";
  }
  for (const framework of ["nextjs-consumer", "react-vite-consumer", "angular-consumer", "flutter-consumer"] as const) {
    if (fontesLegado.includes(framework)) {
      return framework;
    }
  }
  return null;
}

function extrairColecoesFirebase(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();
  const registrar = (nome: string) => {
    if (!nome) {
      return;
    }
    recursos.set(`${nome}:${arquivo}`, {
      origem: "firebase",
      nome,
      arquivo,
      tipo: "colecao",
    });
  };

  for (const match of codigo.matchAll(/\b(?:export\s+)?const\s+\w*COLLECTIONS?\w*\s*=\s*\{([\s\S]*?)\n\}/g)) {
    const corpo = match[1] ?? "";
    for (const valor of corpo.matchAll(/:\s*["'`]([^"'`]+)["'`]/g)) {
      registrar(valor[1]!);
    }
  }

  for (const match of codigo.matchAll(/\b(?:db\.)?collection\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    registrar(match[1]!);
  }

  for (const match of codigo.matchAll(/\bdoc\s*\(\s*[^,]+,\s*["'`]([^"'`]+)["'`]/g)) {
    registrar(match[1]!);
  }

  return [...recursos.values()];
}

async function indexarTypeScript(diretorios: string[]): Promise<{
  simbolos: SimboloResolvido[];
  rotas: RotaResolvida[];
  recursos: RecursoResolvido[];
  consumerSurfaces: RegistroConsumerSurfaceDrift[];
}> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();
  const consumerSurfaces = new Map<string, RegistroConsumerSurfaceDrift>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]))
      .filter((arquivo) =>
        !arquivo.endsWith(".d.ts")
        && !arquivo.endsWith(".spec.ts")
        && !arquivo.endsWith(".test.ts"),
      );
    const arquivosRotasAngular = arquivos.filter((arquivo) => arquivoEhRotasAngularConsumer(path.relative(diretorio, arquivo)));
    const arquivosRotasAngularRaiz = new Set(
      arquivosRotasAngular
        .filter((arquivo) => arquivoEhRotasAngularConsumerRaiz(path.relative(diretorio, arquivo)))
        .map((arquivo) => path.resolve(arquivo)),
    );
    const usarApenasRotasAngularRaiz = arquivosRotasAngularRaiz.size > 0;

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const scriptKind = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKind);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      const relacao = path.relative(diretorio, arquivo);

      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }

      for (const rota of extrairRotasTypeScriptHttp(sourceFile, relacao)) {
        rotas.push({
          origem: rota.origem,
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }

      const superficieNextJs = arquivoEhSuperficieNextJsConsumer(relacao)
        ? inferirRotaNextJsConsumer(relacao)
        : undefined;
      if (superficieNextJs) {
        consumerSurfaces.set(`${superficieNextJs.rota}:${arquivo}:${superficieNextJs.tipoArquivo}`, {
          rota: superficieNextJs.rota,
          arquivo,
          tipoArquivo: superficieNextJs.tipoArquivo,
        });
        rotas.push({
          origem: "nextjs-consumer",
          metodo: "VIEW",
          caminho: superficieNextJs.rota,
          arquivo,
          simbolo: superficieNextJs.tipoArquivo,
        });
      }

      const superficieReact = arquivoEhSuperficieReactViteConsumer(relacao)
        ? inferirRotaReactViteConsumer(relacao)
        : undefined;
      if (superficieReact) {
        consumerSurfaces.set(`${superficieReact.rota}:${arquivo}:${superficieReact.tipoArquivo}`, {
          rota: superficieReact.rota,
          arquivo,
          tipoArquivo: superficieReact.tipoArquivo,
        });
        rotas.push({
          origem: "react-vite-consumer",
          metodo: "VIEW",
          caminho: superficieReact.rota,
          arquivo,
          simbolo: superficieReact.tipoArquivo,
        });
      }

      if (arquivoEhRotasReactViteConsumer(relacao, codigo)) {
        for (const rotaReact of extrairRotasReactViteConsumer(relacao, codigo)) {
          consumerSurfaces.set(`${rotaReact.rota}:${arquivo}:router`, {
            rota: rotaReact.rota,
            arquivo,
            tipoArquivo: "router",
          });
          rotas.push({
            origem: "react-vite-consumer",
            metodo: "VIEW",
            caminho: rotaReact.rota,
            arquivo,
            simbolo: "router",
          });
          if (rotaReact.arquivoComponente) {
            const arquivoComponente = path.join(diretorio, rotaReact.arquivoComponente);
            consumerSurfaces.set(`${rotaReact.rota}:${arquivoComponente}:page`, {
              rota: rotaReact.rota,
              arquivo: arquivoComponente,
              tipoArquivo: "page",
            });
          }
        }
      }

      if (arquivoEhRotasAngularConsumer(relacao) && (!usarApenasRotasAngularRaiz || arquivosRotasAngularRaiz.has(path.resolve(arquivo)))) {
        for (const rotaAngular of await extrairRotasAngularConsumer(diretorio, relacao)) {
          const arquivoRotasAngular = path.join(diretorio, rotaAngular.arquivoRotas);
          consumerSurfaces.set(`${rotaAngular.rota}:${arquivoRotasAngular}:routes`, {
            rota: rotaAngular.rota,
            arquivo: arquivoRotasAngular,
            tipoArquivo: "routes",
          });
          rotas.push({
            origem: "angular-consumer",
            metodo: "VIEW",
            caminho: rotaAngular.rota,
            arquivo: arquivoRotasAngular,
            simbolo: rotaAngular.componente ?? "routes",
          });
          if (rotaAngular.arquivoComponente) {
            const arquivoComponente = path.join(diretorio, rotaAngular.arquivoComponente);
            consumerSurfaces.set(`${rotaAngular.rota}:${arquivoComponente}:component`, {
              rota: rotaAngular.rota,
              arquivo: arquivoComponente,
              tipoArquivo: "component",
            });
          }
        }
      }

      for (const node of sourceFile.statements) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, node.name.text);
        }

        if (ts.isVariableStatement(node)) {
          for (const declaracao of node.declarationList.declarations) {
            if (!ts.isIdentifier(declaracao.name) || !declaracao.initializer) {
              continue;
            }
            if (ts.isArrowFunction(declaracao.initializer) || ts.isFunctionExpression(declaracao.initializer)) {
              registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, declaracao.name.text);
            }
          }
        }

        if (!ts.isClassDeclaration(node) || !node.name) {
          if (ts.isExpressionStatement(node)) {
            const expr = desembrulharExpressaoTypeScript(node.expression);
            if (ts.isCallExpression(expr)
              && ts.isPropertyAccessExpression(expr.expression)
              && ts.isIdentifier(expr.expression.expression)
              && expr.expression.expression.text === "Object"
              && expr.expression.name.text === "assign") {
              const nomeClasse = expr.arguments[0]
                ? extrairNomeClassePrototypeTypeScript(expr.arguments[0], sourceFile)
                : undefined;
              for (const argumento of expr.arguments.slice(1)) {
                const valor = desembrulharExpressaoTypeScript(argumento);
                if (ts.isObjectLiteralExpression(valor)) {
                  registrarMetodosObjectAssignTypeScript(simbolos, basesSimbolicas, arquivo, valor, sourceFile, nomeClasse);
                }
              }
            } else if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
              registrarAtribuicaoPrototypeTypeScript(simbolos, basesSimbolicas, arquivo, sourceFile, expr.left, expr.right);
            }
          }
          continue;
        }

        const controllerDecorator = lerDecorator(node, ["Controller"]);
        const basePath = extrairTextoLiteral(controllerDecorator?.argumentos[0]);

        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !member.name) {
            continue;
          }

          const nomeMetodo = member.name.getText(sourceFile);
          if (nomeMetodo === "constructor") {
            continue;
          }

          registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, nomeMetodo, node.name.text);
          const metodoEhInterno = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword);
          for (const baseSimbolica of basesSimbolicas) {
            const caminhoMetodoDireto = `${baseSimbolica}.${nomeMetodo}`;
            if (!simbolos.has(caminhoMetodoDireto)) {
              simbolos.set(caminhoMetodoDireto, { origem: "ts", caminho: caminhoMetodoDireto, arquivo, simbolo: nomeMetodo });
            }
          }

          if (controllerDecorator && !metodoEhInterno) {
            const httpDecorator = lerDecorator(member, ["Get", "Post", "Put", "Patch", "Delete"]);
            if (httpDecorator) {
              rotas.push({
                origem: "nestjs",
                metodo: httpDecorator.nome.toUpperCase(),
                caminho: juntarCaminhoHttp(basePath, extrairTextoLiteral(httpDecorator.argumentos[0])),
                arquivo,
                simbolo: `${node.name.text}.${nomeMetodo}`,
              });
            }
          }
        }
      }
    }
  }

  return {
    simbolos: [...simbolos.values()],
    rotas,
    recursos: [...recursos.values()],
    consumerSurfaces: [...consumerSurfaces.values()].sort((a, b) =>
      a.rota.localeCompare(b.rota, "pt-BR")
      || a.tipoArquivo.localeCompare(b.tipoArquivo, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR")),
  };
}

interface BlocoPython {
  tipo: "class" | "def";
  nome: string;
  indentacao: number;
}

function registrarSimboloPython(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  nome: string,
  nomeClasse?: string,
): void {
  for (const baseSimbolica of basesSimbolicas) {
    const caminho = nomeClasse
      ? `${baseSimbolica}.${nomeClasse}.${nome}`
      : `${baseSimbolica}.${nome}`;
    simbolos.set(caminho, {
      origem: "py",
      caminho,
      arquivo,
      simbolo: nomeClasse ? `${nomeClasse}.${nome}` : nome,
    });
  }
}

function registrarRotasPython(
  rotas: RotaResolvida[],
  decoratorsPendentes: string[],
  prefixo: string | undefined,
  arquivo: string,
  nomeFuncao: string,
): void {
  for (const decorator of decoratorsPendentes) {
    const match = decorator.match(/^@(router|app)\.(get|post|put|patch|delete)\((.*)\)\s*$/);
    if (!match) {
      continue;
    }
    const metodo = match[2]!.toUpperCase();
    const sufixo = match[3]?.match(/["']([^"']+)["']/)?.[1];
    rotas.push({
      origem: "fastapi",
      metodo,
      caminho: juntarCaminhoHttp(prefixo, sufixo),
      arquivo,
      simbolo: nomeFuncao,
    });
  }
}

async function indexarPython(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".py"]))
      .filter((arquivo) => !arquivo.endsWith("__init__.py") && !/tests?[\\/]/i.test(arquivo));

    for (const arquivo of arquivos) {
      const texto = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      const prefixo = texto.match(/APIRouter\s*\(\s*prefix\s*=\s*["']([^"']+)["']/)?.[1];
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, texto)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const rota of extrairRotasFlaskDecoradas(texto)) {
        rotas.push({
          origem: "flask",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.nomeFuncao,
        });
      }
      const blocos: BlocoPython[] = [];
      let decoratorsPendentes: string[] = [];

      for (const linha of texto.split(/\r?\n/)) {
        const trim = linha.trim();
        if (trim === "" || trim.startsWith("#")) {
          decoratorsPendentes = [];
          continue;
        }

        const indentacao = contarIndentacaoPython(linha);
        while (blocos.length > 0 && indentacao <= blocos[blocos.length - 1]!.indentacao) {
          blocos.pop();
        }

        if (trim.startsWith("@")) {
          decoratorsPendentes.push(trim);
          continue;
        }

        const classe = trim.match(/^class\s+([A-Za-z_]\w*)(?:\([^)]*\))?:\s*(?:#.*)?$/);
        if (classe) {
          blocos.push({ tipo: "class", nome: classe[1]!, indentacao });
          decoratorsPendentes = [];
          continue;
        }

        const definicao = trim.match(/^(?:async\s+def|def)\s+([A-Za-z_]\w*)\s*\(/);
        if (definicao) {
          const nomeFuncao = definicao[1]!;
          const existeDefPai = blocos.some((bloco) => bloco.tipo === "def");
          const classeAtual = [...blocos].reverse().find((bloco) => bloco.tipo === "class");

          if (!existeDefPai && classeAtual) {
            registrarSimboloPython(simbolos, basesSimbolicas, arquivo, nomeFuncao, classeAtual.nome);
          } else if (!existeDefPai) {
            registrarSimboloPython(simbolos, basesSimbolicas, arquivo, nomeFuncao);
            registrarRotasPython(rotas, decoratorsPendentes, prefixo, arquivo, nomeFuncao);
          }

          blocos.push({ tipo: "def", nome: nomeFuncao, indentacao });
          decoratorsPendentes = [];
          continue;
        }

        decoratorsPendentes = [];
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

async function indexarDart(diretorios: string[]): Promise<{
  simbolos: SimboloResolvido[];
  rotas: RotaResolvida[];
  recursos: RecursoResolvido[];
  consumerSurfaces: RegistroConsumerSurfaceDrift[];
}> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();
  const consumerSurfaces = new Map<string, RegistroConsumerSurfaceDrift>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".dart"]))
      .filter((arquivo) => !arquivo.endsWith(".g.dart") && !arquivo.endsWith(".freezed.dart"));

    for (const arquivo of arquivos) {
      const texto = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      const relacao = path.relative(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, texto)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }

      for (const match of texto.matchAll(/(?:Future<[^\n]+>|[\w?<>.,\s]+)\s+(\w+)\(([^)]*)\)\s*(?:async\s*)?\{/g)) {
        const nome = match[1]!;
        if (["build", "toString"].includes(nome)) {
          continue;
        }
        for (const baseSimbolica of basesSimbolicas) {
          const caminho = `${baseSimbolica}.${nome}`;
          simbolos.set(caminho, { origem: "dart", caminho, arquivo, simbolo: nome });
        }
      }

      const superficieFlutter = inferirRotaFlutterConsumer(relacao);
      if (superficieFlutter) {
        consumerSurfaces.set(`${superficieFlutter.rota}:${arquivo}:${superficieFlutter.tipoArquivo}`, {
          rota: superficieFlutter.rota,
          arquivo,
          tipoArquivo: superficieFlutter.tipoArquivo,
        });
        rotas.push({
          origem: "flutter-consumer",
          metodo: "VIEW",
          caminho: superficieFlutter.rota,
          arquivo,
          simbolo: superficieFlutter.tipoArquivo,
        });
      }

      if (arquivoEhRotasFlutterConsumer(relacao, texto)) {
        for (const rotaFlutter of extrairRotasFlutterConsumer(relacao, texto)) {
          consumerSurfaces.set(`${rotaFlutter.rota}:${arquivo}:router`, {
            rota: rotaFlutter.rota,
            arquivo,
            tipoArquivo: "router",
          });
          rotas.push({
            origem: "flutter-consumer",
            metodo: "VIEW",
            caminho: rotaFlutter.rota,
            arquivo,
            simbolo: "router",
          });
        }
      }
    }
  }

  return {
    simbolos: [...simbolos.values()],
    rotas,
    recursos: [...recursos.values()],
    consumerSurfaces: [...consumerSurfaces.values()].sort((a, b) =>
      a.rota.localeCompare(b.rota, "pt-BR")
      || a.tipoArquivo.localeCompare(b.tipoArquivo, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR")),
  };
}

function registrarSimboloGenerico(
  simbolos: Map<string, SimboloResolvido>,
  origem: SimboloResolvido["origem"],
  basesSimbolicas: string[],
  arquivo: string,
  simbolo: string,
): void {
  for (const baseSimbolica of basesSimbolicas) {
    const caminho = `${baseSimbolica}.${simbolo}`;
    simbolos.set(caminho, {
      origem,
      caminho,
      arquivo,
      simbolo,
    });

    const ultimo = simbolo.split(".").at(-1);
    if (ultimo) {
      const caminhoDireto = `${baseSimbolica}.${ultimo}`;
      if (!simbolos.has(caminhoDireto)) {
        simbolos.set(caminhoDireto, {
          origem,
          caminho: caminhoDireto,
          arquivo,
          simbolo: ultimo,
        });
      }
    }
  }
}

async function indexarDotnet(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".cs"]))
      .filter((arquivo) => !/(^|[\\/])(bin|obj|Test[s]?)([\\/]|$)/i.test(arquivo));

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosDotnet(codigo)) {
        registrarSimboloGenerico(simbolos, "cs", basesSimbolicas, arquivo, simbolo.simbolo);
      }
      for (const rota of extrairRotasDotnet(codigo)) {
        rotas.push({
          origem: "dotnet",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

async function indexarJava(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".java"]))
      .filter((arquivo) => !/(^|[\\/])(target|build|out|Test[s]?)([\\/]|$)/i.test(arquivo));

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosJava(codigo)) {
        registrarSimboloGenerico(simbolos, "java", basesSimbolicas, arquivo, simbolo.simbolo);
      }
      for (const rota of extrairRotasJava(codigo)) {
        rotas.push({
          origem: "java",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

async function indexarGo(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = await listarArquivosRecursivos(diretorio, [".go"]);

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosGo(codigo)) {
        registrarSimboloGenerico(simbolos, "go", basesSimbolicas, arquivo, simbolo.simbolo);
      }
      for (const rota of extrairRotasGo(codigo)) {
        rotas.push({
          origem: "go",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

async function indexarRust(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = await listarArquivosRecursivos(diretorio, [".rs"]);

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosRust(codigo)) {
        registrarSimboloGenerico(simbolos, "rust", basesSimbolicas, arquivo, simbolo.simbolo);
      }
      for (const rota of extrairRotasRust(codigo)) {
        rotas.push({
          origem: "rust",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

async function indexarCpp(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; recursos: RecursoResolvido[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const recursos = new Map<string, RecursoResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".cpp", ".cc", ".cxx", ".hpp", ".h"]))
      .filter((arquivo) => !/(^|[\\/])(windows|linux|macos|runner|flutter|ephemeral|build|vendor)([\\/]|$)/i.test(arquivo));

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosCpp(codigo)) {
        registrarSimboloGenerico(simbolos, "cpp", basesSimbolicas, arquivo, simbolo.simbolo);
      }
    }
  }

  return {
    simbolos: [...simbolos.values()],
    recursos: [...recursos.values()],
  };
}

async function indexarPersistenciaDeclarativa(diretorios: string[]): Promise<{ recursos: RecursoResolvido[] }> {
  const recursos = new Map<string, RecursoResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = await listarArquivosRecursivos(diretorio, [
      ".sql", ".psql", ".ddl", ".prisma",
      ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
      ".py", ".dart", ".cs", ".java", ".go", ".rs", ".cpp", ".cc", ".cxx", ".hpp", ".h",
    ]);

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const extracoes = arquivo.endsWith(".prisma")
        ? extrairRecursosPrisma(arquivo, codigo)
        : extrairRecursosPersistenciaCodigoVivo(arquivo, codigo);
      for (const recurso of extracoes) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
    }
  }

  return { recursos: [...recursos.values()] };
}

function normalizarOrigemParaEngine(origem?: OrigemRecursoDrift): EngineBanco | undefined {
  return origem && origem !== "firebase" && origem !== "arquivo" ? origem : undefined;
}

function registrarColunaPersistenciaDrift(
  colunas: Map<string, RegistroColunaPersistenciaDrift>,
  origem: OrigemRecursoDrift,
  recurso: string,
  coluna: string,
  arquivo: string,
): void {
  const recursoNormalizado = fecharPrefixoRecurso(limparLiteralRecurso(recurso));
  const colunaNormalizada = fecharPrefixoRecurso(limparLiteralRecurso(coluna));
  if (!recursoNormalizado || !colunaNormalizada || recursoEhIgnorado(colunaNormalizada)) {
    return;
  }
  const chave = `${origem}:${normalizarNomeRecursoDrift(recursoNormalizado)}:${normalizarNomeRecursoDrift(colunaNormalizada)}:${arquivo}`;
  if (!colunas.has(chave)) {
    colunas.set(chave, {
      origem,
      categoriaPersistencia: categorizarPersistenciaPorOrigem(origem),
      recurso: recursoNormalizado,
      coluna: colunaNormalizada,
      arquivo,
    });
  }
}

function registrarRepositorioPersistenciaDrift(
  repositorios: Map<string, RegistroRepositorioPersistenciaDrift>,
  origem: OrigemRecursoDrift,
  recurso: string,
  arquivo: string,
): void {
  const recursoNormalizado = fecharPrefixoRecurso(limparLiteralRecurso(recurso));
  if (!recursoNormalizado) {
    return;
  }
  const chave = `${origem}:${normalizarNomeRecursoDrift(recursoNormalizado)}:${arquivo}`;
  if (!repositorios.has(chave)) {
    repositorios.set(chave, {
      origem,
      categoriaPersistencia: categorizarPersistenciaPorOrigem(origem),
      recurso: recursoNormalizado,
      arquivo,
    });
  }
}

function extrairColunasSqlDetalhadas(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
  const colunas = new Map<string, RegistroColunaPersistenciaDrift>();
  const motores = inferirMotoresRelacionais(codigo, arquivo);
  if (motores.length === 0) {
    return [];
  }

  const registrarParaMotores = (recurso: string, coluna: string) => {
    for (const motor of motores) {
      registrarColunaPersistenciaDrift(colunas, motor, recurso, coluna, arquivo);
    }
  };

  for (const match of codigo.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?["'`]?([A-Za-z_][\w$.-]*)["'`]?\s*\(([\s\S]*?)\)\s*;?/gi)) {
    const tabela = match[1]!;
    const corpo = match[2] ?? "";
    for (const linha of corpo.split(/\r?\n|,/)) {
      const trecho = linha.trim();
      if (!trecho || /^(?:constraint|primary|foreign|unique|check|key|index)\b/i.test(trecho)) {
        continue;
      }
      const coluna = trecho.match(/^["'`]?([A-Za-z_][\w$.-]*)["'`]?/i)?.[1];
      if (coluna) {
        registrarParaMotores(tabela, coluna);
      }
    }
  }

  for (const match of codigo.matchAll(/\binsert\s+into\s+["'`]?([A-Za-z_][\w$.-]*)["'`]?\s*\(([^)]+)\)/gi)) {
    for (const coluna of (match[2] ?? "").split(",").map((item) => item.trim())) {
      registrarParaMotores(match[1]!, coluna);
    }
  }

  for (const match of codigo.matchAll(/\bupdate\s+["'`]?([A-Za-z_][\w$.-]*)["'`]?\s+set\s+([\s\S]*?)(?:\bwhere\b|;|$)/gi)) {
    for (const coluna of (match[2] ?? "").split(",").map((item) => item.split("=")[0]?.trim() ?? "")) {
      registrarParaMotores(match[1]!, coluna);
    }
  }

  for (const match of codigo.matchAll(/\bselect\s+([\s\S]*?)\s+from\s+["'`]?([A-Za-z_][\w$.-]*)["'`]?/gi)) {
    const tabela = match[2]!;
    const lista = (match[1] ?? "").trim();
    if (!lista || lista === "*") {
      continue;
    }
    for (const coluna of lista.split(",").map((item) => item.trim().split(/\s+as\s+/i)[0] ?? "")) {
      const nome = coluna.split(".").at(-1) ?? coluna;
      registrarParaMotores(tabela, nome);
    }
  }

  return [...colunas.values()];
}

function extrairColunasPrismaDetalhadas(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
  const colunas = new Map<string, RegistroColunaPersistenciaDrift>();
  const provider = codigo.match(/\bprovider\s*=\s*["'`](postgresql|mysql|sqlite)["'`]/i)?.[1]?.toLowerCase();
  const engine = provider === "postgresql"
    ? "postgres"
    : provider === "mysql"
      ? "mysql"
      : provider === "sqlite"
        ? "sqlite"
        : undefined;
  if (!engine) {
    return [];
  }

  for (const match of codigo.matchAll(/\bmodel\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\n\}/g)) {
    const nomeModelo = match[1]!;
    const corpo = match[2] ?? "";
    const tabela = corpo.match(/@@map\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/)?.[1] ?? nomeModelo;
    for (const linha of corpo.split(/\r?\n/)) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("@@") || limpa.startsWith("//")) {
        continue;
      }
      const coluna = limpa.match(/^([A-Za-z_]\w*)\s+/)?.[1];
      const colunaMapeada = limpa.match(/@map\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/)?.[1];
      if (coluna) {
        registrarColunaPersistenciaDrift(colunas, engine, tabela, colunaMapeada ?? coluna, arquivo);
      }
    }
  }

  return [...colunas.values()];
}

function extrairCamposMongoDetalhados(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
  const colunas = new Map<string, RegistroColunaPersistenciaDrift>();
  const colecoes = extrairRecursosMongoDb(arquivo, codigo).filter((item) => item.tipo === "collection");
  if (colecoes.length === 0) {
    return [];
  }

  const registrarCampoMongo = (colecao: string, trecho: string) => {
    for (const match of trecho.matchAll(/([A-Za-z_][\w$]*)\s*:/g)) {
      registrarColunaPersistenciaDrift(colunas, "mongodb", colecao, match[1]!, arquivo);
    }
  };

  for (const schema of codigo.matchAll(/\bnew\s+Schema\s*\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    for (const colecao of colecoes) {
      registrarCampoMongo(colecao.nome, schema[1] ?? "");
    }
  }

  for (const trecho of codigo.matchAll(/\b(?:find(?:One)?|update(?:One|Many)?|insertOne|insertMany)\s*\(\s*\{([\s\S]*?)\}\s*(?:,|\))/g)) {
    for (const colecao of colecoes) {
      registrarCampoMongo(colecao.nome, trecho[1] ?? "");
    }
  }

  return [...colunas.values()];
}

function extrairCamposRedisDetalhados(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
  const colunas = new Map<string, RegistroColunaPersistenciaDrift>();
  for (const match of codigo.matchAll(/\bh(?:set|get|del|exists)\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]/gi)) {
    registrarColunaPersistenciaDrift(colunas, "redis", match[1]!, match[2]!, arquivo);
  }
  return [...colunas.values()];
}

function extrairCamposArquivoLocalDetalhados(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
  const colunas = new Map<string, RegistroColunaPersistenciaDrift>();
  const recursos = extrairRecursosArquivoLocal(arquivo, codigo);
  if (recursos.length === 0) {
    return [];
  }

  const registrarCampo = (recurso: string, trecho: string) => {
    for (const match of trecho.matchAll(/["'`]?([A-Za-z_][\w$-]*)["'`]?\s*:/g)) {
      registrarColunaPersistenciaDrift(colunas, "arquivo", recurso, match[1]!, arquivo);
    }
  };

  const blocos = [
    ...codigo.matchAll(/\b(?:_empty_store|empty_store|default_store)\b[\s\S]{0,1000}?return\s*\{([\s\S]*?)\n\s*\}/g),
    ...codigo.matchAll(/\bstore\s*=\s*\{([\s\S]*?)\n\s*\}/g),
  ];

  for (const recurso of recursos) {
    for (const bloco of blocos) {
      registrarCampo(recurso.nome, bloco[1] ?? "");
    }
  }

  return [...colunas.values()];
}

function registrarRepositoriosPorRecursos(
  repositorios: Map<string, RegistroRepositorioPersistenciaDrift>,
  arquivo: string,
  codigo: string,
  recursos: RecursoResolvido[],
): void {
  const contextoRepositorio = /(?:repository|repositories|repositorio|repositorios|repo|dao|store|queries|persistence|persistencia)/i.test(arquivo)
    || /\b(?:Repository|Repositories|Dao|Store)\b/.test(codigo);
  const contextoAcesso = /\b(?:select|insert|update|delete|aggregate|findOne|findMany|findUnique|findFirst|prisma\.|db\.collection|createClient|hset|hget|xadd|xread|json\.(?:load|loads|dump|dumps)|JSON\.(?:parse|stringify)|read_text|write_text|readFile(?:Sync)?|writeFile(?:Sync)?|open)\b/i.test(codigo)
    || /\.(?:json|jsonl|ndjson|db|sqlite|sqlite3)\b/i.test(codigo);
  if (!contextoRepositorio && !contextoAcesso) {
    return;
  }

  for (const recurso of recursos) {
    registrarRepositorioPersistenciaDrift(repositorios, recurso.origem, recurso.nome, arquivo);
  }
}

async function indexarPersistenciaDetalhada(
  diretorios: string[],
): Promise<{
  colunas: RegistroColunaPersistenciaDrift[];
  repositorios: RegistroRepositorioPersistenciaDrift[];
}> {
  const colunas = new Map<string, RegistroColunaPersistenciaDrift>();
  const repositorios = new Map<string, RegistroRepositorioPersistenciaDrift>();

  for (const diretorio of diretorios) {
    const arquivos = await listarArquivosRecursivos(diretorio, [
      ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
      ".py", ".dart", ".cs", ".java", ".go", ".rs", ".cpp", ".cc", ".cxx", ".hpp", ".h",
      ".sql", ".psql", ".ddl", ".prisma",
    ]);

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const recursos = arquivo.endsWith(".prisma")
        ? extrairRecursosPrisma(arquivo, codigo)
        : extrairRecursosPersistenciaCodigoVivo(arquivo, codigo);

      for (const coluna of extrairColunasSqlDetalhadas(arquivo, codigo)) {
        registrarColunaPersistenciaDrift(colunas, coluna.origem, coluna.recurso, coluna.coluna, coluna.arquivo);
      }
      for (const coluna of extrairColunasPrismaDetalhadas(arquivo, codigo)) {
        registrarColunaPersistenciaDrift(colunas, coluna.origem, coluna.recurso, coluna.coluna, coluna.arquivo);
      }
      for (const coluna of extrairCamposMongoDetalhados(arquivo, codigo)) {
        registrarColunaPersistenciaDrift(colunas, coluna.origem, coluna.recurso, coluna.coluna, coluna.arquivo);
      }
      for (const coluna of extrairCamposRedisDetalhados(arquivo, codigo)) {
        registrarColunaPersistenciaDrift(colunas, coluna.origem, coluna.recurso, coluna.coluna, coluna.arquivo);
      }
      for (const coluna of extrairCamposArquivoLocalDetalhados(arquivo, codigo)) {
        registrarColunaPersistenciaDrift(colunas, coluna.origem, coluna.recurso, coluna.coluna, coluna.arquivo);
      }

      registrarRepositoriosPorRecursos(repositorios, arquivo, codigo, recursos);
    }
  }

  return {
    colunas: [...colunas.values()],
    repositorios: [...repositorios.values()],
  };
}

function recursoDetalhadoCombina(
  recurso: string,
  esperado: RecursoEsperadoDrift,
): boolean {
  return variantesNomeRecursoDrift(recurso).some((variante) =>
    esperado.nomes.some((nome) => variantesNomeRecursoDrift(nome).includes(variante)));
}

function deduplicarRecursosResolvidos(recursos: RecursoResolvido[]): RecursoResolvido[] {
  return [...new Map(recursos.map((recurso) =>
    [`${recurso.origem}:${recurso.tipo}:${recurso.nome}:${recurso.arquivo}:${recurso.simbolo ?? ""}`, recurso] as const)).values()];
}

function normalizarArquivoDeclaradoDrift(valor: string): string {
  return normalizarFragmentoArquivo(valor);
}

function arquivoCombinaDeclaradoDrift(arquivoReal: string, arquivoDeclarado: string): boolean {
  const real = normalizarArquivoDeclaradoDrift(arquivoReal);
  const declarado = normalizarArquivoDeclaradoDrift(arquivoDeclarado);
  return real === declarado || real.endsWith(declarado) || declarado.endsWith(real);
}

function coletarArquivosPreferidosPersistenciaTask(task: IrTask): Set<string> {
  const arquivos = new Set<string>();
  for (const vinculo of task.vinculos) {
    if (vinculo.arquivo) {
      arquivos.add(vinculo.arquivo);
    }
    if (vinculo.tipo === "arquivo" && vinculo.valor) {
      arquivos.add(vinculo.valor);
    }
  }
  return arquivos;
}

function resolverPersistenciaLocalPorTask(
  mapaRecursos: Map<string, RecursoResolvido[]>,
  task: IrTask,
  ir: IrModulo,
  esperado: RecursoEsperadoDrift,
): RecursoResolvido[] {
  const todosRecursos = deduplicarRecursosResolvidos([...mapaRecursos.values()].flat());
  const arquivosPreferidos = [...coletarArquivosPreferidosPersistenciaTask(task)];
  const candidatosPorArquivo = arquivosPreferidos.length > 0
    ? todosRecursos.filter((recurso) =>
      recurso.origem === "arquivo"
      && arquivosPreferidos.some((arquivo) => arquivoCombinaDeclaradoDrift(recurso.arquivo, arquivo)))
    : [];
  if (candidatosPorArquivo.length > 0) {
    return candidatosPorArquivo;
  }

  const termos = new Set([
    ...quebrarTermosEscopo(ir.nome),
    ...quebrarTermosEscopo(task.nome),
    ...quebrarTermosEscopo(esperado.alvo),
  ]);
  if (termos.size === 0) {
    return [];
  }

  return todosRecursos.filter((recurso) =>
    recurso.origem === "arquivo"
    && [...termos].some((termo) =>
      variantesNomeRecursoDrift(recurso.nome).some((variacao) => variacao.includes(termo))));
}

function detalhePersistenciaCombinaOrigem(
  origemDetalhe: OrigemRecursoDrift,
  recursoReal?: RecursoResolvido,
): boolean {
  if (!recursoReal) {
    return true;
  }
  return origemDetalhe === recursoReal.origem;
}

function localizarCompatibilidadePersistencia(
  bancos: IrBancoDados[],
  esperado: RecursoEsperadoDrift,
  recursoReal?: RecursoResolvido,
): {
  engine: OrigemRecursoDrift | "desconhecido";
  compatibilidade: RegistroPersistenciaRealDrift["compatibilidade"];
  motivoCompatibilidade?: string;
  tipo: TipoRecursoDrift;
} {
  for (const banco of bancos) {
    for (const recurso of banco.resources) {
      if (!recursoPersistenciaCombinaAlvo(recurso, esperado.alvo)) {
        continue;
      }
      if (recursoReal?.origem === "arquivo") {
        return {
          engine: "arquivo",
          compatibilidade: "adaptado",
          motivoCompatibilidade: `Persistencia local/arquivo detectada no codigo vivo em vez do engine ${banco.engine}.`,
          tipo: recursoReal.tipo,
        };
      }
      const engine = banco.engine ?? normalizarOrigemParaEngine(recursoReal?.origem);
      const compatibilidade = engine
        ? recurso.compatibilidade.find((item) => item.engine === engine) ?? recurso.compatibilidade[0]
        : recurso.compatibilidade[0];
      return {
        engine: (engine ?? recursoReal?.origem ?? "desconhecido") as OrigemRecursoDrift | "desconhecido",
        compatibilidade: compatibilidade?.status ?? "desconhecida",
        motivoCompatibilidade: compatibilidade?.motivo,
        tipo: (recurso.resourceKind as TipoRecursoDrift) ?? recursoReal?.tipo ?? esperado.tiposAceitos[0] ?? "query",
      };
    }
  }

  if (recursoReal?.origem === "arquivo") {
    return {
      engine: "arquivo",
      compatibilidade: "desconhecida",
      motivoCompatibilidade: "Persistencia local/arquivo detectada sem database vendor-first declarado.",
      tipo: recursoReal.tipo,
    };
  }

  return {
    engine: recursoReal?.origem ?? esperado.origem ?? "desconhecido",
    compatibilidade: "desconhecida",
    tipo: recursoReal?.tipo ?? esperado.tiposAceitos[0] ?? "query",
  };
}

export async function analisarPersistenciaReal(
  contexto: ContextoProjetoCarregado,
  mapaRecursos?: Map<string, RecursoResolvido[]>,
  detalhesPersistencia?: Awaited<ReturnType<typeof indexarPersistenciaDetalhada>>,
  opcoes?: OpcoesDriftLegado,
): Promise<RegistroPersistenciaRealDrift[]> {
  const opcoesResolvidas = resolverOpcoesDrift(opcoes);
  const diretoriosCodigoAtivos = resolverDiretoriosCodigoEscopoReal(contexto, opcoesResolvidas);
  const mapa = mapaRecursos ?? construirMapaRecursos((await indexarPersistenciaDeclarativa(diretoriosCodigoAtivos)).recursos);
  const detalhes = detalhesPersistencia ?? await indexarPersistenciaDetalhada(diretoriosCodigoAtivos);
  const registros: RegistroPersistenciaRealDrift[] = [];

  for (const item of contexto.modulosSelecionados) {
    const ir = item.resultado.ir;
    if (!ir) {
      continue;
    }

    for (const task of ir.tasks) {
      for (const esperado of extrairRecursosEsperados(task, ir)) {
        const correspondencias = esperado.nomes.flatMap((nome) =>
          variantesNomeRecursoDrift(nome).flatMap((variante) =>
            (mapa.get(variante) ?? []).filter((recurso) => recursoResolvidoCombinaEsperado(recurso, esperado))));
        let recursosReais = deduplicarRecursosResolvidos(correspondencias);
        const arquivosPreferidos = [...coletarArquivosPreferidosPersistenciaTask(task)];
        if (recursosReais.length === 0) {
          recursosReais = resolverPersistenciaLocalPorTask(mapa, task, ir, esperado);
        }
        const compatibilidade = localizarCompatibilidadePersistencia(ir.databases, esperado, recursosReais[0]);
        let colunas = [...new Set(detalhes.colunas
          .filter((coluna) =>
            detalhePersistenciaCombinaOrigem(coluna.origem, recursosReais[0])
            && recursoDetalhadoCombina(coluna.recurso, esperado))
          .map((coluna) => coluna.coluna))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        let repositorios = [...new Set(detalhes.repositorios
          .filter((repositorio) =>
            detalhePersistenciaCombinaOrigem(repositorio.origem, recursosReais[0])
            && recursoDetalhadoCombina(repositorio.recurso, esperado))
          .map((repositorio) => repositorio.arquivo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        if (recursosReais.some((recurso) => recurso.origem === "arquivo") && arquivosPreferidos.length > 0) {
          if (colunas.length === 0) {
            colunas = [...new Set(detalhes.colunas
              .filter((coluna) =>
                coluna.origem === "arquivo"
                && arquivosPreferidos.some((arquivo) => arquivoCombinaDeclaradoDrift(coluna.arquivo, arquivo)))
              .map((coluna) => coluna.coluna))].sort((a, b) => a.localeCompare(b, "pt-BR"));
          }
          if (repositorios.length === 0) {
            repositorios = [...new Set(detalhes.repositorios
              .filter((repositorio) =>
                repositorio.origem === "arquivo"
                && arquivosPreferidos.some((arquivo) => arquivoCombinaDeclaradoDrift(repositorio.arquivo, arquivo)))
              .map((repositorio) => repositorio.arquivo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
          }
        }
        const arquivos = [...new Set(recursosReais.map((recurso) => recurso.arquivo))].sort((a, b) => a.localeCompare(b, "pt-BR"));

        registros.push({
          modulo: ir.nome,
          task: task.nome,
          alvo: esperado.alvo,
          engine: compatibilidade.engine,
          categoriaPersistencia: categorizarPersistenciaPorOrigem((compatibilidade.engine === "desconhecido" ? undefined : compatibilidade.engine) as OrigemRecursoDrift | undefined),
          tipo: compatibilidade.tipo,
          status: recursosReais.length === 0
            ? "divergente"
            : colunas.length > 0 || repositorios.length > 0
              ? "materializado"
              : "parcial",
          arquivos,
          colunas,
          repositorios,
          compatibilidade: compatibilidade.compatibilidade,
          motivoCompatibilidade: compatibilidade.motivoCompatibilidade,
        });
      }
    }
  }

  return registros.sort((a, b) =>
    a.modulo.localeCompare(b.modulo, "pt-BR")
    || a.task.localeCompare(b.task, "pt-BR")
    || a.alvo.localeCompare(b.alvo, "pt-BR"));
}

function normalizarCaminhoRota(caminho?: string): string {
  if (!caminho) {
    return "/";
  }
  const limpo = normalizarCaminhoFlask(caminho.trim().replace(/\s*\/\s*/g, "/"));
  const comBarra = limpo.startsWith("/") ? limpo : `/${limpo}`;
  const normalizado = comBarra.replace(/\/+/g, "/");
  return normalizado.endsWith("/") && normalizado !== "/" ? normalizado.slice(0, -1) : normalizado;
}

function extrairFontesHttpTypeScript(fontesLegado: FonteLegado[]): Array<"nestjs" | "nextjs" | "firebase"> {
  return fontesLegado.filter((fonte): fonte is "nestjs" | "nextjs" | "firebase" =>
    fonte === "nestjs" || fonte === "nextjs" || fonte === "firebase");
}

function extrairFontesHttpBackend(fontesLegado: FonteLegado[]): Array<"dotnet" | "java" | "go" | "rust"> {
  return fontesLegado.filter((fonte): fonte is "dotnet" | "java" | "go" | "rust" =>
    fonte === "dotnet" || fonte === "java" || fonte === "go" || fonte === "rust");
}

function ultimoSegmentoSimbolico(caminho: string): string {
  const partes = caminho.split(".").filter(Boolean);
  return paraIdentificadorModulo(partes[partes.length - 1] ?? caminho);
}

function pontuarCandidatoDeclarado(candidato: SimboloResolvido, origem: SimboloResolvido["origem"], caminhoDeclarado: string): SimboloCandidatoDrift | undefined {
  if (candidato.origem !== origem) {
    return undefined;
  }

  const caminhoNormalizado = paraIdentificadorModulo(caminhoDeclarado.replace(/\./g, "_"));
  const candidatoNormalizado = paraIdentificadorModulo(candidato.caminho.replace(/\./g, "_"));
  const ultimoDeclarado = ultimoSegmentoSimbolico(caminhoDeclarado);
  const ultimoCandidato = ultimoSegmentoSimbolico(candidato.caminho);
  const prefixoDeclarado = caminhoDeclarado.split(".").slice(0, -1).join(".");
  const prefixoCandidato = candidato.caminho.split(".").slice(0, -1).join(".");

  if (candidato.caminho === caminhoDeclarado) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Caminho simbolico bate exatamente com o declarado.",
    };
  }

  if (ultimoDeclarado && ultimoDeclarado === ultimoCandidato) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Ultimo simbolo bate com a implementacao declarada.",
    };
  }

  if (ultimoDeclarado && (candidatoNormalizado.includes(ultimoDeclarado) || caminhoNormalizado.includes(ultimoCandidato))) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Trecho relevante do caminho simbolico parece compativel com o declarado.",
    };
  }

  if (prefixoDeclarado && prefixoDeclarado === prefixoCandidato) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Prefixo do caminho simbolico bate com a implementacao declarada; o simbolo final pode ter mudado.",
    };
  }

  return undefined;
}

function pontuarCandidatoPorTask(candidato: SimboloResolvido, task: string): SimboloCandidatoDrift | undefined {
  const taskNormalizada = paraIdentificadorModulo(task);
  const simboloNormalizado = paraIdentificadorModulo(candidato.simbolo.replace(/\./g, "_"));
  const caminhoNormalizado = paraIdentificadorModulo(candidato.caminho.replace(/\./g, "_"));

  if (!taskNormalizada) {
    return undefined;
  }

  if (simboloNormalizado === taskNormalizada || ultimoSegmentoSimbolico(candidato.caminho) === taskNormalizada) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Nome da task bate com o simbolo encontrado no codigo vivo.",
    };
  }

  if (simboloNormalizado.includes(taskNormalizada) || taskNormalizada.includes(simboloNormalizado) || caminhoNormalizado.includes(taskNormalizada)) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Nome da task parece compativel com o simbolo encontrado no codigo vivo.",
    };
  }

  return undefined;
}

function deduplicarCandidatos(candidatos: SimboloCandidatoDrift[]): SimboloCandidatoDrift[] {
  const mapa = new Map<string, SimboloCandidatoDrift>();
  for (const candidato of candidatos) {
    const chave = `${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`;
    const anterior = mapa.get(chave);
    if (!anterior || (anterior.confianca === "media" && candidato.confianca === "alta")) {
      mapa.set(chave, candidato);
    }
  }
  return [...mapa.values()];
}

function ordenarCandidatos(candidatos: SimboloCandidatoDrift[]): SimboloCandidatoDrift[] {
  return [...candidatos].sort((a, b) => {
    if (a.confianca !== b.confianca) {
      return a.confianca === "alta" ? -1 : 1;
    }
    return a.caminho.localeCompare(b.caminho, "pt-BR");
  });
}

function sugerirCandidatosParaImpl(
  simbolos: SimboloResolvido[],
  origem: SimboloResolvido["origem"],
  caminhoDeclarado: string,
): SimboloCandidatoDrift[] {
  return ordenarCandidatos(deduplicarCandidatos(
    simbolos
      .map((candidato) => pontuarCandidatoDeclarado(candidato, origem, caminhoDeclarado))
      .filter((item): item is SimboloCandidatoDrift => Boolean(item)),
  )).slice(0, 5);
}

function sugerirCandidatosParaTaskSemImpl(simbolos: SimboloResolvido[], nomeTask: string): SimboloCandidatoDrift[] {
  return ordenarCandidatos(deduplicarCandidatos(
    simbolos
      .map((candidato) => pontuarCandidatoPorTask(candidato, nomeTask))
      .filter((item): item is SimboloCandidatoDrift => Boolean(item)),
  )).slice(0, 5);
}

function escolherRotasEsperadas(task: IrTask, fontesLegado: FonteLegado[]): Array<"nestjs" | "fastapi" | "flask" | "nextjs" | "firebase" | "dotnet" | "java" | "go" | "rust"> {
  const fontesTs = extrairFontesHttpTypeScript(fontesLegado);
  const fontesBackend = extrairFontesHttpBackend(fontesLegado);
  const implTs = task.implementacoesExternas.find((impl) => impl.origem === "ts");
  if (implTs) {
    const esperadas = new Set<"nestjs" | "nextjs" | "firebase">();
    if (/\.route\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(implTs.caminho) || /\.route\./i.test(implTs.caminho)) {
      esperadas.add("nextjs");
    }
    if (/\bcontroller\b/i.test(implTs.caminho) && fontesTs.includes("nestjs")) {
      esperadas.add("nestjs");
    }
    if (fontesTs.includes("firebase") && /(apps\.worker|worker|sema_contract_bridge|health)/i.test(implTs.caminho)) {
      esperadas.add("firebase");
    }
    if (esperadas.size > 0) {
      return [...esperadas];
    }
    if (fontesTs.length > 0) {
      return fontesTs;
    }
    return ["nestjs", "nextjs", "firebase"];
  }
  if (task.implementacoesExternas.some((impl) => impl.origem === "py")) {
    const fontesPython = fontesLegado.filter((fonte): fonte is "fastapi" | "flask" => fonte === "fastapi" || fonte === "flask");
    if (fontesPython.length > 0) {
      return fontesPython;
    }
    return ["fastapi", "flask"];
  }
  const implCs = task.implementacoesExternas.find((impl) => impl.origem === "cs");
  if (implCs) {
    return fontesBackend.includes("dotnet") ? ["dotnet"] : ["dotnet"];
  }
  const implJava = task.implementacoesExternas.find((impl) => impl.origem === "java");
  if (implJava) {
    return fontesBackend.includes("java") ? ["java"] : ["java"];
  }
  const implGo = task.implementacoesExternas.find((impl) => impl.origem === "go");
  if (implGo) {
    return fontesBackend.includes("go") ? ["go"] : ["go"];
  }
  const implRust = task.implementacoesExternas.find((impl) => impl.origem === "rust");
  if (implRust) {
    return fontesBackend.includes("rust") ? ["rust"] : ["rust"];
  }
  if (fontesTs.length > 0) {
    return fontesTs;
  }
  const fontesPython = fontesLegado.filter((fonte): fonte is "fastapi" | "flask" => fonte === "fastapi" || fonte === "flask");
  if (fontesPython.length > 0) {
    return fontesPython;
  }
  if (fontesBackend.length > 0) {
    return fontesBackend;
  }
  return [];
}

function taskEhBridgeFirebase(task: IrTask): boolean {
  return task.implementacoesExternas.some((impl) =>
    impl.origem === "ts" && /sema_contract_bridge|collections?|apps\.worker/i.test(impl.caminho));
}

function tiposAceitosParaRecursoPersistencia(recurso: IrRecursoPersistencia): TipoRecursoDrift[] {
  switch (recurso.resourceKind) {
    case "table":
    case "view":
    case "query":
    case "index":
    case "collection":
    case "document":
    case "keyspace":
    case "stream":
      return [recurso.resourceKind];
    default:
      return [];
  }
}

function nomesRecursoPersistencia(recurso: IrRecursoPersistencia): string[] {
  return [...new Set([
    recurso.nome,
    recurso.table,
    recurso.collection,
    recurso.entity,
    recurso.path,
    recurso.surface,
  ].filter((item): item is string => Boolean(item)))];
}

function recursoPersistenciaCombinaAlvo(recurso: IrRecursoPersistencia, alvo: string): boolean {
  const alvoVariantes = new Set(variantesNomeRecursoDrift(alvo));
  if (alvoVariantes.size === 0) {
    return false;
  }

  return nomesRecursoPersistencia(recurso).some((nome) =>
    variantesNomeRecursoDrift(nome).some((variacao) => alvoVariantes.has(variacao)));
}

function taskSugerePersistenciaSemBanco(task: IrTask): boolean {
  return task.vinculos.some((vinculo) =>
    /(?:repository|repositories|repositorio|repo|store|storage|persist|cache)/i.test(
      `${vinculo.valor} ${vinculo.arquivo ?? ""} ${vinculo.simbolo ?? ""}`,
    ))
    || task.implementacoesExternas.some((impl) =>
      /(?:repository|repositories|repositorio|repo|store|storage|persist|cache)/i.test(impl.caminho));
}

function extrairRecursosEsperados(task: IrTask, ir: IrModulo): RecursoEsperadoDrift[] {
  const esperados = new Map<string, RecursoEsperadoDrift>();
  const registrar = (esperado: RecursoEsperadoDrift) => {
    const chave = `${esperado.origem ?? "qualquer"}:${esperado.tiposAceitos.join(",")}:${esperado.nomes.join("|")}:${esperado.alvo}`;
    if (!esperados.has(chave)) {
      esperados.set(chave, esperado);
    }
  };

  if (taskEhBridgeFirebase(task)) {
    for (const efeito of task.efeitosEstruturados.filter((item) => item.categoria === "persistencia" && Boolean(item.alvo))) {
      registrar({
        categoria: "persistencia",
        alvo: efeito.alvo,
        origem: "firebase",
        tiposAceitos: ["colecao"],
        nomes: [efeito.alvo],
      });
    }
  }

  const efeitosPersistencia = task.efeitosEstruturados.filter((efeito) =>
    ["persistencia", "db.read", "db.write"].includes(efeito.categoria) && Boolean(efeito.alvo));
  if (efeitosPersistencia.length === 0) {
    return [...esperados.values()];
  }

  if (ir.databases.length === 0) {
    const sugerePersistenciaLocal = taskSugerePersistenciaSemBanco(task);
    for (const efeito of efeitosPersistencia) {
      if (efeito.categoria !== "persistencia" || !sugerePersistenciaLocal) {
        continue;
      }
      if ([...esperados.values()].some((item) => item.alvo === efeito.alvo)) {
        continue;
      }
      registrar({
        categoria: "persistencia",
        alvo: efeito.alvo,
        tiposAceitos: ["table", "collection", "document", "keyspace", "stream", "view", "query", "index", "arquivo_local"],
        nomes: [efeito.alvo],
      });
    }
    return [...esperados.values()];
  }

  for (const efeito of efeitosPersistencia) {
    for (const database of ir.databases) {
      for (const recurso of database.resources) {
        const tiposAceitos = tiposAceitosParaRecursoPersistencia(recurso);
        if (tiposAceitos.length === 0 || !recursoPersistenciaCombinaAlvo(recurso, efeito.alvo)) {
          continue;
        }
        registrar({
          categoria: "persistencia",
          alvo: efeito.alvo,
          origem: database.engine,
          tiposAceitos,
          nomes: nomesRecursoPersistencia(recurso),
        });
      }
    }
  }

  return [...esperados.values()];
}

function construirMapaRecursos(recursos: RecursoResolvido[]): Map<string, RecursoResolvido[]> {
  const mapa = new Map<string, RecursoResolvido[]>();
  for (const recurso of recursos) {
    for (const variante of variantesNomeRecursoDrift(recurso.nome)) {
      const existentes = mapa.get(variante) ?? [];
      if (!existentes.some((item) =>
        item.origem === recurso.origem
        && item.tipo === recurso.tipo
        && item.arquivo === recurso.arquivo
        && item.nome === recurso.nome
        && item.simbolo === recurso.simbolo)) {
        existentes.push(recurso);
        mapa.set(variante, existentes);
      }
    }
  }
  return mapa;
}

function recursoResolvidoCombinaEsperado(recurso: RecursoResolvido, esperado: RecursoEsperadoDrift): boolean {
  if (esperado.origem && recurso.origem !== esperado.origem) {
    return false;
  }
  if (esperado.tiposAceitos.length > 0 && !esperado.tiposAceitos.includes(recurso.tipo)) {
    return false;
  }
  const recursoVariantes = new Set(variantesNomeRecursoDrift(recurso.nome));
  return esperado.nomes.some((nome) =>
    variantesNomeRecursoDrift(nome).some((variante) => recursoVariantes.has(variante)));
}

function resolverRecursoEsperado(
  mapaRecursos: Map<string, RecursoResolvido[]>,
  esperado: RecursoEsperadoDrift,
  arquivosPreferidos?: Set<string>,
): RecursoResolvido | undefined {
  const candidatos = new Map<string, RecursoResolvido>();
  for (const nome of esperado.nomes) {
    for (const variante of variantesNomeRecursoDrift(nome)) {
      for (const recurso of mapaRecursos.get(variante) ?? []) {
        if (recursoResolvidoCombinaEsperado(recurso, esperado)) {
          candidatos.set(`${recurso.origem}:${recurso.tipo}:${recurso.nome}:${recurso.arquivo}:${recurso.simbolo ?? ""}`, recurso);
        }
      }
    }
  }

  return [...candidatos.values()].sort((a, b) =>
    Number(Boolean(arquivosPreferidos?.has(b.arquivo))) - Number(Boolean(arquivosPreferidos?.has(a.arquivo)))
    || a.arquivo.localeCompare(b.arquivo, "pt-BR")
    || a.nome.localeCompare(b.nome, "pt-BR"))[0];
}

function coletarVinculosIr(ir: IrModulo): Array<{ donoTipo: RegistroVinculoDrift["donoTipo"]; dono: string; vinculo: IrVinculo }> {
  return [
    ...ir.vinculos.map((vinculo) => ({ donoTipo: "modulo" as const, dono: ir.nome, vinculo })),
    ...ir.tasks.flatMap((task) => task.vinculos.map((vinculo) => ({ donoTipo: "task" as const, dono: task.nome, vinculo }))),
    ...ir.flows.flatMap((flow: IrFlow) => flow.vinculos.map((vinculo) => ({ donoTipo: "flow" as const, dono: flow.nome, vinculo }))),
    ...ir.routes.flatMap((route: IrRoute) => route.vinculos.map((vinculo) => ({ donoTipo: "route" as const, dono: route.nome, vinculo }))),
    ...ir.superficies.flatMap((superficie: IrSuperficie) => superficie.vinculos.map((vinculo) => ({ donoTipo: "superficie" as const, dono: `${superficie.tipo}:${superficie.nome}`, vinculo }))),
  ];
}

export async function analisarDriftLegado(
  contexto: ContextoProjetoCarregado,
  opcoes?: OpcoesDriftLegado,
): Promise<ResultadoDrift> {
  const opcoesResolvidas = resolverOpcoesDrift(opcoes);
  const configuracaoEscopo: ConfiguracaoEscopoDriftAplicada = {
    escopo: opcoesResolvidas.escopo,
    ignorarWorktrees: opcoesResolvidas.ignorarWorktrees,
    ignorarConsumidoresLaterais: opcoesResolvidas.ignorarConsumidoresLaterais,
    termosEscopo: extrairTermosEscopoDrift(contexto, opcoesResolvidas.escopo),
  };
  const diretoriosIgnoradosAnteriores = diretoriosIgnoradosAtivos;
  diretoriosIgnoradosAtivos = resolverDiretoriosIgnoradosAtivos(opcoesResolvidas);

  try {
  const diretoriosCodigoAtivos = resolverDiretoriosCodigoEscopoReal(contexto, configuracaoEscopo);
  const indexTs = await indexarTypeScript(diretoriosCodigoAtivos);
  const indexPy = await indexarPython(diretoriosCodigoAtivos);
  const indexDart = await indexarDart(diretoriosCodigoAtivos);
  const indexDotnet = await indexarDotnet(diretoriosCodigoAtivos);
  const indexJava = await indexarJava(diretoriosCodigoAtivos);
  const indexGo = await indexarGo(diretoriosCodigoAtivos);
  const indexRust = await indexarRust(diretoriosCodigoAtivos);
  const indexPersistencia = await indexarPersistenciaDeclarativa(diretoriosCodigoAtivos);
  const detalhesPersistencia = await indexarPersistenciaDetalhada(diretoriosCodigoAtivos);
  const indexCpp = await indexarCpp(diretoriosCodigoAtivos);
  const todosSimbolos = [
    ...indexTs.simbolos,
    ...indexPy.simbolos,
    ...indexDart.simbolos,
    ...indexDotnet.simbolos,
    ...indexJava.simbolos,
    ...indexGo.simbolos,
    ...indexRust.simbolos,
    ...indexCpp.simbolos,
  ];
  const mapaImpl = new Map<string, SimboloResolvido>([
    ...indexTs.simbolos.map((item) => [item.caminho, item] as const),
    ...indexPy.simbolos.map((item) => [item.caminho, item] as const),
    ...indexDart.simbolos.map((item) => [item.caminho, item] as const),
    ...indexDotnet.simbolos.map((item) => [item.caminho, item] as const),
    ...indexJava.simbolos.map((item) => [item.caminho, item] as const),
    ...indexGo.simbolos.map((item) => [item.caminho, item] as const),
    ...indexRust.simbolos.map((item) => [item.caminho, item] as const),
    ...indexCpp.simbolos.map((item) => [item.caminho, item] as const),
  ]);
  const todosRecursos = [
    ...indexTs.recursos,
    ...indexPy.recursos,
    ...indexDart.recursos,
    ...indexDotnet.recursos,
    ...indexJava.recursos,
    ...indexGo.recursos,
    ...indexRust.recursos,
    ...indexCpp.recursos,
    ...indexPersistencia.recursos,
  ];
  const mapaRecursos = construirMapaRecursos(todosRecursos);
  const todasRotasIndexadas = [
    ...indexTs.rotas,
    ...indexPy.rotas,
    ...indexDart.rotas,
    ...indexDotnet.rotas,
    ...indexJava.rotas,
    ...indexGo.rotas,
    ...indexRust.rotas,
  ];
  const todosArquivosConhecidos = [...new Set([
    ...todosSimbolos.map((item) => item.arquivo),
    ...todasRotasIndexadas.map((item) => item.arquivo),
    ...todosRecursos.map((item) => item.arquivo),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const implsValidos: RegistroImplDrift[] = [];
  const implsQuebrados: RegistroImplDrift[] = [];
  const vinculosValidos: RegistroVinculoDrift[] = [];
  const vinculosQuebrados: RegistroVinculoDrift[] = [];
  const rotasDivergentes: RegistroRotaDivergente[] = [];
  const recursosValidos: RegistroRecursoDrift[] = [];
  const recursosDivergentes: RegistroRecursoDrift[] = [];
  const diagnosticos: DiagnosticoDrift[] = [];
  const tasksResumo: ResultadoDrift["tasks"] = [];
  const taskPorChave = new Map<string, IrTask>();
  const guardrailsPorTask = new Map<string, {
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
  }>();
  const resumoVinculosPorTask = new Map<string, { validos: number; quebrados: number; arquivos: Set<string> }>();

  for (const item of contexto.modulosSelecionados) {
    const ir = item.resultado.ir;
    if (!ir) {
      continue;
    }
    const superficiesPorChave = new Map<string, IrSuperficie>(
      ir.superficies.map((superficie) => [`${superficie.tipo}:${superficie.nome}`, superficie]),
    );
    for (const task of ir.tasks) {
      guardrailsPorTask.set(`${ir.nome}:${task.nome}`, {
        publica: false,
        sensivel: calcularRiscoOperacional(task) === "alto",
        auth: task.auth.explicita,
        authz: task.authz.explicita,
        dados: task.dados.explicita,
        audit: task.audit.explicita,
        segredos: task.segredos.explicita,
        forbidden: task.forbidden.explicita,
        dadosSensiveis: Boolean(
          task.dados.classificacaoPadrao && ["pii", "financeiro", "credencial", "segredo"].includes(task.dados.classificacaoPadrao)
          || task.dados.campos.some((campo) => ["pii", "financeiro", "credencial", "segredo"].includes(campo.classificacao))
        ),
        efeitoPrivilegiado: task.efeitosEstruturados.some((efeito) =>
          ["db.read", "db.write", "queue.publish", "queue.consume", "fs.read", "fs.write", "network.egress", "secret.read", "shell.exec"].includes(efeito.categoria)
          || ["alta", "critica"].includes(efeito.criticidade ?? ""),
        ),
        exigeSegredos: task.efeitosEstruturados.some((efeito) => efeito.categoria === "secret.read")
          || Boolean(
            task.dados.classificacaoPadrao && ["credencial", "segredo"].includes(task.dados.classificacaoPadrao)
            || task.dados.campos.some((campo) => ["credencial", "segredo"].includes(campo.classificacao))
          ),
      });
    }
    for (const route of ir.routes) {
      if (!route.task || route.perfilCompatibilidade !== "publico") {
        continue;
      }
      const guardrails = guardrailsPorTask.get(`${ir.nome}:${route.task}`);
      if (guardrails) {
        guardrails.publica = true;
        guardrails.auth = guardrails.auth || route.auth.explicita;
        guardrails.authz = guardrails.authz || route.authz.explicita;
        guardrails.dados = guardrails.dados || route.dados.explicita;
        guardrails.audit = guardrails.audit || route.audit.explicita;
        guardrails.segredos = guardrails.segredos || route.segredos.explicita;
        guardrails.forbidden = guardrails.forbidden || route.forbidden.explicita;
        guardrails.dadosSensiveis = guardrails.dadosSensiveis || Boolean(
          route.dados.classificacaoPadrao && ["pii", "financeiro", "credencial", "segredo"].includes(route.dados.classificacaoPadrao)
          || route.dados.campos.some((campo) => ["pii", "financeiro", "credencial", "segredo"].includes(campo.classificacao))
        );
        guardrails.efeitoPrivilegiado = guardrails.efeitoPrivilegiado || route.efeitosPublicos.some((efeito) =>
          ["db.read", "db.write", "queue.publish", "queue.consume", "fs.read", "fs.write", "network.egress", "secret.read", "shell.exec"].includes(efeito.categoria)
          || ["alta", "critica"].includes(efeito.criticidade ?? ""),
        );
        guardrails.exigeSegredos = guardrails.exigeSegredos || route.efeitosPublicos.some((efeito) => efeito.categoria === "secret.read")
          || Boolean(
            route.dados.classificacaoPadrao && ["credencial", "segredo"].includes(route.dados.classificacaoPadrao)
            || route.dados.campos.some((campo) => ["credencial", "segredo"].includes(campo.classificacao))
          );
      }
    }
    for (const superficie of ir.superficies) {
      if (!superficie.task || superficie.perfilCompatibilidade !== "publico") {
        continue;
      }
      const guardrails = guardrailsPorTask.get(`${ir.nome}:${superficie.task}`);
      if (guardrails) {
        guardrails.publica = true;
        guardrails.auth = guardrails.auth || superficie.auth.explicita;
        guardrails.authz = guardrails.authz || superficie.authz.explicita;
        guardrails.dados = guardrails.dados || superficie.dados.explicita;
        guardrails.audit = guardrails.audit || superficie.audit.explicita;
        guardrails.segredos = guardrails.segredos || superficie.segredos.explicita;
        guardrails.forbidden = guardrails.forbidden || superficie.forbidden.explicita;
        guardrails.dadosSensiveis = guardrails.dadosSensiveis || Boolean(
          superficie.dados.classificacaoPadrao && ["pii", "financeiro", "credencial", "segredo"].includes(superficie.dados.classificacaoPadrao)
          || superficie.dados.campos.some((campo) => ["pii", "financeiro", "credencial", "segredo"].includes(campo.classificacao))
        );
        guardrails.efeitoPrivilegiado = guardrails.efeitoPrivilegiado || superficie.effects.some((efeito) =>
          ["db.read", "db.write", "queue.publish", "queue.consume", "fs.read", "fs.write", "network.egress", "secret.read", "shell.exec"].includes(efeito.categoria)
          || ["alta", "critica"].includes(efeito.criticidade ?? ""),
        );
        guardrails.exigeSegredos = guardrails.exigeSegredos || superficie.effects.some((efeito) => efeito.categoria === "secret.read")
          || Boolean(
            superficie.dados.classificacaoPadrao && ["credencial", "segredo"].includes(superficie.dados.classificacaoPadrao)
            || superficie.dados.campos.some((campo) => ["credencial", "segredo"].includes(campo.classificacao))
          );
      }
    }

    for (const task of ir.tasks) {
      taskPorChave.set(`${ir.nome}:${task.nome}`, task);
      let validos = 0;
      let quebrados = 0;
      const arquivosReferenciados = new Set<string>();
      const simbolosReferenciados = new Set<string>();
      const candidatosTask = new Map<string, SimboloCandidatoDrift>();

      if (task.implementacoesExternas.length === 0) {
        for (const candidato of sugerirCandidatosParaTaskSemImpl(todosSimbolos, task.nome)) {
          candidatosTask.set(`${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`, candidato);
        }
        diagnosticos.push({
          tipo: "task_sem_impl",
          modulo: ir.nome,
          task: task.nome,
          mensagem: `Task "${task.nome}" ainda nao foi ligada a nenhuma implementacao externa.`,
        });
      }

      for (const impl of task.implementacoesExternas) {
        const resolvido = mapaImpl.get(impl.caminho);
        const registro: RegistroImplDrift = {
          modulo: ir.nome,
          task: task.nome,
          origem: impl.origem,
          caminho: impl.caminho,
          arquivo: resolvido?.arquivo,
          simbolo: resolvido?.simbolo,
          caminhoResolvido: resolvido?.caminho,
          status: resolvido ? "resolvido" : "quebrado",
        };

        if (resolvido) {
          arquivosReferenciados.add(resolvido.arquivo);
          simbolosReferenciados.add(resolvido.simbolo);
          implsValidos.push(registro);
          validos += 1;
        } else {
          registro.candidatos = sugerirCandidatosParaImpl(todosSimbolos, impl.origem, impl.caminho);
          for (const candidato of registro.candidatos) {
            candidatosTask.set(`${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`, candidato);
          }
          implsQuebrados.push(registro);
          quebrados += 1;
          diagnosticos.push({
            tipo: "impl_quebrado",
            modulo: ir.nome,
            task: task.nome,
            mensagem: `Implementacao externa "${impl.origem}:${impl.caminho}" nao foi encontrada nos diretorios de codigo vivos.`,
          });
        }
      }

      tasksResumo.push({
        modulo: ir.nome,
        task: task.nome,
        impls: task.implementacoesExternas.length,
        implsValidos: validos,
        implsQuebrados: quebrados,
        semImplementacao: task.implementacoesExternas.length === 0,
        scoreSemantico: 0,
        confiancaVinculo: "baixa",
        riscoOperacional: "baixo",
        lacunas: [],
        arquivosReferenciados: [...arquivosReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")),
        arquivosProvaveisEditar: [],
        simbolosReferenciados: [...simbolosReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")),
        candidatosImpl: ordenarCandidatos([...candidatosTask.values()]).slice(0, 5),
        checksSugeridos: [],
      });

      for (const recursoEsperado of extrairRecursosEsperados(task, ir)) {
        let resolvido = resolverRecursoEsperado(mapaRecursos, recursoEsperado, arquivosReferenciados);
        if (!resolvido) {
          resolvido = resolverPersistenciaLocalPorTask(mapaRecursos, task, ir, recursoEsperado)[0];
        }
        const registro: RegistroRecursoDrift = {
          modulo: ir.nome,
          task: task.nome,
          categoria: recursoEsperado.categoria,
          alvo: recursoEsperado.alvo,
          arquivo: resolvido?.arquivo ?? "",
          origem: resolvido?.origem ?? recursoEsperado.origem ?? "firebase",
          tipo: resolvido?.tipo ?? recursoEsperado.tiposAceitos[0] ?? "query",
          status: resolvido ? "resolvido" : "divergente",
        };

        if (resolvido) {
          registro.arquivo = resolvido.arquivo;
          recursosValidos.push(registro);
        } else {
          recursosDivergentes.push(registro);
          const escopo = recursoEsperado.origem ? `${recursoEsperado.origem}` : "persistencia declarada";
          diagnosticos.push({
            tipo: "recurso_divergente",
            modulo: ir.nome,
            task: task.nome,
            mensagem: `Recurso vivo "${recursoEsperado.alvo}" nao foi encontrado no codigo legado para ${escopo}.`,
          });
        }
      }
    }

    for (const route of ir.routes) {
      const taskAssociada = ir.tasks.find((task) => task.nome === route.task);
      const esperadas = escolherRotasEsperadas(taskAssociada ?? {
        nome: "",
        input: [],
        output: [],
        rules: [],
        regrasEstruturadas: [],
        effects: [],
        efeitosEstruturados: [],
        implementacoesExternas: [],
        vinculos: [],
        execucao: {
          idempotencia: false,
          timeout: "padrao",
          retry: "nenhum",
          compensacao: "nenhuma",
          criticidadeOperacional: "media",
          explicita: false,
        },
        auth: {
          explicita: false,
        },
        authz: {
          explicita: false,
          papeis: [],
          escopos: [],
        },
        dados: {
          explicita: false,
          campos: [],
        },
        audit: {
          explicita: false,
        },
        segredos: {
          explicita: false,
          itens: [],
        },
        forbidden: {
          explicita: false,
          regras: [],
        },
        guarantees: [],
        garantiasEstruturadas: [],
        errors: {},
        errosDetalhados: [],
        perfilCompatibilidade: "interno",
        resumoAgente: {
          riscos: [],
          checks: [],
          entidadesAfetadas: [],
          superficiesPublicas: [],
          mutacoesPrevistas: [],
        },
        tests: [],
      }, contexto.fontesLegado);

      if (!esperadas.length || !route.metodo || !route.caminho) {
        continue;
      }

      const encontradas = todasRotasIndexadas.filter((rotaResolvida) =>
        rotaResolvida.origem !== "nextjs-consumer"
        && rotaResolvida.origem !== "react-vite-consumer"
        && rotaResolvida.origem !== "angular-consumer"
        && rotaResolvida.origem !== "flutter-consumer"
        && esperadas.includes(rotaResolvida.origem));
      const combina = encontradas.some((rotaResolvida) =>
        rotaResolvida.metodo === route.metodo
        && normalizarCaminhoRota(rotaResolvida.caminho) === normalizarCaminhoRota(route.caminho));

      if (!combina) {
        const registro = {
          modulo: ir.nome,
          route: route.nome,
          metodo: route.metodo,
          caminho: route.caminho,
          motivo: `Nenhuma rota publica ${route.metodo} ${route.caminho} foi encontrada no codigo legado para o framework esperado.`,
        };
        rotasDivergentes.push(registro);
        diagnosticos.push({
          tipo: "rota_divergente",
          modulo: ir.nome,
          route: route.nome,
          mensagem: registro.motivo,
        });
      }
    }

    for (const itemVinculo of coletarVinculosIr(ir)) {
      const registro: RegistroVinculoDrift = {
        modulo: ir.nome,
        donoTipo: itemVinculo.donoTipo,
        dono: itemVinculo.dono,
        tipo: itemVinculo.vinculo.tipo,
        valor: itemVinculo.vinculo.valor,
        status: "nao_encontrado",
        confianca: "baixa",
      };

      const arquivoDeclarado = itemVinculo.vinculo.arquivo ?? (itemVinculo.vinculo.tipo === "arquivo" ? itemVinculo.vinculo.valor : undefined);
      const simboloDeclarado = itemVinculo.vinculo.simbolo ?? (itemVinculo.vinculo.tipo === "simbolo" ? itemVinculo.vinculo.valor : undefined);
      const recursoDeclarado = itemVinculo.vinculo.recurso ?? (["recurso", "tabela", "fila", "cache", "storage"].includes(itemVinculo.vinculo.tipo) ? itemVinculo.vinculo.valor : undefined);
      const superficieDeclarada = itemVinculo.vinculo.superficie ?? (["superficie", "rota", "worker", "cron", "webhook", "evento", "policy", "fila", "cache", "storage"].includes(itemVinculo.vinculo.tipo) ? itemVinculo.vinculo.valor : undefined);

      if (simboloDeclarado) {
        const resolucaoSimbolo = escolherSimboloPorVinculo(todosSimbolos, mapaImpl, simboloDeclarado);
        registro.status = resolucaoSimbolo.status;
        registro.confianca = resolucaoSimbolo.confianca;
        registro.arquivo = resolucaoSimbolo.simbolo?.arquivo;
        registro.simbolo = resolucaoSimbolo.simbolo?.simbolo;
      } else if (arquivoDeclarado) {
        const resolucaoArquivo = escolherArquivoPorVinculo(todosArquivosConhecidos, arquivoDeclarado);
        registro.status = resolucaoArquivo.status;
        registro.confianca = resolucaoArquivo.confianca;
        registro.arquivo = resolucaoArquivo.arquivo;
      } else if (recursoDeclarado) {
        const recurso = resolverRecursoEsperado(mapaRecursos, {
          categoria: "persistencia",
          alvo: recursoDeclarado,
          tiposAceitos: [],
          nomes: [recursoDeclarado],
        });
        if (recurso) {
          registro.status = "resolvido";
          registro.confianca = "alta";
          registro.arquivo = recurso.arquivo;
        }
      } else if (superficieDeclarada) {
        const rota = todasRotasIndexadas.find((rotaResolvida) =>
          normalizarCaminhoRota(rotaResolvida.caminho) === normalizarCaminhoRota(superficieDeclarada));
        if (rota) {
          registro.status = "resolvido";
          registro.confianca = "alta";
          registro.arquivo = rota.arquivo;
          registro.simbolo = rota.simbolo;
        } else {
          const resolucaoArquivo = escolherArquivoPorVinculo(todosArquivosConhecidos, superficieDeclarada);
          registro.status = resolucaoArquivo.status;
          registro.confianca = resolucaoArquivo.confianca;
          registro.arquivo = resolucaoArquivo.arquivo;
        }
      } else {
        const resolucaoArquivo = escolherArquivoPorVinculo(todosArquivosConhecidos, itemVinculo.vinculo.valor);
        registro.status = resolucaoArquivo.status;
        registro.confianca = resolucaoArquivo.confianca;
        registro.arquivo = resolucaoArquivo.arquivo;
      }

      if (registro.status === "nao_encontrado" && itemVinculo.donoTipo === "superficie") {
        const superficie = superficiesPorChave.get(itemVinculo.dono);
        const ancora = superficie
          ? encontrarAncoraSuperficie(ir, superficie, todosSimbolos, mapaImpl, todosArquivosConhecidos)
          : undefined;
        if (ancora) {
          registro.status = "parcial";
          registro.confianca = ancora.confianca === "alta" ? "media" : ancora.confianca;
          registro.arquivo = registro.arquivo ?? ancora.arquivo;
          registro.simbolo = registro.simbolo ?? ancora.simbolo;
        }
      }

      if (registro.status === "nao_encontrado") {
        vinculosQuebrados.push(registro);
        diagnosticos.push({
          tipo: "vinculo_quebrado",
          modulo: ir.nome,
          mensagem: `Vinculo ${registro.tipo}="${registro.valor}" de ${registro.donoTipo} "${registro.dono}" nao foi resolvido no codigo vivo.`,
          ...(itemVinculo.donoTipo === "task" ? { task: itemVinculo.dono } : itemVinculo.donoTipo === "route" ? { route: itemVinculo.dono } : {}),
        });
      } else {
        vinculosValidos.push(registro);
      }

      if (itemVinculo.donoTipo === "task") {
        const chaveTask = `${ir.nome}:${itemVinculo.dono}`;
        const resumo = resumoVinculosPorTask.get(chaveTask) ?? {
          validos: 0,
          quebrados: 0,
          arquivos: new Set<string>(),
        };
        if (registro.status === "nao_encontrado") {
          resumo.quebrados += 1;
        } else {
          resumo.validos += 1;
        }
        if (registro.arquivo) {
          resumo.arquivos.add(registro.arquivo);
        }
        resumoVinculosPorTask.set(chaveTask, resumo);
      }
    }
  }

  for (const resumo of tasksResumo) {
    const chaveTask = `${resumo.modulo}:${resumo.task}`;
    const task = taskPorChave.get(chaveTask);
    const guardrails = guardrailsPorTask.get(chaveTask) ?? {
      publica: false,
      sensivel: false,
      auth: false,
      authz: false,
      dados: false,
      audit: false,
      segredos: false,
      forbidden: false,
      dadosSensiveis: false,
      efeitoPrivilegiado: false,
      exigeSegredos: false,
    };
    const resumoVinculos = resumoVinculosPorTask.get(chaveTask) ?? {
      validos: 0,
      quebrados: 0,
      arquivos: new Set<string>(),
    };
    if (!task) {
      continue;
    }

    resumo.confiancaVinculo = calcularConfiancaTask(task, resumo.implsValidos, resumo.implsQuebrados, resumoVinculos.validos, resumoVinculos.quebrados);
    resumo.riscoOperacional = calcularRiscoOperacional(task);
    resumo.lacunas = resumirLacunasTask(task, resumo.semImplementacao, resumo.implsQuebrados, resumoVinculos.quebrados, guardrails);
    resumo.scoreSemantico = calcularScoreTask(task, resumo.implsValidos, resumo.implsQuebrados, resumoVinculos.validos, resumoVinculos.quebrados, resumo.semImplementacao);
    resumo.arquivosProvaveisEditar = [...new Set([
      ...resumo.arquivosReferenciados,
      ...resumo.candidatosImpl.map((candidato) => candidato.arquivo),
      ...resumoVinculos.arquivos,
    ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    resumo.checksSugeridos = [...new Set([
      ...task.resumoAgente.checks,
      resumo.riscoOperacional !== "baixo" ? "revisar efeitos operacionais" : "",
      resumo.lacunas.includes("vinculo_quebrado") ? "corrigir vinculos rastreaveis" : "",
      resumo.lacunas.some((lacuna) => ["superficie_publica_sem_execucao", "execucao_critica_sem_bloco", "rastreabilidade_fraca"].includes(lacuna))
        ? "endurecer execucao e rastreabilidade para producao"
        : "",
      resumo.lacunas.some((lacuna) => ["auth_ausente", "authz_frouxa", "dados_nao_classificados", "audit_ausente", "segredo_sem_governanca", "proibicoes_ausentes"].includes(lacuna))
        ? "explicitar contratos de seguranca semantica"
        : "",
    ].filter(Boolean))];

    if (resumo.lacunas.includes("superficie_publica_sem_execucao")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" alimenta superficie publica, mas ainda depende de execucao implicita.`,
      });
    }
    if (resumo.lacunas.includes("execucao_critica_sem_bloco")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" opera com risco alto, mas ainda nao declarou execucao explicita.`,
      });
    }
    if (resumo.lacunas.includes("rastreabilidade_fraca")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" exige producao mais rastreavel, mas ainda nao declara impl nem vinculos.`,
      });
    }
    if (resumo.lacunas.includes("auth_ausente")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" chega em superficie publica sem auth explicita em task, route ou superficie associada.`,
      });
    }
    if (resumo.lacunas.includes("authz_frouxa")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" opera com risco ou exposicao, mas ainda nao explicita authz suficiente.`,
      });
    }
    if (resumo.lacunas.includes("dados_nao_classificados")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" ainda nao classifica dados de entrada/saida de forma semantica.`,
      });
    }
    if (resumo.lacunas.includes("audit_ausente")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" ainda nao declara audit explicita para operacao sensivel ou publica.`,
      });
    }
    if (resumo.lacunas.includes("segredo_sem_governanca")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" toca segredo ou credencial sem bloco segredos governando origem, escopo e rotacao.`,
      });
    }
    if (resumo.lacunas.includes("proibicoes_ausentes")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" opera com efeito privilegiado ou dado sensivel sem forbidden explicito para conter abuso e vazamento.`,
      });
    }
  }

  const relevanciaConsumer = construirContextoRelevanciaConsumer(contexto, tasksResumo, vinculosValidos);
  const consumersFiltrados = filtrarConsumerSurfacesPorEscopo(
    [...indexTs.consumerSurfaces, ...indexDart.consumerSurfaces].sort((a, b) =>
      a.rota.localeCompare(b.rota, "pt-BR")
      || a.tipoArquivo.localeCompare(b.tipoArquivo, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR")),
    [...new Map(
      [...indexTs.simbolos, ...indexDart.simbolos]
        .filter((simbolo) => simboloEhBridgeConsumer(simbolo.caminho, simbolo.arquivo))
        .map((simbolo) => [
          `${simbolo.caminho}:${simbolo.arquivo}:${simbolo.simbolo}`,
          {
            caminho: simbolo.caminho,
            arquivo: simbolo.arquivo,
            simbolo: simbolo.simbolo,
          },
        ] as const),
    ).values()].sort((a, b) =>
      a.caminho.localeCompare(b.caminho, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR")),
    contexto,
    configuracaoEscopo,
    relevanciaConsumer,
  );
  const consumerSurfaces = consumersFiltrados.consumerSurfaces;
  const consumerBridges = consumersFiltrados.consumerBridges;
  const appRoutes = [...new Set(consumerSurfaces.map((surface) => surface.rota))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const consumerFramework = inferirConsumerFrameworkPrincipal(contexto.fontesLegado, consumerSurfaces, consumerBridges);
  const persistenciaReal = await analisarPersistenciaReal(contexto, mapaRecursos, detalhesPersistencia, opcoesResolvidas);
  for (const item of persistenciaReal) {
    if (item.status === "divergente") {
      diagnosticos.push({
        tipo: "recurso_divergente",
        modulo: item.modulo,
        task: item.task,
        mensagem: `Persistencia real para "${item.alvo}" ainda nao foi materializada no codigo vivo.`,
      });
    } else if (item.compatibilidade === "invalido") {
      diagnosticos.push({
        tipo: "recurso_divergente",
        modulo: item.modulo,
        task: item.task,
        mensagem: `Persistencia real para "${item.alvo}" conflita com a compatibilidade declarada do engine ${item.engine}.`,
      });
    }
  }

  const payloadBase: ResultadoDrift = {
    comando: "drift",
    sucesso: implsQuebrados.length === 0
      && rotasDivergentes.length === 0
      && recursosDivergentes.length === 0
      && vinculosQuebrados.length === 0
      && persistenciaReal.every((item) => item.status !== "divergente" && item.compatibilidade !== "invalido"),
    escopo_aplicado: configuracaoEscopo,
    consumerFramework,
    appRoutes,
    consumerSurfaces,
    consumerBridges,
    modulos: contexto.modulosSelecionados.map((item) => ({
      caminho: item.caminho,
      modulo: item.resultado.ir?.nome ?? item.resultado.modulo?.nome ?? null,
      tasks: item.resultado.ir?.tasks.length ?? 0,
      routes: item.resultado.ir?.routes.length ?? 0,
    })),
    tasks: tasksResumo,
    impls_validos: implsValidos,
    impls_quebrados: implsQuebrados,
    vinculos_validos: vinculosValidos,
    vinculos_quebrados: vinculosQuebrados,
    rotas_divergentes: rotasDivergentes,
    recursos_validos: recursosValidos,
    recursos_divergentes: recursosDivergentes,
    persistencia_real: persistenciaReal,
    diagnosticos,
    resumo_operacional: {
      scoreMedio: 0,
      confiancaGeral: "baixa" as const,
      riscosPrincipais: [],
      oQueTocar: [],
      oQueValidar: [],
      oQueEstaFrouxo: [],
      oQueFoiInferido: [],
    },
  };
  const resumoOperacional = resumirOperacional(payloadBase);

  return {
    ...payloadBase,
    resumo_operacional: resumoOperacional,
  };
  } finally {
    diretoriosIgnoradosAtivos = diretoriosIgnoradosAnteriores;
  }
}

const EXTENSOES_BUSCA_IMPACTO = [
  ".sema",
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".dart", ".cs", ".java", ".go", ".rs", ".cpp", ".cc", ".cxx", ".hpp", ".h",
  ".sql", ".psql", ".ddl", ".prisma", ".json",
];

function construirVariantesSemanticas(valor: string): string[] {
  const bruto = valor.trim();
  const partes = paraIdentificadorModulo(valor).split("_").filter(Boolean);
  if (!bruto && partes.length === 0) {
    return [];
  }
  const camel = partes.length > 0
    ? `${partes[0]}${partes.slice(1).map((item) => item[0]?.toUpperCase() + item.slice(1)).join("")}`
    : bruto;
  const pascal = partes.length > 0
    ? partes.map((item) => item[0]?.toUpperCase() + item.slice(1)).join("")
    : bruto;
  return [...new Set([
    bruto,
    partes.join("_"),
    partes.join("-"),
    partes.join("."),
    camel,
    pascal,
  ].filter(Boolean))];
}

function classificarArquivoImpacto(arquivo: string): RegistroImpactoSemanticoArquivo["tipo"] {
  const normalizado = normalizarFragmentoArquivo(arquivo);
  if (normalizado.endsWith(".sema")) {
    return "contrato";
  }
  if (/\.(sql|psql|ddl|prisma)$/i.test(normalizado) || /(?:^|\/)(?:db|database|migrations?|schemas?)\//i.test(normalizado)) {
    return "persistencia";
  }
  if (/(?:^|\/)(?:repositorio|repositorios|repository|repositories|repo|dao|store)\//i.test(normalizado) || /(repository|repositorio|dao|store)/i.test(path.basename(normalizado))) {
    return "repositorio";
  }
  if (/(?:^|\/)(?:routes?|controllers?|api)\//i.test(normalizado) || /(controller|route)/i.test(path.basename(normalizado))) {
    return "rota";
  }
  if (/(?:^|\/)(?:workers?|jobs?|queues?|cron)\//i.test(normalizado) || /(worker|job|queue|cron)/i.test(path.basename(normalizado))) {
    return "worker";
  }
  if (/(?:^|\/)(?:pages|screens|components|views|app)\//i.test(normalizado)) {
    return "ui";
  }
  if (/(?:^|\/)(?:tests?|specs?|__tests__)\//i.test(normalizado) || /\.(spec|test)\./i.test(normalizado)) {
    return "teste";
  }
  return "codigo";
}

function prioridadeArquivoImpacto(tipo: RegistroImpactoSemanticoArquivo["tipo"]): RegistroImpactoSemanticoArquivo["prioridade"] {
  switch (tipo) {
    case "contrato":
    case "persistencia":
    case "repositorio":
    case "rota":
      return "alta";
    case "worker":
    case "codigo":
      return "media";
    default:
      return "baixa";
  }
}

function textoIrCombinaTermos(texto: string, termos: string[]): boolean {
  return textoCombinaEscopo(texto, termos);
}

function registrarArquivoImpactado(
  mapa: Map<string, RegistroImpactoSemanticoArquivo>,
  arquivo: string,
  linhas: number[],
  motivos: string[],
): void {
  const tipo = classificarArquivoImpacto(arquivo);
  const atual = mapa.get(arquivo);
  if (atual) {
    atual.linhas = [...new Set([...atual.linhas, ...linhas])].sort((a, b) => a - b);
    atual.motivos = [...new Set([...atual.motivos, ...motivos])];
    if (prioridadeArquivoImpacto(tipo) === "alta") {
      atual.prioridade = "alta";
    } else if (prioridadeArquivoImpacto(tipo) === "media" && atual.prioridade === "baixa") {
      atual.prioridade = "media";
    }
    return;
  }

  mapa.set(arquivo, {
    arquivo,
    tipo,
    prioridade: prioridadeArquivoImpacto(tipo),
    linhas: [...new Set(linhas)].sort((a, b) => a - b),
    motivos: [...new Set(motivos)],
  });
}

async function listarArquivosImpacto(
  contexto: ContextoProjetoCarregado,
  opcoes?: OpcoesDriftLegado,
): Promise<string[]> {
  const opcoesResolvidas = resolverOpcoesDrift(opcoes);
  const arquivos = new Set<string>(filtrarCaminhosEscopoReal(contexto.arquivosProjeto, contexto, opcoesResolvidas));
  for (const diretorio of resolverDiretoriosCodigoEscopoReal(contexto, opcoesResolvidas)) {
    for (const arquivo of await listarArquivosRecursivos(diretorio, EXTENSOES_BUSCA_IMPACTO)) {
      arquivos.add(arquivo);
    }
  }
  return [...arquivos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function extrairLinhasComVariantes(codigo: string, variantes: string[]): number[] {
  const linhas: number[] = [];
  const texto = codigo.split(/\r?\n/);
  for (let indice = 0; indice < texto.length; indice += 1) {
    if (variantes.some((variante) => variante && texto[indice]!.includes(variante))) {
      linhas.push(indice + 1);
    }
  }
  return linhas;
}

function serializarTaskParaImpacto(task: IrTask): string {
  return JSON.stringify({
    nome: task.nome,
    input: task.input.map((campo) => campo.nome),
    output: task.output.map((campo) => campo.nome),
    effects: task.effects,
    guarantees: task.guarantees,
    errors: task.errors,
    resumo: task.resumoAgente,
  });
}

function serializarRouteParaImpacto(route: IrRoute): string {
  return JSON.stringify({
    nome: route.nome,
    caminho: route.caminho,
    metodo: route.metodo,
    task: route.task,
    input: route.inputPublico.map((campo) => campo.nome),
    output: route.outputPublico.map((campo) => campo.nome),
  });
}

function serializarSuperficieParaImpacto(superficie: IrSuperficie): string {
  return JSON.stringify({
    tipo: superficie.tipo,
    nome: superficie.nome,
    task: superficie.task,
    input: superficie.input.map((campo) => campo.nome),
    output: superficie.output.map((campo) => campo.nome),
  });
}

function ordenarArquivosImpacto(arquivos: RegistroImpactoSemanticoArquivo[]): RegistroImpactoSemanticoArquivo[] {
  const ordemPrioridade = { alta: 0, media: 1, baixa: 2 } as const;
  return [...arquivos].sort((a, b) =>
    ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade]
    || a.tipo.localeCompare(b.tipo, "pt-BR")
    || a.arquivo.localeCompare(b.arquivo, "pt-BR"));
}

export async function gerarMapaImpactoSemantico(
  contexto: ContextoProjetoCarregado,
  alvoSemantico: string,
  mudancaProposta: string,
  opcoes?: OpcoesDriftLegado,
): Promise<ResultadoImpactoSemantico> {
  const opcoesResolvidas = resolverOpcoesDrift(opcoes);
  const diretoriosIgnoradosAnteriores = diretoriosIgnoradosAtivos;
  diretoriosIgnoradosAtivos = resolverDiretoriosIgnoradosAtivos(opcoesResolvidas);

  try {
    const drift = await analisarDriftLegado(contexto, opcoesResolvidas);
    const variantes = construirVariantesSemanticas(alvoSemantico);
    const termos = [...new Set([...quebrarTermosEscopo(alvoSemantico), ...drift.escopo_aplicado.termosEscopo])];
    const arquivosImpactados = new Map<string, RegistroImpactoSemanticoArquivo>();
    const arquivosBusca = await listarArquivosImpacto(contexto, opcoesResolvidas);

    for (const arquivo of arquivosBusca) {
      const codigo = await readFile(arquivo, "utf8");
      const linhas = extrairLinhasComVariantes(codigo, variantes);
      if (linhas.length > 0) {
        registrarArquivoImpactado(arquivosImpactados, arquivo, linhas, ["token_semantico_encontrado"]);
      }
    }

    const tasksAfetadas = new Set<string>();
    const routesAfetadas = new Set<string>();
    const superficiesAfetadas = new Set<string>();
    const persistenciaAfetada = new Set<string>();

    for (const item of contexto.modulosSelecionados) {
      const ir = item.resultado.ir;
      if (!ir) {
        continue;
      }
      for (const task of ir.tasks) {
        if (textoIrCombinaTermos(serializarTaskParaImpacto(task), termos)) {
          tasksAfetadas.add(`${ir.nome}.${task.nome}`);
        }
      }
      for (const route of ir.routes) {
        if (textoIrCombinaTermos(serializarRouteParaImpacto(route), termos)) {
          routesAfetadas.add(`${ir.nome}.${route.nome}`);
        }
      }
      for (const superficie of ir.superficies) {
        if (textoIrCombinaTermos(serializarSuperficieParaImpacto(superficie), termos)) {
          superficiesAfetadas.add(`${ir.nome}.${superficie.tipo}.${superficie.nome}`);
        }
      }
    }

    for (const task of drift.tasks.filter((item) => tasksAfetadas.has(`${item.modulo}.${item.task}`))) {
      for (const arquivo of task.arquivosProvaveisEditar) {
        registrarArquivoImpactado(arquivosImpactados, arquivo, [], ["arquivo_relacionado_por_drift"]);
      }
    }

    for (const item of drift.persistencia_real) {
      if (textoIrCombinaTermos(`${item.alvo} ${item.task} ${item.colunas.join(" ")}`, termos)) {
        persistenciaAfetada.add(`${item.task}:${item.alvo}`);
        for (const arquivo of [...item.arquivos, ...item.repositorios]) {
          registrarArquivoImpactado(arquivosImpactados, arquivo, [], ["persistencia_relacionada"]);
        }
      }
    }

    const contratosAfetados = ordenarArquivosImpacto(
      [...arquivosImpactados.values()].filter((arquivo) => arquivo.tipo === "contrato"),
    ).map((arquivo) => arquivo.arquivo);

    return {
      comando: "impacto",
      sucesso: arquivosImpactados.size > 0 || tasksAfetadas.size > 0 || persistenciaAfetada.size > 0,
      escopo: drift.escopo_aplicado.escopo,
      alvoSemantico,
      mudancaProposta,
      contratosAfetados,
      tasksAfetadas: [...tasksAfetadas].sort((a, b) => a.localeCompare(b, "pt-BR")),
      routesAfetadas: [...routesAfetadas].sort((a, b) => a.localeCompare(b, "pt-BR")),
      superficiesAfetadas: [...superficiesAfetadas].sort((a, b) => a.localeCompare(b, "pt-BR")),
      persistenciaAfetada: [...persistenciaAfetada].sort((a, b) => a.localeCompare(b, "pt-BR")),
      arquivos: ordenarArquivosImpacto([...arquivosImpactados.values()]),
      ordemOperacional: [
        "Atualizar contrato .sema e revisar garantias publicas primeiro.",
        "Ajustar persistencia e repositorios concretos antes de materializacao externa.",
        "Revisar rotas, workers e bridges depois que o contrato e o storage estiverem coerentes.",
        "Fechar com UI/consumidores e testes alinhados ao payload final.",
      ],
      validacoes: [
        "Rodar sema validar no contrato alterado.",
        "Rodar sema drift com o mesmo escopo apos a mudanca.",
        "Revalidar testes de payload, persistencia e superficies publicas.",
      ],
    };
  } finally {
    diretoriosIgnoradosAtivos = diretoriosIgnoradosAnteriores;
  }
}

export async function assistirRenomeacaoSemantica(
  contexto: ContextoProjetoCarregado,
  nomeAtual: string,
  nomeNovo: string,
  opcoes?: OpcoesDriftLegado,
): Promise<ResultadoRenomeacaoSemantica> {
  const impacto = await gerarMapaImpactoSemantico(
    contexto,
    nomeAtual,
    `renomear ${nomeAtual} para ${nomeNovo}`,
    opcoes,
  );
  const variantesAntigas = construirVariantesSemanticas(nomeAtual);
  const variantesNovas = construirVariantesSemanticas(nomeNovo);
  const mapaSubstituicao = new Map<string, string>();
  variantesAntigas.forEach((antiga, indice) => {
    mapaSubstituicao.set(antiga, variantesNovas[indice] ?? nomeNovo);
  });

  const sugestoes: SugestaoRenomeacaoSemantica[] = [];
  for (const arquivo of impacto.arquivos) {
    const codigo = await readFile(arquivo.arquivo, "utf8");
    const linhas = codigo.split(/\r?\n/);
    for (let indice = 0; indice < linhas.length; indice += 1) {
      const linha = linhas[indice]!;
      for (const antiga of variantesAntigas) {
        if (!antiga || !linha.includes(antiga)) {
          continue;
        }
        sugestoes.push({
          arquivo: arquivo.arquivo,
          linha: indice + 1,
          atual: antiga,
          sugerido: mapaSubstituicao.get(antiga) ?? nomeNovo,
          contexto: linha.trim().slice(0, 180),
        });
      }
    }
  }

  return {
    comando: "renomear-semantico",
    sucesso: sugestoes.length > 0,
    escopo: impacto.escopo,
    de: nomeAtual,
    para: nomeNovo,
    arquivos: impacto.arquivos,
    sugestoes,
    ordemOperacional: [
      "Renomear primeiro no contrato .sema e nos campos publicos derivados.",
      "Ajustar repositorios, payloads e bridges que materializam o nome antigo.",
      "Rodar sema drift e revisar sugestoes restantes antes de fechar a troca.",
    ],
    validacoes: [
      "Rodar sema validar no contrato renomeado.",
      "Rodar sema drift para confirmar que payload e superficie nao ficaram misturados.",
      "Reexecutar testes e checar snapshots ou fixtures afetados.",
    ],
  };
}
