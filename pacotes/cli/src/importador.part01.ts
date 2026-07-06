// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { compilarProjeto, formatarCodigo, temErros, type Diagnostico } from "@sema/nucleo";
import { normalizarSegmentoModulo } from "@sema/padroes";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { extrairRotasPhp, extrairSimbolosPhp } from "./php-http.js";
import { extrairParametrosCaminhoFlask, extrairRotasFlaskDecoradas } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import {
  extrairRotasTypeScriptHttp,
  inferirSemanticaHandlerTypeScriptHttp,
  localizarExportacaoTypeScriptHttp,
  type CampoInferidoTypeScriptHttp,
} from "./typescript-http.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";

export type FonteImportacao =
  | "nestjs"
  | "fastapi"
  | "flask"
  | "nextjs"
  | "nextjs-consumer"
  | "react-vite-consumer"
  | "angular-consumer"
  | "flutter-consumer"
  | "firebase"
  | "typescript"
  | "python"
  | "dart"
  | "dotnet"
  | "java"
  | "go"
  | "rust"
  | "cpp"
  | "php";

export type OrigemInteropImportada = "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp" | "php";

export interface CampoImportado {
  nome: string;
  tipo: string;
  obrigatorio: boolean;
}

export interface ErroImportado {
  nome: string;
  mensagem: string;
}

export interface EfeitoImportado {
  categoria: "persistencia" | "consulta" | "evento" | "notificacao" | "auditoria";
  alvo: string;
  criticidade?: "baixa" | "media" | "alta";
}

export interface VinculoImportado {
  tipo: string;
  valor: string;
}

export interface EnumImportado {
  nome: string;
  valores: string[];
}

export interface EntidadeImportada {
  nome: string;
  campos: CampoImportado[];
}

export interface TarefaImportada {
  nome: string;
  resumo: string;
  input: CampoImportado[];
  output: CampoImportado[];
  errors: ErroImportado[];
  effects: EfeitoImportado[];
  impl?: Partial<Record<OrigemInteropImportada, string>>;
  vinculos?: VinculoImportado[];
  origemArquivo: string;
  origemSimbolo: string;
}

export interface RotaImportada {
  nome: string;
  resumo: string;
  metodo: string;
  caminho: string;
  task: string;
  input: CampoImportado[];
  output: CampoImportado[];
  errors: ErroImportado[];
}

export interface RecursoDatabaseImportado {
  tipo: "table" | "query" | "collection" | "document" | "keyspace" | "stream";
  nome: string;
  mode?: "sql" | "documento" | "chave_valor" | "pipeline" | "stream";
  table?: string;
  collection?: string;
  ttl?: string;
  surface?: string;
}

export interface DatabaseImportado {
  nome: string;
  resumo: string;
  engine: "postgres" | "mysql" | "sqlite" | "mongodb" | "redis";
  queryModel?: "sql" | "documento" | "chave_valor" | "pipeline" | "stream";
  transactionModel?: "mvcc" | "bloqueio" | "documento" | "single_thread";
  resources: RecursoDatabaseImportado[];
  diagnostics?: string[];
}

export interface ModuloImportado {
  nome: string;
  resumo: string;
  enums: EnumImportado[];
  entities: EntidadeImportada[];
  tasks: TarefaImportada[];
  routes: RotaImportada[];
  databases?: DatabaseImportado[];
  vinculos?: VinculoImportado[];
}

export interface ArquivoImportado {
  caminhoRelativo: string;
  conteudo: string;
  modulo: string;
  tarefas: number;
  rotas: number;
  entidades: number;
  enums: number;
  databases: number;
}

export interface ResultadoImportacao {
  fonte: FonteImportacao;
  diretorio: string;
  namespaceBase: string;
  arquivos: ArquivoImportado[];
  diagnosticos: Diagnostico[];
}

export interface TipoObjetoDescoberto {
  tipo: "objeto";
  nome: string;
  campos: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

export interface TipoEnumDescoberto {
  tipo: "enum";
  nome: string;
  valores: string[];
}

export type TipoDescoberto = TipoObjetoDescoberto | TipoEnumDescoberto;

export interface ContextoTsArquivo {
  sourceFile: ts.SourceFile;
  texto: string;
  relacao: string;
}

export interface TipoPythonDescoberto {
  tipo: "objeto" | "enum";
  nome: string;
  campos?: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
  valores?: string[];
}

export const DIRETORIOS_IGNORADOS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".gradle",
  ".cargo",
  "node_modules",
  "dist",
  "build",
  "bin",
  "obj",
  ".next",
  ".nuxt",
  ".dart_tool",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
  ".tmp",
  "generated",
  "vendor",
  "ephemeral",
]);

export const SUFIXOS_WRAPPER = ["Entrada", "Saida", "Dto", "Request", "Response", "Payload", "Body", "Input", "Output"];

export const NOMES_RESERVADOS_CAMPO = new Set([
  "module",
  "use",
  "type",
  "entity",
  "enum",
  "task",
  "input",
  "output",
  "rules",
  "effects",
  "impl",
  "guarantees",
  "state",
  "flow",
  "route",
  "tests",
  "error",
  "docs",
  "comments",
  "fields",
  "invariants",
  "transitions",
  "given",
  "when",
  "expect",
  "caso",
  "required",
]);

