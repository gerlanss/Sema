// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.governanca_ia.drift.cache.store
// Descrição: declara o estado público de cache sem transformar aceleração em evidência final.
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
import { paraIdentificadorModulo } from "./drift.part04.js";
import type { MetricasCatalogoDrift, ObservadorOperacaoDrift } from "./driftCatalogo.js";
import type { CoberturaEscopoDrift, EstrategiaEscopoDrift } from "./driftEscopo.js";
import type { AvisoModoCacheDrift, ModoCacheDrift } from "./driftCacheModes.js";
export type OrigemCodigoDrift = "ts" | "js" | "py" | "dart" | "lua" | "cs" | "java" | "go" | "rust" | "cpp" | "php";
export type OrigemSimboloDrift = OrigemCodigoDrift | "sql";
export interface SimboloResolvido {
  origem: OrigemSimboloDrift;
  caminho: string;
  arquivo: string;
  simbolo: string;
}
export type ConsumerFramework = "nextjs-consumer" | "react-vite-consumer" | "angular-consumer" | "flutter-consumer";
export interface RotaResolvida {
  origem: "nestjs" | "express" | "fastify" | "fastapi" | "flask" | "nextjs" | ConsumerFramework | "firebase" | "dotnet" | "java" | "go" | "rust" | "php";
  metodo: string;
  caminho: string;
  arquivo: string;
  simbolo: string;
}
export interface RegistroConsumerSurfaceDrift {
  rota: string;
  arquivo: string;
  tipoArquivo: string;
}
export interface RegistroConsumerBridgeDrift {
  caminho: string;
  arquivo: string;
  simbolo: string;
}
export type EscopoDriftReal = "arquivo" | "modulo" | "projeto";
export interface OpcoesDriftLegado {
  escopo?: EscopoDriftReal;
  ignorarWorktrees?: boolean;
  ignorarConsumidoresLaterais?: boolean;
  modoCache?: ModoCacheDrift;
  avisosModoCache?: readonly AvisoModoCacheDrift[];
  observador?: ObservadorOperacaoDrift | undefined;
}
export interface DiagnosticoDrift {
  tipo:
    | "impl_quebrado"
    | "task_sem_impl"
    | "rota_divergente"
    | "recurso_divergente"
    | "vinculo_quebrado"
    | "seguranca_frouxa"
    | "pontuacao_semantica_insuficiente"
    | "contrato_monolitico"
    | "codigo_monolitico"
    | "codigo_governado_sem_cabecalho"
    | "escopo_estreito_sem_vinculos"
    | "escopo_estreito_ambiguo";
  modulo: string;
  task?: string;
  route?: string;
  arquivo?: string;
  linhas?: number;
  severidade?: "aviso" | "erro";
  limite_bloqueio_linhas?: number;
  frameworksEsperados?: string[];
  mensagem: string;
}
export interface RegistroImplDrift {
  modulo: string;
  task: string;
  origem: OrigemCodigoDrift;
  caminho: string;
  arquivo?: string;
  simbolo?: string;
  caminhoResolvido?: string;
  status: "resolvido" | "quebrado";
  candidatos?: SimboloCandidatoDrift[];
}
export interface RegistroRotaDivergente {
  modulo: string;
  route: string;
  metodo?: string;
  caminho?: string;
  motivo: string;
}
export type OrigemRecursoDrift = "firebase" | EngineBanco | "arquivo";
export type TipoRecursoDrift = "colecao" | TipoRecursoPersistencia | "arquivo_local";
export type CategoriaPersistenciaDrift = "relacional" | "documental" | "chave_valor" | "local_arquivo" | "desconhecida";
export interface RecursoResolvido {
  origem: OrigemRecursoDrift;
  nome: string;
  arquivo: string;
  simbolo?: string;
  tipo: TipoRecursoDrift;
}
export interface RegistroRecursoDrift {
  modulo: string;
  task: string;
  categoria: "persistencia";
  alvo: string;
  arquivo: string;
  origem: OrigemRecursoDrift;
  tipo: TipoRecursoDrift;
  status: "resolvido" | "divergente";
}
export interface RecursoEsperadoDrift {
  categoria: "persistencia";
  alvo: string;
  origem?: OrigemRecursoDrift;
  tiposAceitos: TipoRecursoDrift[];
  nomes: string[];
}
export interface RegistroColunaPersistenciaDrift {
  origem: OrigemRecursoDrift;
  categoriaPersistencia: CategoriaPersistenciaDrift;
  recurso: string;
  coluna: string;
  arquivo: string;
}
export interface RegistroRepositorioPersistenciaDrift {
  origem: OrigemRecursoDrift;
  categoriaPersistencia: CategoriaPersistenciaDrift;
  recurso: string;
  arquivo: string;
}
export interface SimboloCandidatoDrift {
  origem: OrigemCodigoDrift;
  caminho: string;
  arquivo: string;
  simbolo: string;
  confianca: "alta" | "media";
  motivo: string;
}
export type AncoragemVinculoTaskDrift = "propria" | "herdada_modulo" | "ausente";
export interface ResumoTaskDrift {
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
  ancoragemVinculo: AncoragemVinculoTaskDrift;
  arquivosReferenciados: string[];
  arquivosAncoraHerdados: string[];
  arquivosProvaveisEditar: string[];
  simbolosReferenciados: string[];
  candidatosImpl: SimboloCandidatoDrift[];
  checksSugeridos: string[];
}
export interface RegistroVinculoDrift {
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
  estrategia?: EstrategiaEscopoDrift;
  cobertura?: CoberturaEscopoDrift;
  arquivosPlanejados?: string[];
  arquivosDeclarados?: string[];
  arquivosInferidos?: string[];
  arquivosAusentes?: string[];
  bloqueios?: string[];
  catalogo?: MetricasCatalogoDrift;
  cache?: EstadoCacheDriftAplicado;
}
export interface MetricasCacheDriftAplicado {
  hits: number;
  misses: number;
  corruptos: number;
  gravacoes: number;
  errosGravacao: number;
}
export interface EstadoCacheDriftAplicado {
  modo: ModoCacheDrift;
  origem: "cache" | "calculado" | "indisponivel" | "nao_aplicavel";
  schema: string;
  workspaceId?: string;
  metricas: MetricasCacheDriftAplicado;
  avisos: readonly AvisoModoCacheDrift[];
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
    pontuacaoMinimaOperacional: number;
    pontuacaoAlvoAtual: number;
    pontuacaoAlvoFinal: number;
    passoEvolucaoPontuacao: number;
    proximaPontuacaoAlvo: number;
    pontuacaoAbaixoDoPiso: boolean;
    pontuacaoAbaixoDoAlvo: boolean;
    travasPontuacao: string[];
    riscosPrincipais: string[];
    oQueTocar: string[];
    oQueValidar: string[];
    oQueEstaFrouxo: string[];
    oQueFoiInferido: string[];
  };
  diagnosticos: DiagnosticoDrift[];
}
export const DIRETORIOS_IGNORADOS_BASE = new Set([
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
export const DIRETORIOS_WORKTREE = [
  ".claude",
  "worktrees",
];
export const DIRETORIOS_CONSUMIDOR_LATERAL = [
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
export const TERMOS_ESCopo_IGNORADOS = new Set([
  "api",
  "app",
  "apps",
  "antes",
  "base",
  "codigo",
  "config",
  "contra",
  "controller",
  "controllers",
  "data",
  "drift",
  "flow",
  "int",
  "module",
  "modulo",
  "para",
  "publico",
  "route",
  "routes",
  "schema",
  "sem",
  "sema",
  "service",
  "services",
  "src",
  "task",
  "tasks",
  "testes",
  "tests",
  "ui",
  "web",
]);
export let diretoriosIgnoradosAtivos = new Set(DIRETORIOS_IGNORADOS_BASE);
export function obterDiretoriosIgnoradosAtivos(): Set<string> {
  return diretoriosIgnoradosAtivos;
}
export function definirDiretoriosIgnoradosAtivos(diretorios: Set<string>): void {
  diretoriosIgnoradosAtivos = diretorios;
}
export function normalizarFragmentoArquivo(valor: string): string {
  return valor.replace(/\\/g, "/").replace(/^\.?\//, "").trim().toLowerCase();
}
export function normalizarEscopoDrift(valor?: string): EscopoDriftReal {
  if (valor === "arquivo" || valor === "modulo" || valor === "projeto") {
    return valor;
  }
  return "modulo";
}
export function resolverOpcoesDrift(opcoes?: OpcoesDriftLegado):
  Omit<Required<OpcoesDriftLegado>, "observador"> & { observador: ObservadorOperacaoDrift | undefined } {
  return {
    escopo: normalizarEscopoDrift(opcoes?.escopo),
    ignorarWorktrees: opcoes?.ignorarWorktrees !== false,
    ignorarConsumidoresLaterais: opcoes?.ignorarConsumidoresLaterais !== false,
    modoCache: opcoes?.modoCache ?? "none",
    avisosModoCache: opcoes?.avisosModoCache ?? [],
    observador: opcoes?.observador,
  };
}
export function resolverDiretoriosIgnoradosAtivos(opcoes?: OpcoesDriftLegado): Set<string> {
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
export function quebrarTermosEscopo(valor: string): string[] {
  return paraIdentificadorModulo(valor)
    .split("_")
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !TERMOS_ESCopo_IGNORADOS.has(item));
}
export function quebrarTermosModuloEscopo(nomeModulo: string): string[] {
  const segmentos = nomeModulo
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);
  const relevantes = segmentos.length > 1 ? segmentos.slice(1) : segmentos;
  return relevantes.flatMap((segmento) => quebrarTermosEscopo(segmento));
}
export function extrairTermosEscopoDrift(contexto: ContextoProjetoCarregado, escopo: EscopoDriftReal): string[] {
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
export function categorizarPersistenciaPorOrigem(origem?: OrigemRecursoDrift): CategoriaPersistenciaDrift {
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
export function caminhoTemSegmentoIgnorado(arquivo: string, segmentos: string[]): boolean {
  const partes = normalizarFragmentoArquivo(arquivo).split("/").filter(Boolean);
  return partes.some((parte) => segmentos.includes(parte));
}