export function escaparTexto(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function paraSnakeCase(valor: string): string {
  return valor
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function paraIdentificadorModulo(valor: string): string {
  return normalizarSegmentoModulo(valor).replace(/_+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

export function normalizarNomeCampoImportado(valor: string): string {
  const normalizado = paraSnakeCase(valor);
  return NOMES_RESERVADOS_CAMPO.has(normalizado)
    ? `${normalizado}_campo`
    : normalizado;
}

export function nomeProjetoPadrao(diretorio: string): string {
  const base = path.basename(diretorio);
  if (["src", "app", "api", "backend", "server"].includes(base.toLowerCase())) {
    return `${path.basename(path.dirname(diretorio))}.${base}`;
  }
  return base;
}

export function inferirNamespaceBase(diretorio: string, namespaceExplicito?: string): string {
  if (namespaceExplicito) {
    return namespaceExplicito
      .split(".")
      .map((segmento) => paraIdentificadorModulo(segmento))
      .filter(Boolean)
      .join(".");
  }

  return ["legado", ...nomeProjetoPadrao(diretorio).split(/[\\/._-]+/g)]
    .map((segmento) => paraIdentificadorModulo(segmento))
    .filter(Boolean)
    .join(".");
}

export async function listarArquivosRecursivos(
  diretorio: string,
  extensoes: string[],
): Promise<string[]> {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const encontrados: string[] = [];

  for (const entrada of entradas) {
    if (DIRETORIOS_IGNORADOS.has(entrada.name)) {
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

export function inferirContextoPorArquivo(
  relacao: string,
  opcoes?: { preservarUltimo?: boolean; snakeCaseUltimo?: boolean },
): string[] {
  const semExtensao = relacao.replace(/\.[^.]+$/, "");
  const segmentosOriginais = semExtensao.split(path.sep).filter(Boolean);
  const segmentos = segmentosOriginais.map((segmento) => paraIdentificadorModulo(segmento)).filter(Boolean);
  if (segmentos[0] === "src" || segmentos[0] === "app") {
    segmentos.shift();
    segmentosOriginais.shift();
  }

  const ultimo = segmentos.at(-1) ?? "";
  const semSufixo = ultimo
    .replace(/(\.controller|\.service|\.module|_router|_service|_schemas|_contract)$/g, "")
    .replace(/(controller|service|module|router|schemas|contract)$/g, "")
    .replace(/_+$/g, "");

  if (segmentos.length === 0) {
    return ["importado"];
  }

  if (!opcoes?.preservarUltimo && semSufixo && semSufixo !== ultimo) {
    segmentos[segmentos.length - 1] = semSufixo;
  }

  if (opcoes?.snakeCaseUltimo && segmentos.length > 0) {
    segmentos[segmentos.length - 1] = paraSnakeCase(segmentosOriginais[segmentosOriginais.length - 1] ?? ultimo);
  }

  if (segmentos.length > 1 && segmentos[segmentos.length - 1] === segmentos[segmentos.length - 2]) {
    segmentos.pop();
  }

  return segmentos;
}

export function juntarCaminhoHttp(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base ?? "", sufixo ?? ""]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\/+|\/+$/g, ""));

  const caminho = `/${partes.join("/")}`.replace(/\/+/g, "/");
  return caminho === "//" ? "/" : caminho;
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

export function mapearTipoPrimitivo(tipo: string): string {
  const limpo = tipo.trim().replace(/\s+/g, "");
  const base = limpo
    .replace(/^Promise<(.*)>$/, "$1")
    .replace(/^Future<(.*)>$/, "$1")
    .replace(/\|undefined/g, "")
    .replace(/\|null/g, "")
    .replace(/\bundefined\|/g, "")
    .replace(/\bnull\|/g, "")
    .trim();

  const minusculo = base.toLowerCase();
  if (minusculo === "string" || minusculo === "texto") {
    return "Texto";
  }
  if (minusculo === "number" || minusculo === "float" || minusculo === "double") {
    return "Decimal";
  }
  if (minusculo === "int" || minusculo === "integer" || minusculo === "inteiro") {
    return "Inteiro";
  }
  if (minusculo === "boolean" || minusculo === "bool") {
    return "Booleano";
  }
  if (minusculo === "date") {
    return "Data";
  }
  if (minusculo === "datetime" || minusculo === "timestamp") {
    return "DataHora";
  }
  if (minusculo === "id" || minusculo.endsWith("id")) {
    return "Id";
  }
  if (
    minusculo.includes("[]")
    || minusculo.startsWith("array<")
    || minusculo.startsWith("record<")
    || minusculo.startsWith("map<")
    || minusculo.startsWith("list<")
    || minusculo.startsWith("list[")
    || minusculo.startsWith("dict[")
  ) {
    return "Json";
  }
  if (
    minusculo === "json"
    || minusculo === "object"
    || minusculo === "unknown"
    || minusculo === "any"
    || minusculo === "dynamic"
    || minusculo === "void"
    || minusculo === "none"
  ) {
    return minusculo === "void" || minusculo === "none" ? "Vazio" : "Json";
  }
  return tipo.trim();
}

export function limparTipoBackend(tipo: string | undefined): string | undefined {
  if (!tipo) {
    return undefined;
  }
  return tipo
    .trim()
    .replace(/^Task<(.+)>$/i, "$1")
    .replace(/^ActionResult<(.+)>$/i, "$1")
    .replace(/^IActionResult$/i, "Json")
    .replace(/^Results<(.+)>$/i, "$1")
    .replace(/^ResponseEntity<(.+)>$/i, "$1")
    .replace(/^Optional<(.+)>$/i, "$1")
    .replace(/^Result<(.+)>$/i, "$1")
    .replace(/^impl\s+IntoResponse$/i, "Json")
    .replace(/^Json<(.+)>$/i, "$1")
    .replace(/^Option<(.+)>$/i, "$1")
    .replace(/^Vec<(.+)>$/i, "Json")
    .replace(/^List<(.+)>$/i, "Json")
    .replace(/^Map<(.+)>$/i, "Json")
    .replace(/^Dictionary<(.+)>$/i, "Json");
}
