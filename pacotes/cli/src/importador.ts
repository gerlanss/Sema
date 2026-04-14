import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { compilarProjeto, formatarCodigo, temErros, type Diagnostico } from "@sema/nucleo";
import { normalizarSegmentoModulo } from "@sema/padroes";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
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
  | "cpp";

type OrigemInteropImportada = "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";

interface CampoImportado {
  nome: string;
  tipo: string;
  obrigatorio: boolean;
}

interface ErroImportado {
  nome: string;
  mensagem: string;
}

interface EfeitoImportado {
  categoria: "persistencia" | "consulta" | "evento" | "notificacao" | "auditoria";
  alvo: string;
  criticidade?: "baixa" | "media" | "alta";
}

interface VinculoImportado {
  tipo: string;
  valor: string;
}

interface EnumImportado {
  nome: string;
  valores: string[];
}

interface EntidadeImportada {
  nome: string;
  campos: CampoImportado[];
}

interface TarefaImportada {
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

interface RotaImportada {
  nome: string;
  resumo: string;
  metodo: string;
  caminho: string;
  task: string;
  input: CampoImportado[];
  output: CampoImportado[];
  errors: ErroImportado[];
}

interface RecursoDatabaseImportado {
  tipo: "table" | "query" | "collection" | "document" | "keyspace" | "stream";
  nome: string;
  mode?: "sql" | "documento" | "chave_valor" | "pipeline" | "stream";
  table?: string;
  collection?: string;
  ttl?: string;
  surface?: string;
}

interface DatabaseImportado {
  nome: string;
  resumo: string;
  engine: "postgres" | "mysql" | "sqlite" | "mongodb" | "redis";
  queryModel?: "sql" | "documento" | "chave_valor" | "pipeline" | "stream";
  transactionModel?: "mvcc" | "bloqueio" | "documento" | "single_thread";
  resources: RecursoDatabaseImportado[];
  diagnostics?: string[];
}

interface ModuloImportado {
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

interface TipoObjetoDescoberto {
  tipo: "objeto";
  nome: string;
  campos: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

interface TipoEnumDescoberto {
  tipo: "enum";
  nome: string;
  valores: string[];
}

type TipoDescoberto = TipoObjetoDescoberto | TipoEnumDescoberto;

interface ContextoTsArquivo {
  sourceFile: ts.SourceFile;
  texto: string;
  relacao: string;
}

interface TipoPythonDescoberto {
  tipo: "objeto" | "enum";
  nome: string;
  campos?: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
  valores?: string[];
}

const DIRETORIOS_IGNORADOS = new Set([
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

const SUFIXOS_WRAPPER = ["Entrada", "Saida", "Dto", "Request", "Response", "Payload", "Body", "Input", "Output"];
const NOMES_RESERVADOS_CAMPO = new Set([
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

function escaparTexto(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function paraSnakeCase(valor: string): string {
  return valor
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function paraIdentificadorModulo(valor: string): string {
  return normalizarSegmentoModulo(valor).replace(/_+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function normalizarNomeCampoImportado(valor: string): string {
  const normalizado = paraSnakeCase(valor);
  return NOMES_RESERVADOS_CAMPO.has(normalizado)
    ? `${normalizado}_campo`
    : normalizado;
}

function nomeProjetoPadrao(diretorio: string): string {
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

async function listarArquivosRecursivos(
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

function inferirContextoPorArquivo(
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

function juntarCaminhoHttp(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base ?? "", sufixo ?? ""]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\/+|\/+$/g, ""));

  const caminho = `/${partes.join("/")}`.replace(/\/+/g, "/");
  return caminho === "//" ? "/" : caminho;
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

function mapearTipoPrimitivo(tipo: string): string {
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

function limparTipoBackend(tipo: string | undefined): string | undefined {
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

function mapearTipoBackendParaSema(tipo: string | undefined): string {
  const limpo = limparTipoBackend(tipo);
  if (!limpo) {
    return "Json";
  }
  const basico = mapearTipoPrimitivo(limpo);
  if (basico !== limpo) {
    return basico;
  }
  if (/\[\]$/.test(limpo) || /^(IEnumerable|IReadOnlyList|List|Vec|HashMap|Map|Dictionary)</.test(limpo)) {
    return "Json";
  }
  if (/^(void|unit|\(\)|nil)$/i.test(limpo)) {
    return "Vazio";
  }
  if (/\b(uuid|guid)\b/i.test(limpo)) {
    return "Id";
  }
  return "Json";
}

function criarCampoResultadoBackend(tipo: string | undefined): CampoImportado[] {
  const tipoSema = mapearTipoBackendParaSema(tipo);
  return tipoSema === "Vazio"
    ? []
    : [{ nome: "resultado", tipo: tipoSema, obrigatorio: false }];
}

function camposDeParametrosRotaBackend(
  parametros: Array<{ nome: string; tipoSema: "Texto" | "Inteiro" | "Decimal" | "Id" }>,
): CampoImportado[] {
  return parametros.map((parametro) => ({
    nome: normalizarNomeCampoImportado(parametro.nome),
    tipo: parametro.tipoSema,
    obrigatorio: true,
  }));
}

function pareceWrapperTipo(nome: string): boolean {
  return SUFIXOS_WRAPPER.some((sufixo) => nome.endsWith(sufixo)) || /(entrada|saida|dto|request|response|payload|body|input|output)/i.test(nome);
}

function descreverEfeitosPorHeuristica(codigo: string): EfeitoImportado[] {
  const texto = codigo.toLowerCase();
  const efeitos: EfeitoImportado[] = [];

  const adicionar = (categoria: EfeitoImportado["categoria"], alvo: string, criticidade?: EfeitoImportado["criticidade"]) => {
    if (!efeitos.some((efeito) => efeito.categoria === categoria && efeito.alvo === alvo)) {
      efeitos.push({ categoria, alvo, criticidade });
    }
  };

  if (/(prisma\.|repository\.|\.create\(|\.update\(|\.delete\(|\.save\()/i.test(codigo)) {
    adicionar("persistencia", "banco", "alta");
  }
  if (/(findmany|findunique|findfirst|\.find\(|\.select\(|\.query\(|\.get\()/i.test(texto)) {
    adicionar("consulta", "dados", "media");
  }
  if (/(emit\(|publish\(|dispatch\(|eventbus|event_emitter)/i.test(texto)) {
    adicionar("evento", "dominio", "media");
  }
  if (/(notify|notification|sendmessage|send_email|telegram|smtp|mail)/i.test(texto)) {
    adicionar("notificacao", "usuarios", "media");
  }
  if (/(audit|logger|logging|log\.|trace|observability)/i.test(texto)) {
    adicionar("auditoria", "operacao", "baixa");
  }

  return efeitos;
}

function deduplicarDatabases(databases: DatabaseImportado[]): DatabaseImportado[] {
  const mapa = new Map<string, DatabaseImportado>();
  for (const database of databases) {
    const chave = `${database.engine}:${database.nome}`;
    const existente = mapa.get(chave);
    if (!existente) {
      mapa.set(chave, {
        ...database,
        resources: [...database.resources],
        diagnostics: [...(database.diagnostics ?? [])],
      });
      continue;
    }

    const recursos = new Map<string, RecursoDatabaseImportado>();
    for (const recurso of [...existente.resources, ...database.resources]) {
      recursos.set(`${recurso.tipo}:${recurso.nome}`, recurso);
    }
    existente.resources = [...recursos.values()];
    existente.diagnostics = [...new Set([...(existente.diagnostics ?? []), ...(database.diagnostics ?? [])])];
  }

  return [...mapa.values()];
}

function inferirDatabasesPorHeuristica(codigo: string, relacao: string): DatabaseImportado[] {
  const databases: DatabaseImportado[] = [];
  const adicionar = (database: DatabaseImportado) => {
    databases.push(database);
  };

  const texto = codigo.toLowerCase();

  if (/(postgresql|postgres\b|node-postgres|pg\.pool|pgclient|typeorm.+postgres|sequelize.+postgres|provider\s*=\s*["']postgresql["'])/i.test(codigo)) {
    adicionar({
      nome: "principal_postgres",
      resumo: `Persistencia PostgreSQL inferida automaticamente de ${relacao}.`,
      engine: "postgres",
      queryModel: "sql",
      transactionModel: "mvcc",
      resources: [
        { tipo: "table", nome: "tabelas_relacionais", table: "legado_principal" },
        { tipo: "query", nome: "consultas_sql", mode: "sql" },
      ],
      diagnostics: ["inferido_por_heuristica"],
    });
  }

  if (/(mysql\b|mariadb|mysql2|typeorm.+mysql|sequelize.+mysql|provider\s*=\s*["']mysql["'])/i.test(codigo)) {
    adicionar({
      nome: "principal_mysql",
      resumo: `Persistencia MySQL inferida automaticamente de ${relacao}.`,
      engine: "mysql",
      queryModel: "sql",
      transactionModel: "bloqueio",
      resources: [
        { tipo: "table", nome: "tabelas_relacionais", table: "legado_principal" },
        { tipo: "query", nome: "consultas_sql", mode: "sql" },
      ],
      diagnostics: ["inferido_por_heuristica"],
    });
  }

  if (/(sqlite\b|better-sqlite3|provider\s*=\s*["']sqlite["'])/i.test(codigo)) {
    adicionar({
      nome: "principal_sqlite",
      resumo: `Persistencia SQLite inferida automaticamente de ${relacao}.`,
      engine: "sqlite",
      queryModel: "sql",
      transactionModel: "single_thread",
      resources: [
        { tipo: "table", nome: "tabelas_locais", table: "legado_local" },
        { tipo: "query", nome: "consultas_locais", mode: "sql" },
      ],
      diagnostics: ["inferido_por_heuristica"],
    });
  }

  if (/(mongodb|mongoose|mongo\.collection|mongoclient|prisma.+mongodb|provider\s*=\s*["']mongodb["'])/i.test(codigo)) {
    adicionar({
      nome: "principal_mongodb",
      resumo: `Persistencia MongoDB inferida automaticamente de ${relacao}.`,
      engine: "mongodb",
      queryModel: "documento",
      transactionModel: "documento",
      resources: [
        { tipo: "collection", nome: "colecoes_documentais", collection: "documentos" },
        { tipo: "document", nome: "documentos_agregados", mode: /aggregate|\$match|\$group/i.test(codigo) ? "pipeline" : "documento" },
      ],
      diagnostics: ["inferido_por_heuristica"],
    });
  }

  if (/(redis\b|ioredis|upstash|bullmq|xadd|xreadgroup)/i.test(codigo)) {
    adicionar({
      nome: "principal_redis",
      resumo: `Persistencia Redis inferida automaticamente de ${relacao}.`,
      engine: "redis",
      queryModel: "chave_valor",
      transactionModel: "single_thread",
      resources: [
        { tipo: "keyspace", nome: "estado_chaves", ttl: /\bttl\b|expire\(/i.test(codigo) ? "300s" : undefined },
        { tipo: "stream", nome: "eventos_stream", surface: /bullmq|queue|worker/i.test(codigo) ? "fila" : "evento" },
      ],
      diagnostics: ["inferido_por_heuristica"],
    });
  }

  return deduplicarDatabases(databases);
}

function normalizarNomeErroBruto(nome: string): string {
  return paraSnakeCase(nome.replace(/(Error|Erro|Exception)$/i, "")) || "erro_importado";
}

function extrairErrosTs(node: ts.Node, sourceFile: ts.SourceFile): ErroImportado[] {
  const encontrados = new Map<string, string>();

  const visitar = (atual: ts.Node): void => {
    if (ts.isThrowStatement(atual) && atual.expression) {
      const expressao = atual.expression;
      if (ts.isNewExpression(expressao)) {
        const nomeErro = expressao.expression.getText(sourceFile);
        const mensagem = extrairTextoLiteral(expressao.arguments?.[0]) ?? `Erro importado automaticamente de ${nomeErro}.`;
        encontrados.set(normalizarNomeErroBruto(nomeErro), mensagem);
      }
    }
    atual.forEachChild(visitar);
  };

  node.forEachChild(visitar);
  return [...encontrados.entries()].map(([nome, mensagem]) => ({ nome, mensagem }));
}

function extrairTiposTs(sourceFile: ts.SourceFile): Map<string, TipoDescoberto> {
  const tipos = new Map<string, TipoDescoberto>();

  const adicionarObjeto = (nome: string, campos: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>) => {
    if (!campos.length || tipos.has(nome)) {
      return;
    }
    tipos.set(nome, { tipo: "objeto", nome, campos });
  };

  const adicionarEnum = (nome: string, valores: string[]) => {
    if (!valores.length || tipos.has(nome)) {
      return;
    }
    tipos.set(nome, { tipo: "enum", nome, valores });
  };

  sourceFile.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const campos = node.members
        .filter(ts.isPropertySignature)
        .map((member) => ({
          nome: member.name.getText(sourceFile),
          tipoTexto: member.type?.getText(sourceFile),
          obrigatorio: !member.questionToken,
        }));
      adicionarObjeto(node.name.text, campos);
      return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const campos = node.members
        .filter((member): member is ts.PropertyDeclaration => ts.isPropertyDeclaration(member) && Boolean(member.name))
        .map((member) => ({
          nome: member.name.getText(sourceFile),
          tipoTexto: member.type?.getText(sourceFile),
          obrigatorio: !member.questionToken,
        }));
      adicionarObjeto(node.name.text, campos);
      return;
    }

    if (ts.isTypeAliasDeclaration(node) && node.name) {
      if (ts.isUnionTypeNode(node.type) && node.type.types.every((tipo) => ts.isLiteralTypeNode(tipo) && ts.isStringLiteralLike(tipo.literal))) {
        adicionarEnum(
          node.name.text,
          node.type.types
            .map((tipo) => ts.isLiteralTypeNode(tipo) && ts.isStringLiteralLike(tipo.literal) ? tipo.literal.text : undefined)
            .filter((valor): valor is string => Boolean(valor)),
        );
        return;
      }
      if (ts.isTypeLiteralNode(node.type)) {
        const campos = node.type.members
          .filter(ts.isPropertySignature)
          .map((member) => ({
            nome: member.name.getText(sourceFile),
            tipoTexto: member.type?.getText(sourceFile),
            obrigatorio: !member.questionToken,
          }));
        adicionarObjeto(node.name.text, campos);
      }
    }
  });

  return tipos;
}

function mapearTipoTsParaSema(
  tipoTexto: string | undefined,
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): string {
  if (!tipoTexto) {
    return "Json";
  }

  const basico = mapearTipoPrimitivo(tipoTexto);
  if (basico !== tipoTexto.trim()) {
    return basico;
  }

  const limpo = tipoTexto
    .trim()
    .replace(/^Promise<(.*)>$/, "$1")
    .replace(/\| undefined/g, "")
    .replace(/\| null/g, "")
    .replace(/Readonly<(.+)>/, "$1")
    .replace(/Partial<(.+)>/, "$1")
    .trim();

  if (tipos.has(limpo)) {
    const encontrado = tipos.get(limpo)!;
    if (encontrado.tipo === "enum") {
      enumsReferenciados.add(encontrado.nome);
      return encontrado.nome;
    }

    if (!pareceWrapperTipo(encontrado.nome)) {
      entidadesReferenciadas.add(encontrado.nome);
      return encontrado.nome;
    }
  }

  return "Json";
}

function expandirCamposTs(
  nomeParametro: string,
  tipoTexto: string | undefined,
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
  obrigatorio: boolean,
): CampoImportado[] {
  if (!tipoTexto) {
    return [{ nome: normalizarNomeCampoImportado(nomeParametro), tipo: "Json", obrigatorio }];
  }

  const limpo = tipoTexto
    .trim()
    .replace(/^Promise<(.*)>$/, "$1")
    .replace(/\| undefined/g, "")
    .replace(/\| null/g, "")
    .replace(/Readonly<(.+)>/, "$1")
    .replace(/Partial<(.+)>/, "$1")
    .trim();

  const descoberto = tipos.get(limpo);
  if (descoberto?.tipo === "objeto" && pareceWrapperTipo(descoberto.nome)) {
    return descoberto.campos.map((campo) => ({
      nome: normalizarNomeCampoImportado(campo.nome),
      tipo: mapearTipoTsParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
      obrigatorio: campo.obrigatorio,
    }));
  }

  return [{
    nome: normalizarNomeCampoImportado(nomeParametro),
    tipo: mapearTipoTsParaSema(tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
    obrigatorio,
  }];
}

function criarEntidadesReferenciadas(
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): { entities: EntidadeImportada[]; enums: EnumImportado[] } {
  const fila = [...entidadesReferenciadas];
  const processadas = new Set<string>();
  const entities: EntidadeImportada[] = [];

  while (fila.length > 0) {
    const nomeAtual = fila.shift()!;
    if (processadas.has(nomeAtual)) {
      continue;
    }
    processadas.add(nomeAtual);
    const tipo = tipos.get(nomeAtual);
    if (!tipo || tipo.tipo !== "objeto") {
      continue;
    }

      const entidade: EntidadeImportada = {
        nome: tipo.nome,
        campos: tipo.campos.map((campo) => ({
          nome: normalizarNomeCampoImportado(campo.nome),
          tipo: mapearTipoTsParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
          obrigatorio: campo.obrigatorio,
        })),
      };
    entities.push(entidade);

    for (const referenciado of entidadesReferenciadas) {
      if (!processadas.has(referenciado) && !fila.includes(referenciado)) {
        fila.push(referenciado);
      }
    }
  }

  const enums = [...enumsReferenciados]
    .map((nome) => tipos.get(nome))
    .filter((item): item is TipoEnumDescoberto => Boolean(item && item.tipo === "enum"))
    .map((tipo) => ({
      nome: tipo.nome,
      valores: tipo.valores,
    }))
    .filter((enumItem, indice, lista) => lista.findIndex((item) => item.nome === enumItem.nome) === indice);

  return { entities: deduplicarEntidades(entities), enums };
}

function caminhoImplTs(diretorioBase: string, arquivo: string, simbolo: string): string {
  const relativo = path.relative(diretorioBase, arquivo).replace(/\.[^.]+$/, "");
  const segmentos = relativo.split(path.sep).map((segmento) => paraIdentificadorModulo(segmento)).filter(Boolean);
  return [...segmentos, simbolo].join(".");
}

function mapearCampoInferidoTypeScriptHttp(
  campo: CampoInferidoTypeScriptHttp,
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): CampoImportado {
  const tipoBasico = campo.tipoTexto ? mapearTipoPrimitivo(campo.tipoTexto) : "Json";
  return {
    nome: paraSnakeCase(campo.nome),
    tipo: ["Texto", "Decimal", "Inteiro", "Booleano", "Data", "DataHora", "Id", "Json", "Vazio"].includes(tipoBasico)
      ? tipoBasico
      : campo.tipoTexto
        ? mapearTipoTsParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados)
        : "Json",
    obrigatorio: campo.obrigatorio,
  };
}

function camposDeSemanticaTypeScriptHttp(
  campos: CampoInferidoTypeScriptHttp[],
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): CampoImportado[] {
  return campos.map((campo) => mapearCampoInferidoTypeScriptHttp(campo, tipos, entidadesReferenciadas, enumsReferenciados));
}

function camposEstruturadosTypeScriptHttp(
  nomeParametro: string,
  tipoTexto: string | undefined,
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): CampoImportado[] {
  const campos = expandirCamposTs(nomeParametro, tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados, false);
  const nomeWrapper = normalizarNomeCampoImportado(nomeParametro);
  if (campos.length === 1 && campos[0]?.nome === nomeWrapper && campos[0]?.tipo === "Json") {
    return [];
  }
  return campos;
}

function errosPorStatusHttp(statuses: number[]): ErroImportado[] {
  return [...new Set(statuses)].map((status) => {
    switch (status) {
      case 401:
        return { nome: "nao_autorizado", mensagem: "Falha HTTP importada automaticamente com status 401." };
      case 403:
        return { nome: "acesso_negado", mensagem: "Falha HTTP importada automaticamente com status 403." };
      case 404:
        return { nome: "nao_encontrado", mensagem: "Falha HTTP importada automaticamente com status 404." };
      case 409:
        return { nome: "conflito", mensagem: "Falha HTTP importada automaticamente com status 409." };
      case 422:
        return { nome: "entrada_invalida", mensagem: "Falha HTTP importada automaticamente com status 422." };
      case 500:
        return { nome: "erro_interno", mensagem: "Falha HTTP importada automaticamente com status 500." };
      default:
        return { nome: `erro_http_${status}`, mensagem: `Falha HTTP importada automaticamente com status ${status}.` };
    }
  });
}

function resolverEscopoImportacaoNextJs(diretorioEntrada: string): { baseProjeto: string; diretorioEscopo: string } {
  const resolvido = path.resolve(diretorioEntrada);
  const partes = path.parse(resolvido);
  const relativoSemRaiz = resolvido.slice(partes.root.length);
  const segmentos = relativoSemRaiz.split(path.sep).filter(Boolean);
  const procurarSequencia = (sequencia: string[]): number =>
    segmentos.findIndex((segmento, indice) => sequencia.every((item, deslocamento) => segmentos[indice + deslocamento]?.toLowerCase() === item));
  const montarBase = (indice: number) =>
    indice <= 0
      ? partes.root
      : path.join(partes.root, ...segmentos.slice(0, indice));

  const indiceSrcAppApi = procurarSequencia(["src", "app", "api"]);
  if (indiceSrcAppApi >= 0) {
    return {
      baseProjeto: montarBase(indiceSrcAppApi),
      diretorioEscopo: resolvido,
    };
  }

  const indiceAppApi = procurarSequencia(["app", "api"]);
  if (indiceAppApi >= 0) {
    return {
      baseProjeto: montarBase(indiceAppApi),
      diretorioEscopo: resolvido,
    };
  }

  const indiceSrcApp = procurarSequencia(["src", "app"]);
  if (indiceSrcApp >= 0) {
    return {
      baseProjeto: montarBase(indiceSrcApp),
      diretorioEscopo: resolvido,
    };
  }

  const indiceApp = procurarSequencia(["app"]);
  if (indiceApp >= 0) {
    return {
      baseProjeto: montarBase(indiceApp),
      diretorioEscopo: resolvido,
    };
  }

  return {
    baseProjeto: resolvido,
    diretorioEscopo: resolvido,
  };
}

interface SuperficieConsumerImportada {
  caminho: string;
  arquivo: string;
  tipoArquivo: string;
}

function normalizarCaminhoImportado(caminhoArquivo: string): string {
  return caminhoArquivo.replace(/\\/g, "/");
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

function montarCaminhoRotaConsumer(partes: string[]): string {
  const filtradas = partes
    .filter((segmento) => segmento && segmento !== "index" && !/^\(.*\)$/.test(segmento) && !segmento.startsWith("@"))
    .map(normalizarSegmentoRotaConsumer);
  return filtradas.length > 0 ? `/${filtradas.join("/")}`.replace(/\/+/g, "/") : "/";
}

function resolverEscopoImportacaoFrontendConsumer(diretorioEntrada: string): { baseProjeto: string; diretorioEscopo: string } {
  const resolvido = path.resolve(diretorioEntrada);
  const partes = path.parse(resolvido);
  const segmentos = resolvido.slice(partes.root.length).split(path.sep).filter(Boolean);
  const procurarSequencia = (sequencia: string[]) =>
    segmentos.findIndex((segmento, indice) => sequencia.every((item, deslocamento) => segmentos[indice + deslocamento]?.toLowerCase() === item));
  const montarBase = (indice: number) =>
    indice <= 0
      ? partes.root
      : path.join(partes.root, ...segmentos.slice(0, indice));

  for (const sequencia of [
    ["src", "pages"],
    ["pages"],
    ["src", "app", "api"],
    ["app", "api"],
    ["src", "app"],
    ["app"],
    ["src", "lib"],
    ["lib"],
  ]) {
    const indice = procurarSequencia(sequencia);
    if (indice >= 0) {
      return {
        baseProjeto: montarBase(indice),
        diretorioEscopo: resolvido,
      };
    }
  }

  return {
    baseProjeto: resolvido,
    diretorioEscopo: resolvido,
  };
}

function arquivoEhBridgeNextJsConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

function arquivoEhBridgeReactViteConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

function arquivoEhBridgeAngularConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|js)$/i.test(relacao);
}

function arquivoEhSuperficieNextJsConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/(?:(?!api\/).)*?(?:page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

function arquivoEhSuperficieReactViteConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /^(?:src\/)?pages\/.+\.(?:ts|tsx|js|jsx)$/i.test(relacao)
    || /^(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

function arquivoEhRotasReactViteConsumer(relacaoArquivo: string, codigo?: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?(?:app\/)?(?:router|routes)\.(?:ts|tsx|js|jsx)$/i.test(relacao)
    || /from\s+["']react-router-dom["']|createBrowserRouter|RouterProvider|useRoutes\s*\(|<Routes\b|<Route\b/.test(codigo ?? "");
}

function arquivoEhRotasAngularConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app(?:\/.+)?\/[^/]+\.routes\.(?:ts|js)$/i.test(relacao);
}

function arquivoEhRotasAngularConsumerRaiz(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/[^/]+\.routes\.(?:ts|js)$/i.test(relacao);
}

function arquivoEhBridgeFlutterConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:sema_consumer_bridge|api\/sema_contract_bridge|sema\/.+)\.dart$/i.test(relacao);
}

function arquivoEhSuperficieFlutterConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:screens|pages)\/.+\.dart$/i.test(relacao)
    || /(?:^|\/)(?:lib\/)?main\.dart$/i.test(relacao);
}

function arquivoEhRotasFlutterConsumer(relacaoArquivo: string, codigo?: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:router|app_router|routes)\.dart$/i.test(relacao)
    || /MaterialApp(?:\.router)?\s*\(|CupertinoApp(?:\.router)?\s*\(|GoRouter\s*\(/.test(codigo ?? "");
}

function inferirCaminhoNextJsConsumer(relacaoArquivo: string): SuperficieConsumerImportada | undefined {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  const segmentos = relacao.split("/");
  const indiceSrcApp = segmentos.findIndex((segmento, indice) =>
    segmento === "src" && segmentos[indice + 1] === "app");
  const indiceApp = segmentos.findIndex((segmento) => segmento === "app");
  const inicioApp = indiceSrcApp >= 0 ? indiceSrcApp + 2 : indiceApp >= 0 ? indiceApp + 1 : -1;
  if (inicioApp < 0) {
    return undefined;
  }

  const arquivoFinal = segmentos.at(-1) ?? "";
  const tipoArquivo = arquivoFinal.match(/^(page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/)?.[1];
  if (!tipoArquivo) {
    return undefined;
  }

  const caminhoAteArquivo = segmentos.slice(inicioApp, -1);
  if (caminhoAteArquivo[0] === "api") {
    return undefined;
  }

  const partes = caminhoAteArquivo
    .filter((segmento) => segmento);

  const caminho = montarCaminhoRotaConsumer(partes);
  return {
    caminho,
    arquivo: relacao,
    tipoArquivo,
  };
}

function inferirCaminhoReactViteConsumer(relacaoArquivo: string): SuperficieConsumerImportada | undefined {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  if (!arquivoEhSuperficieReactViteConsumer(relacao)) {
    return undefined;
  }

  if (/(?:^|\/)(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(relacao)) {
    return {
      caminho: "/",
      arquivo: relacao,
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
  const caminho = montarCaminhoRotaConsumer([...segmentos.slice(inicioPages, -1), nomeBase]);
  return {
    caminho,
    arquivo: relacao,
    tipoArquivo: "page",
  };
}

function inferirCaminhoFlutterConsumer(relacaoArquivo: string): SuperficieConsumerImportada | undefined {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  if (!arquivoEhSuperficieFlutterConsumer(relacao)) {
    return undefined;
  }

  if (/(?:^|\/)(?:lib\/)?main\.dart$/i.test(relacao)) {
    return {
      caminho: "/",
      arquivo: relacao,
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
    caminho: montarCaminhoRotaConsumer([...segmentos.slice(inicio, -1), nomeBase]),
    arquivo: relacao,
    tipoArquivo: "screen",
  };
}

interface RotaReactViteConsumerImportada {
  caminho: string;
  arquivoRotas: string;
  arquivoComponente?: string;
}

interface RotaFlutterConsumerImportada {
  caminho: string;
  arquivoRotas: string;
}

interface RotaAngularConsumerImportada {
  caminho: string;
  arquivoRotas: string;
  arquivoComponente?: string;
  arquivoRotasFilhas?: string;
}

function normalizarRotaDeclaradaConsumer(caminhoCru: string, prefixo = "/"): string {
  const partesPrefixo = prefixo.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const partesCaminho = (caminhoCru ?? "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  return montarCaminhoRotaConsumer([...partesPrefixo, ...partesCaminho]);
}

function resolverImportRelativoTypeScript(relacaoArquivoBase: string, especificador: string): string | undefined {
  if (!especificador.startsWith(".")) {
    return undefined;
  }
  const baseDir = path.posix.dirname(normalizarCaminhoImportado(relacaoArquivoBase));
  for (const sufixo of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]) {
    const candidato = path.posix.normalize(path.posix.join(baseDir, `${especificador}${sufixo}`));
    if (!/\.(?:ts|tsx|js|jsx)$/i.test(candidato)) {
      continue;
    }
    return candidato;
  }
  return undefined;
}

function extrairImportsTypeScriptConsumer(relacaoArquivo: string, codigo: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const match of codigo.matchAll(/import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["']/g)) {
    const moduloImportado = match[2];
    const relacaoImportada = resolverImportRelativoTypeScript(relacaoArquivo, moduloImportado);
    if (!relacaoImportada) {
      continue;
    }
    for (const bruto of match[1].split(",")) {
      const normalizado = bruto.trim();
      if (!normalizado) {
        continue;
      }
      const local = normalizado.split(/\s+as\s+/i).at(-1)?.trim();
      if (local) {
        imports.set(local, relacaoImportada);
      }
    }
  }
  for (const match of codigo.matchAll(/import\s+([A-Za-z_]\w*)\s+from\s*["']([^"']+)["']/g)) {
    const relacaoImportada = resolverImportRelativoTypeScript(relacaoArquivo, match[2]);
    const local = match[1]?.trim();
    if (relacaoImportada && local) {
      imports.set(local, relacaoImportada);
    }
  }
  return imports;
}

function extrairRotasReactViteConsumer(relacaoArquivo: string, codigo: string): RotaReactViteConsumerImportada[] {
  const imports = extrairImportsTypeScriptConsumer(relacaoArquivo, codigo);
  const rotas = new Map<string, RotaReactViteConsumerImportada>();
  const registrar = (caminhoCru: string, componente?: string) => {
    const caminho = normalizarRotaDeclaradaConsumer(caminhoCru);
    const chave = `${caminho}:${normalizarCaminhoImportado(relacaoArquivo)}:${componente ?? "router"}`;
    rotas.set(chave, {
      caminho,
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
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

function extrairRotasAngularConsumerDiretas(
  relacaoArquivo: string,
  codigo: string,
  prefixo = "/",
): RotaAngularConsumerImportada[] {
  const imports = extrairImportsTypeScriptConsumer(relacaoArquivo, codigo);
  const rotas: RotaAngularConsumerImportada[] = [];

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,320}?component\s*:\s*([A-Za-z_]\w*)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const componente = match[2];
    rotas.push({
      caminho: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
      arquivoComponente: imports.get(componente),
    });
  }

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,320}?loadComponent\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const relacaoImportada = resolverImportRelativoTypeScript(relacaoArquivo, match[2] ?? "");
    rotas.push({
      caminho: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
      arquivoComponente: relacaoImportada,
    });
  }

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,360}?loadChildren\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const relacaoImportada = resolverImportRelativoTypeScript(relacaoArquivo, match[2] ?? "");
    rotas.push({
      caminho: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
      arquivoRotasFilhas: relacaoImportada,
    });
  }

  return rotas;
}

async function extrairRotasAngularConsumer(
  baseProjeto: string,
  relacaoArquivo: string,
  prefixo = "/",
  visitados = new Set<string>(),
): Promise<RotaAngularConsumerImportada[]> {
  const relacaoNormalizada = normalizarCaminhoImportado(relacaoArquivo);
  if (visitados.has(relacaoNormalizada)) {
    return [];
  }
  visitados.add(relacaoNormalizada);

  const caminhoAbsoluto = path.join(baseProjeto, relacaoNormalizada);
  let codigo = "";
  try {
    codigo = await readFile(caminhoAbsoluto, "utf8");
  } catch {
    return [];
  }

  const diretas = extrairRotasAngularConsumerDiretas(relacaoNormalizada, codigo, prefixo);
  const agregadas = [...diretas];
  for (const rota of diretas) {
    if (!rota.arquivoRotasFilhas) {
      continue;
    }
    agregadas.push(...await extrairRotasAngularConsumer(baseProjeto, rota.arquivoRotasFilhas, rota.caminho, visitados));
  }
  return agregadas;
}

function normalizarRotaDeclaradaFlutter(caminhoCru: string): string {
  return montarCaminhoRotaConsumer((caminhoCru ?? "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean));
}

function extrairRotasFlutterConsumer(relacaoArquivo: string, codigo: string): RotaFlutterConsumerImportada[] {
  const rotas = new Map<string, RotaFlutterConsumerImportada>();
  const registrar = (caminhoCru: string) => {
    const caminho = normalizarRotaDeclaradaFlutter(caminhoCru);
    rotas.set(`${caminho}:${normalizarCaminhoImportado(relacaoArquivo)}`, {
      caminho,
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
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

async function carregarContextosBridgeConsumer(baseProjeto: string, arquivosBridge: string[]): Promise<ContextoTsArquivo[]> {
  return Promise.all(arquivosBridge.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    const scriptKind = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, scriptKind),
      texto,
      relacao: path.relative(baseProjeto, arquivo),
    };
  }));
}

function extrairTasksBridgeConsumer(
  baseProjeto: string,
  contextosBridge: ContextoTsArquivo[],
): { tasks: TarefaImportada[]; entities: EntidadeImportada[]; enums: EnumImportado[] } {
  const tiposGlobais = consolidarTiposTs(contextosBridge);
  const entitiesRef = new Set<string>();
  const enumsRef = new Set<string>();
  const tasks: TarefaImportada[] = [];

  for (const contexto of contextosBridge) {
    contexto.sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nome = node.name.text;
        const input = node.parameters.flatMap((parametro) =>
          expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
        const output = node.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(node.type.getText(contexto.sourceFile)) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", node.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
        tasks.push({
          nome: nomeTaskBridgeConsumer(nome),
          resumo: `Task consumer importada automaticamente de ${contexto.relacao}#${nome}.`,
          input: deduplicarCampos(input),
          output,
          errors: node.body ? extrairErrosTs(node.body, contexto.sourceFile) : [],
          effects: node.body ? descreverEfeitosPorHeuristica(node.body.getText(contexto.sourceFile)) : [],
          impl: { ts: caminhoImplTs(baseProjeto, path.join(baseProjeto, contexto.relacao), nome) },
          vinculos: deduplicarVinculos([
            { tipo: "arquivo", valor: normalizarCaminhoImportado(contexto.relacao) },
            { tipo: "simbolo", valor: caminhoImplTs(baseProjeto, path.join(baseProjeto, contexto.relacao), nome) },
          ]),
          origemArquivo: contexto.relacao,
          origemSimbolo: nome,
        });
      }

      if (ts.isClassDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nomeClasse = node.name.text;
        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !member.name || !member.body) {
            continue;
          }
          if (member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
            continue;
          }
          const nomeMetodo = member.name.getText(contexto.sourceFile);
          if (nomeMetodo === "constructor") {
            continue;
          }
          const input = member.parameters.flatMap((parametro) =>
            expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
          const output = member.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(member.type.getText(contexto.sourceFile)) === "Vazio"
            ? []
            : deduplicarCampos(expandirCamposTs("resultado", member.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
          const caminhoSimbolo = caminhoImplTs(baseProjeto, path.join(baseProjeto, contexto.relacao), `${nomeClasse}.${nomeMetodo}`);
          tasks.push({
            nome: nomeTaskBridgeConsumer(nomeMetodo),
            resumo: `Task consumer importada automaticamente de ${contexto.relacao}#${nomeClasse}.${nomeMetodo}.`,
            input: deduplicarCampos(input),
            output,
            errors: extrairErrosTs(member.body, contexto.sourceFile),
            effects: descreverEfeitosPorHeuristica(member.body.getText(contexto.sourceFile)),
            impl: { ts: caminhoSimbolo },
            vinculos: deduplicarVinculos([
              { tipo: "arquivo", valor: normalizarCaminhoImportado(contexto.relacao) },
              { tipo: "simbolo", valor: caminhoSimbolo },
            ]),
            origemArquivo: contexto.relacao,
            origemSimbolo: `${nomeClasse}.${nomeMetodo}`,
          });
        }
      }
    });
  }

  const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
  return {
    tasks,
    entities,
    enums,
  };
}

function montarVinculosSuperficiesConsumer(superficies: SuperficieConsumerImportada[]): VinculoImportado[] {
  return deduplicarVinculos(superficies.flatMap((superficie) => [
    { tipo: "superficie", valor: superficie.caminho },
    { tipo: "arquivo", valor: normalizarCaminhoImportado(superficie.arquivo) },
  ]));
}

async function importarConsumerBase(
  diretorio: string,
  namespaceBase: string,
  descricaoFramework: string,
  ehBridge: (relacaoArquivo: string) => boolean,
  coletarSuperficies: (baseProjeto: string, arquivos: string[]) => Promise<SuperficieConsumerImportada[]>,
): Promise<ModuloImportado[]> {
  const escopo = resolverEscopoImportacaoFrontendConsumer(diretorio);
  const arquivos = await listarArquivosRecursivos(escopo.baseProjeto, [".ts", ".tsx", ".js", ".jsx"]);
  const arquivosBridge = arquivos.filter((arquivo) => ehBridge(path.relative(escopo.baseProjeto, arquivo)));
  const contextosBridge = await carregarContextosBridgeConsumer(escopo.baseProjeto, arquivosBridge);
  const { tasks, entities, enums } = extrairTasksBridgeConsumer(escopo.baseProjeto, contextosBridge);
  const superficiesImportadas = await coletarSuperficies(escopo.baseProjeto, arquivos);
  const superficies = montarVinculosSuperficiesConsumer(superficiesImportadas);

  if (tasks.length === 0 && superficies.length === 0) {
    return [];
  }

  const nomeModulo = namespaceBase.endsWith(".consumer")
    ? namespaceBase
    : `${namespaceBase}.consumer`;

  return [{
    nome: nomeModulo,
    resumo: `Rascunho Sema importado automaticamente do consumer ${descricaoFramework} em ${escopo.baseProjeto}.`,
    tasks: deduplicarTarefas(tasks),
    routes: [],
    entities,
    enums,
    vinculos: superficies,
  }];
}

async function coletarSuperficiesNextJsConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  return arquivos
    .map((arquivo) => inferirCaminhoNextJsConsumer(path.relative(baseProjeto, arquivo)))
    .filter((item): item is SuperficieConsumerImportada => Boolean(item));
}

async function coletarSuperficiesReactViteConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  const superficies: SuperficieConsumerImportada[] = [];

  for (const arquivo of arquivos) {
    const relacao = path.relative(baseProjeto, arquivo);
    const codigo = await readFile(arquivo, "utf8");
    if (arquivoEhRotasReactViteConsumer(relacao, codigo)) {
      for (const rota of extrairRotasReactViteConsumer(relacao, codigo)) {
        superficies.push({
          caminho: rota.caminho,
          arquivo: rota.arquivoRotas,
          tipoArquivo: "router",
        });
        if (rota.arquivoComponente) {
          superficies.push({
            caminho: rota.caminho,
            arquivo: rota.arquivoComponente,
            tipoArquivo: "page",
          });
        }
      }
    }
  }

  for (const arquivo of arquivos) {
    const superficie = inferirCaminhoReactViteConsumer(path.relative(baseProjeto, arquivo));
    if (superficie) {
      superficies.push(superficie);
    }
  }

  return superficies;
}

async function coletarSuperficiesAngularConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  const superficies: SuperficieConsumerImportada[] = [];
  const arquivosRotas = arquivos.filter((arquivo) => arquivoEhRotasAngularConsumer(path.relative(baseProjeto, arquivo)));
  const arquivosRaiz = arquivosRotas.filter((arquivo) => arquivoEhRotasAngularConsumerRaiz(path.relative(baseProjeto, arquivo)));
  const pontosEntrada = arquivosRaiz.length > 0 ? arquivosRaiz : arquivosRotas;
  for (const arquivoRotas of pontosEntrada) {
    const relacao = path.relative(baseProjeto, arquivoRotas);
    for (const rota of await extrairRotasAngularConsumer(baseProjeto, relacao)) {
      superficies.push({
        caminho: rota.caminho,
        arquivo: rota.arquivoRotas,
        tipoArquivo: "routes",
      });
      if (rota.arquivoComponente) {
        superficies.push({
          caminho: rota.caminho,
          arquivo: rota.arquivoComponente,
          tipoArquivo: "component",
        });
      }
    }
  }
  if (superficies.length > 0) {
    return superficies;
  }
  return (await coletarSuperficiesAngularStandaloneConsumer(baseProjeto, arquivos)).map((superficie) => ({
    caminho: superficie.rota,
    arquivo: superficie.arquivo,
    tipoArquivo: superficie.tipoArquivo,
  }));
}

async function importarNextJsConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  return importarConsumerBase(
    diretorio,
    namespaceBase,
    "Next.js",
    arquivoEhBridgeNextJsConsumer,
    coletarSuperficiesNextJsConsumer,
  );
}

async function importarReactViteConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  return importarConsumerBase(
    diretorio,
    namespaceBase,
    "React/Vite",
    arquivoEhBridgeReactViteConsumer,
    coletarSuperficiesReactViteConsumer,
  );
}

async function importarAngularConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  return importarConsumerBase(
    diretorio,
    namespaceBase,
    "Angular",
    arquivoEhBridgeAngularConsumer,
    coletarSuperficiesAngularConsumer,
  );
}

async function extrairTasksBridgeFlutterConsumer(baseProjeto: string, arquivosBridge: string[]): Promise<TarefaImportada[]> {
  const tasks: TarefaImportada[] = [];

  for (const arquivo of arquivosBridge) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(baseProjeto, arquivo);

    for (const match of texto.matchAll(/(?:Future<([^\n]+)>|([\w?<>.,\s]+))\s+(\w+)\(([^)]*)\)\s*(?:async\s*)?\{/g)) {
      const retorno = (match[1] ?? match[2] ?? "").trim();
      const nome = match[3]!;
      if (["build", "toString", "hashCode"].includes(nome)) {
        continue;
      }
      const parametros = match[4]!;
      const input = parametros
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/^(required|final)\s+/g, ""))
        .map((item) => {
          const partes = item.split(/\s+/).filter(Boolean);
          const nomeParametro = partes.at(-1) ?? "arg";
          const tipoParametro = partes.slice(0, -1).join(" ");
          return {
            nome: paraSnakeCase(nomeParametro),
            tipo: mapearTipoPrimitivo(tipoParametro || "Json"),
            obrigatorio: !/\?/.test(tipoParametro),
          };
        });
      const caminhoSimbolo = caminhoImplDart(baseProjeto, arquivo, nome);
      tasks.push({
        nome: nomeTaskBridgeConsumer(nome),
        resumo: `Task consumer importada automaticamente de ${relacao}#${nome}.`,
        input,
        output: retorno && mapearTipoPrimitivo(retorno) === "Vazio"
          ? []
          : [{ nome: "resultado", tipo: mapearTipoPrimitivo(retorno || "Json"), obrigatorio: false }],
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { dart: caminhoSimbolo },
        vinculos: deduplicarVinculos([
          { tipo: "arquivo", valor: normalizarCaminhoImportado(relacao) },
          { tipo: "simbolo", valor: caminhoSimbolo },
        ]),
        origemArquivo: relacao,
        origemSimbolo: nome,
      });
    }
  }

  return tasks;
}

async function coletarSuperficiesFlutterConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  const superficies: SuperficieConsumerImportada[] = [];

  for (const arquivo of arquivos) {
    const relacao = path.relative(baseProjeto, arquivo);
    const codigo = await readFile(arquivo, "utf8");
    if (arquivoEhRotasFlutterConsumer(relacao, codigo)) {
      for (const rota of extrairRotasFlutterConsumer(relacao, codigo)) {
        superficies.push({
          caminho: rota.caminho,
          arquivo: rota.arquivoRotas,
          tipoArquivo: "router",
        });
      }
    }
  }

  for (const arquivo of arquivos) {
    const superficie = inferirCaminhoFlutterConsumer(path.relative(baseProjeto, arquivo));
    if (superficie) {
      superficies.push(superficie);
    }
  }

  return superficies;
}

async function importarFlutterConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const escopo = resolverEscopoImportacaoFrontendConsumer(diretorio);
  const arquivos = (await listarArquivosRecursivos(escopo.baseProjeto, [".dart"]))
    .filter((arquivo) => !arquivo.endsWith(".g.dart") && !arquivo.endsWith(".freezed.dart"));
  const arquivosBridge = arquivos.filter((arquivo) => arquivoEhBridgeFlutterConsumer(path.relative(escopo.baseProjeto, arquivo)));
  const tasks = await extrairTasksBridgeFlutterConsumer(escopo.baseProjeto, arquivosBridge);
  const superficiesImportadas = await coletarSuperficiesFlutterConsumer(escopo.baseProjeto, arquivos);
  const superficies = montarVinculosSuperficiesConsumer(superficiesImportadas);

  if (tasks.length === 0 && superficies.length === 0) {
    return [];
  }

  const nomeModulo = namespaceBase.endsWith(".consumer")
    ? namespaceBase
    : `${namespaceBase}.consumer`;

  return [{
    nome: nomeModulo,
    resumo: `Rascunho Sema importado automaticamente do consumer Flutter em ${escopo.baseProjeto}.`,
    tasks: deduplicarTarefas(tasks),
    routes: [],
    entities: [],
    enums: [],
    vinculos: superficies,
  }];
}

function nomeTaskBridgeConsumer(nome: string): string {
  return paraSnakeCase(nome.replace(/^sema/, "")) || paraSnakeCase(nome) || "task_consumer";
}

function extrairChamadaServiceTs(node: ts.Node): string | undefined {
  let encontrado: string | undefined;
  const visitar = (atual: ts.Node): void => {
    if (encontrado) {
      return;
    }
    if (ts.isCallExpression(atual) && ts.isPropertyAccessExpression(atual.expression)) {
      const alvo = atual.expression.expression;
      if (ts.isPropertyAccessExpression(alvo) && alvo.expression.kind === ts.SyntaxKind.ThisKeyword && alvo.name.text.endsWith("Service")) {
        encontrado = atual.expression.name.text;
        return;
      }
    }
    atual.forEachChild(visitar);
  };
  node.forEachChild(visitar);
  return encontrado;
}

function deduplicarCampos(campos: CampoImportado[]): CampoImportado[] {
  const mapa = new Map<string, CampoImportado>();
  for (const campo of campos) {
    if (!mapa.has(campo.nome)) {
      mapa.set(campo.nome, campo);
    }
  }
  return [...mapa.values()];
}

function deduplicarErros(errors: ErroImportado[]): ErroImportado[] {
  const mapa = new Map<string, ErroImportado>();
  for (const erro of errors) {
    if (!mapa.has(erro.nome)) {
      mapa.set(erro.nome, erro);
    }
  }
  return [...mapa.values()];
}

function deduplicarEfeitos(effects: EfeitoImportado[]): EfeitoImportado[] {
  const mapa = new Map<string, EfeitoImportado>();
  for (const effect of effects) {
    const chave = `${effect.categoria}:${effect.alvo}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, effect);
    }
  }
  return [...mapa.values()];
}

function deduplicarVinculos(vinculos: VinculoImportado[]): VinculoImportado[] {
  const mapa = new Map<string, VinculoImportado>();
  for (const vinculo of vinculos) {
    const chave = `${vinculo.tipo}:${vinculo.valor}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, vinculo);
    }
  }
  return [...mapa.values()];
}

function deduplicarEntidades(entities: EntidadeImportada[]): EntidadeImportada[] {
  const mapa = new Map<string, EntidadeImportada>();
  for (const entity of entities) {
    if (!mapa.has(entity.nome)) {
      mapa.set(entity.nome, entity);
    }
  }
  return [...mapa.values()];
}

function deduplicarEnums(enums: EnumImportado[]): EnumImportado[] {
  const mapa = new Map<string, EnumImportado>();
  for (const enumItem of enums) {
    if (!mapa.has(enumItem.nome)) {
      mapa.set(enumItem.nome, enumItem);
    }
  }
  return [...mapa.values()];
}

function deduplicarTarefas(tasks: TarefaImportada[]): TarefaImportada[] {
  const mapa = new Map<string, TarefaImportada>();
  for (const task of tasks) {
    if (!mapa.has(task.nome)) {
      mapa.set(task.nome, task);
      continue;
    }
    const existente = mapa.get(task.nome)!;
    existente.input = deduplicarCampos([...existente.input, ...task.input]);
    existente.output = deduplicarCampos([...existente.output, ...task.output]);
    existente.errors = deduplicarErros([...existente.errors, ...task.errors]);
    existente.effects = deduplicarEfeitos([...existente.effects, ...task.effects]);
    existente.vinculos = deduplicarVinculos([...(existente.vinculos ?? []), ...(task.vinculos ?? [])]);
  }
  return [...mapa.values()];
}

function deduplicarRotas(routes: RotaImportada[]): RotaImportada[] {
  const mapa = new Map<string, RotaImportada>();
  for (const route of routes) {
    const chave = `${route.metodo}:${route.caminho}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, route);
    }
  }
  return [...mapa.values()];
}

function sincronizarRotasComTasks(routes: RotaImportada[], tasks: TarefaImportada[]): void {
  const mapaTasks = new Map(tasks.map((task) => [task.nome, task]));
  for (const route of routes) {
    const task = mapaTasks.get(route.task);
    if (!task) {
      continue;
    }
    if (route.output.length === 0) {
      route.output = task.output.map((campo) => ({ ...campo, obrigatorio: true }));
    }
    if (route.errors.length === 0) {
      route.errors = task.errors;
    }
  }
}

function renderizarCampos(bloco: string, campos: CampoImportado[], indentacao = "  ", sempre = false): string[] {
  if (campos.length === 0 && !sempre) {
    return [];
  }
  return [
    `${indentacao}${bloco} {`,
    ...campos.map((campo) => `${indentacao}  ${normalizarNomeCampoImportado(campo.nome)}: ${campo.tipo}${campo.obrigatorio ? " required" : ""}`),
    `${indentacao}}`,
    "",
  ];
}

function renderizarErrors(erros: ErroImportado[], indentacao = "  "): string[] {
  if (erros.length === 0) {
    return [];
  }
  return [
    `${indentacao}error {`,
    ...erros.map((erro) => `${indentacao}  ${erro.nome}: "${escaparTexto(erro.mensagem)}"`),
    `${indentacao}}`,
    "",
  ];
}

function renderizarEffects(effects: EfeitoImportado[], indentacao = "  "): string[] {
  if (effects.length === 0) {
    return [];
  }
  return [
    `${indentacao}effects {`,
    ...effects.map((effect) => `${indentacao}  ${effect.categoria} ${effect.alvo}${effect.criticidade ? ` criticidade = ${effect.criticidade}` : ""}`),
    `${indentacao}}`,
    "",
  ];
}

function renderizarImpl(impl: Partial<Record<OrigemInteropImportada, string>> | undefined, indentacao = "  "): string[] {
  if (!impl || Object.keys(impl).length === 0) {
    return [];
  }
  return [
    `${indentacao}impl {`,
    ...(impl.ts ? [`${indentacao}  ts: ${impl.ts}`] : []),
    ...(impl.py ? [`${indentacao}  py: ${impl.py}`] : []),
    ...(impl.dart ? [`${indentacao}  dart: ${impl.dart}`] : []),
    ...(impl.cs ? [`${indentacao}  cs: ${impl.cs}`] : []),
    ...(impl.java ? [`${indentacao}  java: ${impl.java}`] : []),
    ...(impl.go ? [`${indentacao}  go: ${impl.go}`] : []),
    ...(impl.rust ? [`${indentacao}  rust: ${impl.rust}`] : []),
    ...(impl.cpp ? [`${indentacao}  cpp: ${impl.cpp}`] : []),
    `${indentacao}}`,
    "",
  ];
}

function renderizarValorVinculo(vinculo: VinculoImportado): string {
  if (vinculo.tipo === "simbolo") {
    return vinculo.valor;
  }
  if (vinculo.tipo === "arquivo" || vinculo.valor.includes("/") || vinculo.valor.includes("\\") || vinculo.valor.includes("{")) {
    return `"${escaparTexto(vinculo.valor)}"`;
  }
  return vinculo.valor;
}

function renderizarVinculos(vinculos: VinculoImportado[] | undefined, indentacao = "  "): string[] {
  if (!vinculos || vinculos.length === 0) {
    return [];
  }
  return [
    `${indentacao}vinculos {`,
    ...vinculos.map((vinculo) => `${indentacao}  ${vinculo.tipo}: ${renderizarValorVinculo(vinculo)}`),
    `${indentacao}}`,
    "",
  ];
}

function renderizarTask(task: TarefaImportada): string[] {
  const linhas = [
    `  task ${task.nome} {`,
    "    docs {",
    `      resumo: "${escaparTexto(task.resumo)}"`,
    "    }",
    "",
    ...renderizarCampos("input", task.input, "    ", true),
    ...renderizarCampos("output", task.output, "    ", true),
    ...renderizarEffects(task.effects, "    "),
    ...renderizarImpl(task.impl, "    "),
    ...renderizarVinculos(task.vinculos, "    "),
    ...renderizarErrors(task.errors, "    "),
  ];

  linhas.push("    guarantees {");
  for (const campo of task.output) {
    linhas.push(`      ${normalizarNomeCampoImportado(campo.nome)} existe`);
  }
  linhas.push("    }");
  linhas.push("");

  linhas.push("  }");
  linhas.push("");
  return linhas;
}

function renderizarRoute(route: RotaImportada): string[] {
  const caminhoRenderizado = /[{}]/.test(route.caminho)
    ? `"${escaparTexto(route.caminho)}"`
    : route.caminho;
  return [
    `  route ${route.nome} {`,
    "    docs {",
    `      resumo: "${escaparTexto(route.resumo)}"`,
    "    }",
    "",
    `    metodo: ${route.metodo}`,
    `    caminho: ${caminhoRenderizado}`,
    `    task: ${route.task}`,
    ...renderizarCampos("input", route.input, "    "),
    ...renderizarCampos("output", route.output, "    "),
    ...renderizarErrors(route.errors, "    "),
    "  }",
    "",
  ];
}

function renderizarEnum(enumItem: EnumImportado): string[] {
  return [
    `  enum ${enumItem.nome} {`,
    `    ${enumItem.valores.join(",\n    ")}`,
    "  }",
    "",
  ];
}

function renderizarEntidade(entity: EntidadeImportada): string[] {
  return [
    `  entity ${entity.nome} {`,
    "    fields {",
    ...entity.campos.map((campo) => `      ${normalizarNomeCampoImportado(campo.nome)}: ${campo.tipo}`),
    "    }",
    "  }",
    "",
  ];
}

function renderizarValorDatabase(valor?: string): string | undefined {
  if (!valor) {
    return undefined;
  }
  return /[\s/{}"]/u.test(valor)
    ? `"${escaparTexto(valor)}"`
    : valor;
}

function renderizarRecursoDatabase(recurso: RecursoDatabaseImportado): string[] {
  const linhas = [`    ${recurso.tipo} ${recurso.nome} {`];
  const mode = renderizarValorDatabase(recurso.mode);
  const table = renderizarValorDatabase(recurso.table);
  const collection = renderizarValorDatabase(recurso.collection);
  const ttl = renderizarValorDatabase(recurso.ttl);
  const surface = renderizarValorDatabase(recurso.surface);

  if (mode) {
    linhas.push(`      mode: ${mode}`);
  }
  if (table) {
    linhas.push(`      table: ${table}`);
  }
  if (collection) {
    linhas.push(`      collection: ${collection}`);
  }
  if (ttl) {
    linhas.push(`      ttl: ${ttl}`);
  }
  if (surface) {
    linhas.push(`      surface: ${surface}`);
  }
  linhas.push("    }");
  linhas.push("");
  return linhas;
}

function renderizarDatabase(database: DatabaseImportado): string[] {
  const queryModel = renderizarValorDatabase(database.queryModel);
  const transactionModel = renderizarValorDatabase(database.transactionModel);
  return [
    `  database ${database.nome} {`,
    `    engine: ${database.engine}`,
    ...(queryModel ? [`    query_model: ${queryModel}`] : []),
    ...(transactionModel ? [`    transaction_model: ${transactionModel}`] : []),
    ...(database.diagnostics?.length
      ? [
        "    diagnostics {",
        ...database.diagnostics.map((diagnostico) => `      ${diagnostico}`),
        "    }",
      ]
      : []),
    ...database.resources.flatMap(renderizarRecursoDatabase),
    "  }",
    "",
  ];
}

function moduloParaCodigo(modulo: ModuloImportado): string {
  const linhas = [
    `module ${modulo.nome} {`,
    "  docs {",
    `    resumo: "${escaparTexto(modulo.resumo)}"`,
    "  }",
    "",
    ...renderizarVinculos(modulo.vinculos, "  "),
    ...(modulo.databases ?? []).flatMap(renderizarDatabase),
    ...modulo.enums.flatMap(renderizarEnum),
    ...modulo.entities.flatMap(renderizarEntidade),
    ...modulo.tasks.flatMap(renderizarTask),
    ...modulo.routes.flatMap(renderizarRoute),
    "}",
    "",
  ];

  return linhas.join("\n");
}

async function formatarModuloImportado(codigo: string, caminhoVirtual: string): Promise<string> {
  const formatado = formatarCodigo(codigo, caminhoVirtual);
  return formatado.codigoFormatado ?? codigo;
}

function nomeArquivoModulo(modulo: string): string {
  const segmentos = modulo.split(".");
  return `${segmentos.at(-1) ?? "modulo"}.sema`;
}

function contextoArquivoModulo(modulo: string, namespaceBase: string): string {
  const prefixo = namespaceBase.split(".");
  const segmentos = modulo.split(".");
  const relativos = segmentos.slice(prefixo.length, -1);
  return relativos.length ? path.join(...relativos) : "";
}

function montarArquivoImportado(modulo: ModuloImportado, namespaceBase: string, conteudo: string): ArquivoImportado {
  const pasta = contextoArquivoModulo(modulo.nome, namespaceBase);
  const caminhoRelativo = pasta ? path.join(pasta, nomeArquivoModulo(modulo.nome)) : nomeArquivoModulo(modulo.nome);
  return {
    caminhoRelativo,
    conteudo,
    modulo: modulo.nome,
    tarefas: modulo.tasks.length,
    rotas: modulo.routes.length,
    entidades: modulo.entities.length,
    enums: modulo.enums.length,
    databases: modulo.databases?.length ?? 0,
  };
}

function consolidarTiposTs(contextos: ContextoTsArquivo[]): Map<string, TipoDescoberto> {
  const tipos = new Map<string, TipoDescoberto>();
  for (const contexto of contextos) {
    for (const [nome, tipo] of extrairTiposTs(contexto.sourceFile)) {
      if (!tipos.has(nome)) {
        tipos.set(nome, tipo);
      }
    }
  }
  return tipos;
}

function importarNestJsDeArquivo(
  diretorioBase: string,
  arquivo: string,
  namespaceBase: string,
  tiposGlobais: Map<string, TipoDescoberto>,
): ModuloImportado[] {
  const relacao = path.relative(diretorioBase, arquivo);
  const codigo = ts.sys.readFile(arquivo, "utf8") ?? "";
  const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const contextoSegmentos = inferirContextoPorArquivo(relacao);
  const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
  const entitiesRef = new Set<string>();
  const enumsRef = new Set<string>();
  const tasks: TarefaImportada[] = [];
  const routes: RotaImportada[] = [];

  for (const node of sourceFile.statements) {
    if (!ts.isClassDeclaration(node)) {
      continue;
    }

    const controllerDecorator = lerDecorator(node, ["Controller"]);
    if (controllerDecorator) {
      const basePath = extrairTextoLiteral(controllerDecorator.argumentos[0]);
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.body) {
          continue;
        }
        const httpDecorator = lerDecorator(member, ["Get", "Post", "Put", "Patch", "Delete"]);
        if (!httpDecorator) {
          continue;
        }
        const taskOriginal = extrairChamadaServiceTs(member.body) ?? member.name.getText(sourceFile);
        const taskNome = paraSnakeCase(taskOriginal);
        const routeInput = member.parameters.flatMap((parametro) =>
          expandirCamposTs(
            parametro.name.getText(sourceFile),
            parametro.type?.getText(sourceFile),
            tiposGlobais,
            entitiesRef,
            enumsRef,
            !parametro.questionToken,
          ));
        const routeOutputTipo = member.type?.getText(sourceFile);
        const routeOutput = !routeOutputTipo || mapearTipoPrimitivo(routeOutputTipo) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", routeOutputTipo, tiposGlobais, entitiesRef, enumsRef, false));

        routes.push({
          nome: `${taskNome}_publico`,
          resumo: `Rota importada automaticamente de ${relacao}#${member.name.getText(sourceFile)}.`,
          metodo: httpDecorator.nome.toUpperCase(),
          caminho: juntarCaminhoHttp(basePath, extrairTextoLiteral(httpDecorator.argumentos[0])),
          task: taskNome,
          input: deduplicarCampos(routeInput),
          output: routeOutput,
          errors: [],
        });
      }
    }

    if (!node.name?.text.endsWith("Service")) {
      continue;
    }
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.body || !member.name) {
        continue;
      }
      if (member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
        continue;
      }
      const nomeMetodo = member.name.getText(sourceFile);
      if (nomeMetodo === "constructor") {
        continue;
      }
      const input = member.parameters.flatMap((parametro) =>
        expandirCamposTs(
          parametro.name.getText(sourceFile),
          parametro.type?.getText(sourceFile),
          tiposGlobais,
          entitiesRef,
          enumsRef,
          !parametro.questionToken,
        ));
      const output = member.type?.getText(sourceFile) && mapearTipoPrimitivo(member.type.getText(sourceFile)) === "Vazio"
        ? []
        : deduplicarCampos(expandirCamposTs("resultado", member.type?.getText(sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
      tasks.push({
        nome: paraSnakeCase(nomeMetodo),
        resumo: `Task importada automaticamente de ${relacao}#${nomeMetodo}.`,
        input: deduplicarCampos(input),
        output,
        errors: extrairErrosTs(member.body, sourceFile),
        effects: descreverEfeitosPorHeuristica(member.body.getText(sourceFile)),
        impl: { ts: caminhoImplTs(diretorioBase, arquivo, nomeMetodo) },
        origemArquivo: relacao,
        origemSimbolo: nomeMetodo,
      });
    }
  }

  if (!tasks.length && !routes.length) {
    return [];
  }

  const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
  sincronizarRotasComTasks(routes, tasks);

  return [{
    nome: nomeModulo,
    resumo: `Rascunho Sema importado de um contexto NestJS legado em ${contextoSegmentos.join("/")}.`,
    entities,
    enums,
    tasks: deduplicarTarefas(tasks),
    routes: deduplicarRotas(routes),
  }];
}

async function importarTypeScriptBase(
  diretorio: string,
  namespaceBase: string,
  modoNestjs = false,
): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".ts"]);
  const uteis = arquivos.filter((arquivo) =>
    !arquivo.endsWith(".spec.ts")
    && !arquivo.endsWith(".test.ts")
    && !arquivo.endsWith(".d.ts")
    && !(modoNestjs && !arquivo.endsWith(".controller.ts") && !arquivo.endsWith(".service.ts")),
  );
  const contextosTodos = await Promise.all(arquivos
    .filter((arquivo) => !arquivo.endsWith(".spec.ts") && !arquivo.endsWith(".test.ts") && !arquivo.endsWith(".d.ts"))
    .map(async (arquivo) => {
      const texto = await readFile(arquivo, "utf8");
      return {
        sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
        texto,
        relacao: path.relative(diretorio, arquivo),
      };
    }));
  const contextos = await Promise.all(uteis.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
      texto,
      relacao: path.relative(diretorio, arquivo),
    };
  }));
  const tiposGlobais = consolidarTiposTs(contextosTodos);
  const modulos = new Map<string, ModuloImportado>();

  if (modoNestjs) {
    for (const contexto of contextos) {
      for (const modulo of importarNestJsDeArquivo(diretorio, path.join(diretorio, contexto.relacao), namespaceBase, tiposGlobais)) {
        const existente = modulos.get(modulo.nome);
        if (!existente) {
          modulos.set(modulo.nome, modulo);
          continue;
        }
        existente.tasks = deduplicarTarefas([...existente.tasks, ...modulo.tasks]);
        existente.routes = deduplicarRotas([...existente.routes, ...modulo.routes]);
        existente.entities = deduplicarEntidades([...existente.entities, ...modulo.entities]);
        existente.enums = deduplicarEnums([...existente.enums, ...modulo.enums]);
      }
    }
    return [...modulos.values()];
  }

  for (const contexto of contextos) {
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const contextoSegmentos = inferirContextoPorArquivo(contexto.relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];

    contexto.sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nome = node.name.text;
        const input = node.parameters.flatMap((parametro) =>
          expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
        const output = node.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(node.type.getText(contexto.sourceFile)) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", node.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
        const errors = node.body ? extrairErrosTs(node.body, contexto.sourceFile) : [];
        const effects = node.body ? descreverEfeitosPorHeuristica(node.body.getText(contexto.sourceFile)) : [];
        tasks.push({
          nome: paraSnakeCase(nome),
          resumo: `Task importada automaticamente de ${contexto.relacao}#${nome}.`,
          input: deduplicarCampos(input),
          output,
          errors,
          effects,
          impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), nome) },
          origemArquivo: contexto.relacao,
          origemSimbolo: nome,
        });
      }

      if (ts.isClassDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nomeClasse = node.name.text;
        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !member.name || !member.body) {
            continue;
          }
          if (member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
            continue;
          }
          const nomeMetodo = member.name.getText(contexto.sourceFile);
          if (nomeMetodo === "constructor") {
            continue;
          }
          const input = member.parameters.flatMap((parametro) =>
            expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
          const output = member.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(member.type.getText(contexto.sourceFile)) === "Vazio"
            ? []
            : deduplicarCampos(expandirCamposTs("resultado", member.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
          tasks.push({
            nome: paraSnakeCase(nomeMetodo),
            resumo: `Task importada automaticamente de ${contexto.relacao}#${nomeClasse}.${nomeMetodo}.`,
            input: deduplicarCampos(input),
            output,
            errors: extrairErrosTs(member.body, contexto.sourceFile),
            effects: descreverEfeitosPorHeuristica(member.body.getText(contexto.sourceFile)),
            impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), `${nomeClasse}.${nomeMetodo}`) },
            origemArquivo: contexto.relacao,
            origemSimbolo: `${nomeClasse}.${nomeMetodo}`,
          });
        }
      }
    });

    if (tasks.length === 0) {
      continue;
    }

    const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${contexto.relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: [],
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}

function nomeTaskParaRotaTypeScript(caminho: string, metodo: string): string {
  const segmentos = caminho
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map((segmento) => segmento.replace(/[{}]/g, ""));
  return paraSnakeCase([...segmentos, metodo.toLowerCase()].join("_")) || `rota_${metodo.toLowerCase()}`;
}

function camposDeParametrosRotaTypeScript(
  parametros: ReturnType<typeof extrairRotasTypeScriptHttp>[number]["parametros"],
): CampoImportado[] {
  return parametros.map((parametro) => ({
    nome: paraSnakeCase(parametro.nome),
    tipo: parametro.tipoSema,
    obrigatorio: true,
  }));
}

function extrairColecoesFirebaseImportacao(texto: string): string[] {
  const encontrados = new Set<string>();

  for (const match of texto.matchAll(/\b(?:export\s+)?const\s+\w*COLLECTIONS?\w*\s*=\s*\{([\s\S]*?)\n\}/g)) {
    const corpo = match[1] ?? "";
    for (const valor of corpo.matchAll(/:\s*["'`]([^"'`]+)["'`]/g)) {
      encontrados.add(valor[1]!);
    }
  }

  return [...encontrados];
}

async function importarNextJsBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const escopo = resolverEscopoImportacaoNextJs(diretorio);
  const arquivos = await listarArquivosRecursivos(escopo.diretorioEscopo, [".ts", ".tsx", ".js", ".jsx"]);
  const uteis = arquivos.filter((arquivo) =>
    !arquivo.endsWith(".spec.ts")
    && !arquivo.endsWith(".test.ts")
    && !arquivo.endsWith(".d.ts")
    && /(\\|\/)(?:src\\|src\/)?app(\\|\/)api(\\|\/).+(\\|\/)route\.(ts|tsx|js|jsx)$/i.test(arquivo));

  const contextos = await Promise.all(uteis.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    const scriptKind = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, scriptKind),
      texto,
      relacao: path.relative(escopo.baseProjeto, arquivo),
    };
  }));
  const tiposGlobais = consolidarTiposTs(contextos);
  const modulos = new Map<string, ModuloImportado>();

  for (const contexto of contextos) {
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const contextoSegmentos = inferirContextoPorArquivo(
      contexto.relacao.replace(/[\\/]route\.(?:ts|tsx|js|jsx)$/i, ""),
    ).filter((segmento, indice) => !(indice === 0 && segmento === "app"));
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

      for (const rota of extrairRotasTypeScriptHttp(contexto.sourceFile, contexto.relacao).filter((item) => item.origem === "nextjs")) {
        const taskNome = nomeTaskParaRotaTypeScript(rota.caminho, rota.metodo);
        const exportacao = localizarExportacaoTypeScriptHttp(contexto.sourceFile, rota.simbolo);
        const semantica = inferirSemanticaHandlerTypeScriptHttp(contexto.sourceFile, rota.simbolo);
        const input = deduplicarCampos([
          ...camposDeParametrosRotaTypeScript(rota.parametros),
          ...camposDeSemanticaTypeScriptHttp(semantica?.query ?? [], tiposGlobais, entitiesRef, enumsRef),
          ...camposEstruturadosTypeScriptHttp("body", semantica?.bodyTipoTexto, tiposGlobais, entitiesRef, enumsRef),
          ...camposDeSemanticaTypeScriptHttp(semantica?.body ?? [], tiposGlobais, entitiesRef, enumsRef),
        ]);
        const output = semantica && semantica.response.length > 0
          ? deduplicarCampos(camposDeSemanticaTypeScriptHttp(semantica.response, tiposGlobais, entitiesRef, enumsRef))
          : semantica?.responseTipoTexto
            ? deduplicarCampos(expandirCamposTs("resultado", semantica.responseTipoTexto, tiposGlobais, entitiesRef, enumsRef, false))
            : exportacao?.retorno && mapearTipoPrimitivo(exportacao.retorno) === "Vazio"
              ? []
              : deduplicarCampos(expandirCamposTs("resultado", exportacao?.retorno, tiposGlobais, entitiesRef, enumsRef, false));
        const taskOutput = output.length > 0 ? output : [{ nome: "resultado", tipo: "Json", obrigatorio: false }];
        const resumoBase = `Rota Next.js App Router importada automaticamente de ${contexto.relacao}#${rota.simbolo}.`;
        const errors = deduplicarErros([
          ...(exportacao?.corpo ? extrairErrosTs(exportacao.corpo, contexto.sourceFile) : []),
          ...errosPorStatusHttp(semantica?.errorStatuses ?? []),
        ]);

        tasks.push({
          nome: taskNome,
          resumo: `Task derivada automaticamente de ${contexto.relacao}#${rota.simbolo}.`,
          input,
          output: taskOutput,
          errors,
          effects: exportacao?.corpo ? descreverEfeitosPorHeuristica(exportacao.corpo.getText(contexto.sourceFile)) : descreverEfeitosPorHeuristica(contexto.texto),
          impl: { ts: caminhoImplTs(escopo.baseProjeto, path.join(escopo.baseProjeto, contexto.relacao), rota.simbolo) },
          origemArquivo: contexto.relacao,
          origemSimbolo: rota.simbolo,
        });

      routes.push({
        nome: `${taskNome}_publico`,
        resumo: resumoBase,
        metodo: rota.metodo,
          caminho: rota.caminho,
          task: taskNome,
          input,
          output: taskOutput,
          errors,
        });
      }

    if (!tasks.length && !routes.length) {
      continue;
    }

    sincronizarRotasComTasks(routes, tasks);
    const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${contexto.relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: deduplicarRotas(routes),
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}

async function importarFirebaseBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".ts", ".tsx", ".js", ".jsx"]);
  const uteis = arquivos.filter((arquivo) =>
    !arquivo.endsWith(".spec.ts")
    && !arquivo.endsWith(".test.ts")
    && !arquivo.endsWith(".d.ts")
    && /(sema_contract_bridge|health-check|collections?|firestore)/i.test(arquivo));

  const contextos = await Promise.all(uteis.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    const scriptKind = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, scriptKind),
      texto,
      relacao: path.relative(diretorio, arquivo),
    };
  }));
  const tiposGlobais = consolidarTiposTs(contextos);
  const modulos = new Map<string, ModuloImportado>();

  for (const contexto of contextos) {
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const contextoSegmentos = inferirContextoPorArquivo(contexto.relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const node of contexto.sourceFile.statements) {
      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nome = node.name.text;
        const input = node.parameters.flatMap((parametro) =>
          expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
        const output = node.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(node.type.getText(contexto.sourceFile)) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", node.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
        tasks.push({
          nome: paraSnakeCase(nome.replace(/^sema/, "")) || paraSnakeCase(nome),
          resumo: `Task Firebase/worker importada automaticamente de ${contexto.relacao}#${nome}.`,
          input: deduplicarCampos(input),
          output: output.length > 0 ? output : [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
          errors: node.body ? extrairErrosTs(node.body, contexto.sourceFile) : [],
          effects: node.body ? descreverEfeitosPorHeuristica(node.body.getText(contexto.sourceFile)) : descreverEfeitosPorHeuristica(contexto.texto),
          impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), nome) },
          origemArquivo: contexto.relacao,
          origemSimbolo: nome,
        });
      }
    }

    for (const rota of extrairRotasTypeScriptHttp(contexto.sourceFile, contexto.relacao).filter((item) => item.origem === "firebase")) {
      const taskNome = nomeTaskParaRotaTypeScript(rota.caminho, rota.metodo);
      const exportacao = localizarExportacaoTypeScriptHttp(contexto.sourceFile, rota.simbolo);
      const input = deduplicarCampos(camposDeParametrosRotaTypeScript(rota.parametros));
      const output = exportacao?.retorno && mapearTipoPrimitivo(exportacao.retorno) === "Vazio"
        ? []
        : deduplicarCampos(expandirCamposTs("resultado", exportacao?.retorno, tiposGlobais, entitiesRef, enumsRef, false));
      const taskOutput = output.length > 0 ? output : [{ nome: "resultado", tipo: "Json", obrigatorio: false }];

      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP do worker importada automaticamente de ${contexto.relacao}#${rota.simbolo}.`,
        input,
        output: taskOutput,
        errors: exportacao?.corpo ? extrairErrosTs(exportacao.corpo, contexto.sourceFile) : [],
        effects: exportacao?.corpo ? descreverEfeitosPorHeuristica(exportacao.corpo.getText(contexto.sourceFile)) : descreverEfeitosPorHeuristica(contexto.texto),
        impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), rota.simbolo) },
        origemArquivo: contexto.relacao,
        origemSimbolo: rota.simbolo,
      });

      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota do worker importada automaticamente de ${contexto.relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input,
        output: taskOutput,
        errors: exportacao?.corpo ? extrairErrosTs(exportacao.corpo, contexto.sourceFile) : [],
      });
    }

    for (const colecao of extrairColecoesFirebaseImportacao(contexto.texto)) {
      tasks.push({
        nome: paraSnakeCase(`inventariar_${colecao}`),
        resumo: `Task sintetica para registrar o recurso persistido ${colecao} descoberto em ${contexto.relacao}.`,
        input: [],
        output: [{ nome: "colecao", tipo: "Texto", obrigatorio: false }],
        errors: [],
        effects: [{ categoria: "persistencia", alvo: colecao, criticidade: "media" }],
        origemArquivo: contexto.relacao,
        origemSimbolo: colecao,
      });
    }

    if (!tasks.length && !routes.length) {
      continue;
    }

    sincronizarRotasComTasks(routes, tasks);
    const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${contexto.relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: deduplicarRotas(routes),
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}

function extrairTiposPython(texto: string): Map<string, TipoPythonDescoberto> {
  const encontrados = new Map<string, TipoPythonDescoberto>();

  const regexBaseModel = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
  for (const match of texto.matchAll(regexBaseModel)) {
    const [, nome, bases = "", corpo] = match;
    if (!bases.includes("BaseModel")) {
      continue;
    }
    const campos = [...corpo.matchAll(/^\s{4}(\w+)\s*:\s*([^\n=]+)(?:\s*=.+)?$/gm)].map((campo) => ({
      nome: campo[1]!,
      tipoTexto: campo[2]!.trim(),
      obrigatorio: !/=/.test(campo[0]!),
    }));
    encontrados.set(nome!, { tipo: "objeto", nome: nome!, campos });
  }

  const regexEnum = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
  for (const match of texto.matchAll(regexEnum)) {
    const [, nome, bases = "", corpo] = match;
    if (!/(Enum|StrEnum)/.test(bases)) {
      continue;
    }
    const valores = [...corpo.matchAll(/^\s{4}(\w+)\s*=\s*["']([^"']+)["']$/gm)].map((valor) => valor[1]!).filter(Boolean);
    if (valores.length) {
      encontrados.set(nome!, { tipo: "enum", nome: nome!, valores });
    }
  }

  return encontrados;
}

function mapearTipoPythonParaSema(
  tipoTexto: string | undefined,
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): string {
  if (!tipoTexto) {
    return "Json";
  }

  const limpo = tipoTexto.replace(/\s+/g, "");
  const basico = mapearTipoPrimitivo(limpo);
  if (basico !== limpo) {
    return basico;
  }

  const simples = limpo.replace(/Optional\[(.+)\]/, "$1").replace(/list\[(.+)\]/i, "Json").replace(/dict\[(.+)\]/i, "Json");
  if (tipos.has(simples)) {
    const encontrado = tipos.get(simples)!;
    if (encontrado.tipo === "enum") {
      enumsReferenciados.add(encontrado.nome);
      return encontrado.nome;
    }
    if (!pareceWrapperTipo(encontrado.nome)) {
      entidadesReferenciadas.add(encontrado.nome);
      return encontrado.nome;
    }
  }

  return "Json";
}

function expandirCamposPython(
  nomeParametro: string,
  tipoTexto: string | undefined,
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
  obrigatorio: boolean,
): CampoImportado[] {
  if (!tipoTexto) {
    return [{ nome: paraSnakeCase(nomeParametro), tipo: "Json", obrigatorio }];
  }
  const limpo = tipoTexto.replace(/\s+/g, "").replace(/Optional\[(.+)\]/, "$1");
  const descoberto = tipos.get(limpo);
  if (descoberto?.tipo === "objeto" && pareceWrapperTipo(descoberto.nome) && descoberto.campos) {
    return descoberto.campos.map((campo) => ({
      nome: paraSnakeCase(campo.nome),
      tipo: mapearTipoPythonParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
      obrigatorio: campo.obrigatorio,
    }));
  }
  return [{
    nome: paraSnakeCase(nomeParametro),
    tipo: mapearTipoPythonParaSema(tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
    obrigatorio,
  }];
}

function criarEntidadesPython(
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): { entities: EntidadeImportada[]; enums: EnumImportado[] } {
  const entities = [...entidadesReferenciadas]
    .map((nome) => tipos.get(nome))
    .filter((item): item is TipoPythonDescoberto => Boolean(item?.tipo === "objeto" && item.campos))
    .map((item) => ({
      nome: item.nome,
      campos: item.campos!.map((campo) => ({
        nome: paraSnakeCase(campo.nome),
        tipo: mapearTipoPythonParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
        obrigatorio: campo.obrigatorio,
      })),
    }));

  const enums = [...enumsReferenciados]
    .map((nome) => tipos.get(nome))
    .filter((item): item is TipoPythonDescoberto => Boolean(item?.tipo === "enum" && item.valores))
    .map((item) => ({
      nome: item.nome,
      valores: item.valores!,
    }));

  return { entities: deduplicarEntidades(entities), enums: deduplicarEnums(enums) };
}

function extrairErrosPython(texto: string): ErroImportado[] {
  const erros = new Map<string, string>();
  for (const match of texto.matchAll(/raise\s+(\w+)(?:\(([^)]*)\))?/g)) {
    const nomeBruto = match[1]!;
    const mensagem = (match[2] ?? "").match(/["']([^"']+)["']/)?.[1] ?? `Erro importado automaticamente de ${nomeBruto}.`;
    erros.set(normalizarNomeErroBruto(nomeBruto), mensagem);
  }
  return [...erros.entries()].map(([nome, mensagem]) => ({ nome, mensagem }));
}

function caminhoImplGenerico(
  diretorioBase: string,
  arquivo: string,
  simbolo: string,
  opcoes?: { snakeCaseUltimoArquivo?: boolean },
): string {
  const relativo = path.relative(diretorioBase, arquivo).replace(/\.[^.]+$/, "");
  const segmentos = relativo.split(path.sep).map((segmento, indice, lista) =>
    opcoes?.snakeCaseUltimoArquivo && indice === lista.length - 1
      ? paraSnakeCase(segmento)
      : paraIdentificadorModulo(segmento))
    .filter(Boolean);
  return [...segmentos, simbolo].join(".");
}

function caminhoImplPython(diretorioBase: string, arquivo: string, simbolo: string): string {
  return caminhoImplGenerico(diretorioBase, arquivo, simbolo);
}

function caminhoImplDart(diretorioBase: string, arquivo: string, simbolo: string): string {
  return caminhoImplGenerico(diretorioBase, arquivo, simbolo);
}

type ModoHttpPython = "nenhum" | "fastapi" | "flask";

function dividirParametrosPython(parametros: string): string[] {
  const partes: string[] = [];
  let atual = "";
  let profundidade = 0;

  for (const caractere of parametros) {
    if (caractere === "," && profundidade === 0) {
      if (atual.trim()) {
        partes.push(atual.trim());
      }
      atual = "";
      continue;
    }

    if (["[", "(", "{", "<"].includes(caractere)) {
      profundidade += 1;
    } else if (["]", ")", "}", ">"].includes(caractere) && profundidade > 0) {
      profundidade -= 1;
    }

    atual += caractere;
  }

  if (atual.trim()) {
    partes.push(atual.trim());
  }

  return partes;
}

function extrairAssinaturaParametrosPython(parametros: string): Map<string, { tipoTexto?: string; obrigatorio: boolean }> {
  const assinatura = new Map<string, { tipoTexto?: string; obrigatorio: boolean }>();

  for (const item of dividirParametrosPython(parametros)) {
    if (!item || item.startsWith("self") || item.startsWith("cls") || item.startsWith("*")) {
      continue;
    }

    const obrigatorio = !item.includes("=");
    const semValorPadrao = item.split("=")[0]?.trim() ?? item.trim();
    const [nomeBruto, tipo] = semValorPadrao.split(":").map((parte) => parte.trim());
    const nome = nomeBruto?.replace(/^\*{1,2}/, "").trim();
    if (!nome) {
      continue;
    }

    assinatura.set(nome, {
      tipoTexto: tipo || undefined,
      obrigatorio,
    });
  }

  return assinatura;
}

function mapearConversorFlaskParaSema(conversor?: string): string {
  switch ((conversor ?? "").toLowerCase()) {
    case "int":
      return "Inteiro";
    case "float":
      return "Decimal";
    case "uuid":
      return "Id";
    case "path":
    default:
      return "Texto";
  }
}

function criarInputRotaFlask(
  caminho: string,
  parametros: string,
  tiposGlobais: Map<string, TipoPythonDescoberto>,
  entitiesRef: Set<string>,
  enumsRef: Set<string>,
): CampoImportado[] {
  const assinatura = extrairAssinaturaParametrosPython(parametros);
  return extrairParametrosCaminhoFlask(caminho).map((parametro) => {
    const correspondente = assinatura.get(parametro.nome);
    return {
      nome: paraSnakeCase(parametro.nome),
      tipo: correspondente?.tipoTexto
        ? mapearTipoPythonParaSema(correspondente.tipoTexto, tiposGlobais, entitiesRef, enumsRef)
        : mapearConversorFlaskParaSema(parametro.conversor),
      obrigatorio: correspondente?.obrigatorio ?? true,
    };
  });
}

async function importarPythonBase(
  diretorio: string,
  namespaceBase: string,
  modoHttp: ModoHttpPython = "nenhum",
): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".py"]))
    .filter((arquivo) => !arquivo.endsWith("__init__.py") && !/tests?[\\/]/i.test(arquivo));

  const textos = new Map<string, string>();
  const tiposGlobais = new Map<string, TipoPythonDescoberto>();
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    textos.set(arquivo, texto);
    for (const [nome, tipo] of extrairTiposPython(texto)) {
      if (!tiposGlobais.has(nome)) {
        tiposGlobais.set(nome, tipo);
      }
    }
  }

  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = textos.get(arquivo)!;
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    if (modoHttp === "fastapi") {
      const prefixo = texto.match(/APIRouter\s*\(\s*prefix\s*=\s*["']([^"']+)["']/)?.[1];
      const routeRegex = /@(?:router|app)\.(get|post|put|patch|delete)\(([^)]*)\)\s*\n(?:async\s+)?def\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g;
      for (const match of texto.matchAll(routeRegex)) {
        const metodo = match[1]!.toUpperCase();
        const argumentoDecorator = match[2] ?? "";
        const sufixo = argumentoDecorator.match(/["']([^"']+)["']/)?.[1];
        const nomeFuncao = match[3]!;
        const parametros = match[4]!;
        const retorno = match[5]?.trim();
        const routeInput = parametros
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
          .flatMap((item) => {
            const [nome, tipo] = item.split(":").map((parte) => parte.trim());
            const obrigatorio = !item.includes("=");
            return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
          });
        const routeOutput = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
        const taskNome = paraSnakeCase(nomeFuncao);
        routes.push({
          nome: `${taskNome}_publico`,
          resumo: `Rota FastAPI importada automaticamente de ${relacao}#${nomeFuncao}.`,
          metodo,
          caminho: juntarCaminhoHttp(prefixo, sufixo),
          task: taskNome,
          input: deduplicarCampos(routeInput),
          output: routeOutput,
          errors: [],
        });
      }
    } else if (modoHttp === "flask") {
      for (const rota of extrairRotasFlaskDecoradas(texto)) {
        const taskNome = paraSnakeCase(rota.nomeFuncao);
        const nomeBase = `${taskNome}_publico`;
        const nome = routes.some((route) => route.nome === nomeBase)
          ? `${taskNome}_${rota.metodo.toLowerCase()}_publico`
          : nomeBase;
        routes.push({
          nome,
          resumo: `Rota Flask importada automaticamente de ${relacao}#${rota.nomeFuncao}.`,
          metodo: rota.metodo,
          caminho: rota.caminho,
          task: taskNome,
          input: deduplicarCampos(criarInputRotaFlask(rota.caminho, rota.parametros, tiposGlobais, entitiesRef, enumsRef)),
          output: [],
          errors: [],
        });
      }
    }

    const funcRegex = /^(async\s+def|def)\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm;
    for (const match of texto.matchAll(funcRegex)) {
      const nomeFuncao = match[2]!;
      if (nomeFuncao.startsWith("_")) {
        continue;
      }
      const parametros = match[3]!;
      const retorno = match[4]?.trim();
      const inicioCorpo = match.index ?? 0;
      const trecho = texto.slice(inicioCorpo, Math.min(texto.length, inicioCorpo + 1500));
      const input = parametros
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
        .flatMap((item) => {
          const [nome, tipo] = item.split(":").map((parte) => parte.trim());
          const obrigatorio = !item.includes("=");
          return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
        });
      const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
        ? []
        : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
      tasks.push({
        nome: paraSnakeCase(nomeFuncao),
        resumo: `Task importada automaticamente de ${relacao}#${nomeFuncao}.`,
        input: deduplicarCampos(input),
        output,
        errors: extrairErrosPython(trecho),
        effects: descreverEfeitosPorHeuristica(trecho),
        impl: { py: caminhoImplPython(diretorio, arquivo, nomeFuncao) },
        origemArquivo: relacao,
        origemSimbolo: nomeFuncao,
      });
    }

    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
    for (const match of texto.matchAll(classRegex)) {
      const nomeClasse = match[1]!;
      const bases = match[2] ?? "";
      const corpo = match[3]!;
      if (/(BaseModel|Enum|StrEnum)/.test(bases)) {
        continue;
      }
      for (const metodo of corpo.matchAll(/^\s{4}(?:async\s+def|def)\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm)) {
        const nomeMetodo = metodo[1]!;
        if (nomeMetodo.startsWith("_")) {
          continue;
        }
        const parametros = metodo[2]!;
        const retorno = metodo[3]?.trim();
        const input = parametros
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
          .flatMap((item) => {
            const [nome, tipo] = item.split(":").map((parte) => parte.trim());
            const obrigatorio = !item.includes("=");
            return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
          });
        const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
        tasks.push({
          nome: paraSnakeCase(nomeMetodo),
          resumo: `Task importada automaticamente de ${relacao}#${nomeClasse}.${nomeMetodo}.`,
          input: deduplicarCampos(input),
          output,
          errors: extrairErrosPython(corpo),
          effects: descreverEfeitosPorHeuristica(corpo),
          impl: { py: caminhoImplPython(diretorio, arquivo, `${nomeClasse}.${nomeMetodo}`) },
          origemArquivo: relacao,
          origemSimbolo: `${nomeClasse}.${nomeMetodo}`,
        });
      }
    }

    if (!tasks.length && !routes.length) {
      continue;
    }

    const { entities, enums } = criarEntidadesPython(tiposGlobais, entitiesRef, enumsRef);
    sincronizarRotasComTasks(routes, tasks);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: deduplicarRotas(routes),
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}

async function importarDartBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".dart"]))
    .filter((arquivo) => !arquivo.endsWith(".g.dart") && !arquivo.endsWith(".freezed.dart"));
  const modulos: ModuloImportado[] = [];

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];

    for (const match of texto.matchAll(/(?:Future<([^\n]+)>|([\w?<>.,\s]+))\s+(\w+)\(([^)]*)\)\s*(?:async\s*)?\{/g)) {
      const retorno = (match[1] ?? match[2] ?? "").trim();
      const nome = match[3]!;
      if (["build", "toString", "hashCode"].includes(nome)) {
        continue;
      }
      const parametros = match[4]!;
      const input = parametros
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/^(required|final)\s+/g, ""))
        .map((item) => {
          const partes = item.split(/\s+/);
          const nomeParametro = partes.at(-1) ?? "param";
          const tipoParametro = partes.length > 1 ? partes.slice(0, -1).join(" ") : undefined;
          return {
            nome: paraSnakeCase(nomeParametro),
            tipo: mapearTipoPrimitivo(tipoParametro ?? "Json"),
            obrigatorio: item.includes("required"),
          };
        });
      const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
        ? []
        : [{ nome: "resultado", tipo: mapearTipoPrimitivo(retorno || "Json"), obrigatorio: false }];
      tasks.push({
        nome: paraSnakeCase(nome),
        resumo: `Task importada automaticamente de ${relacao}#${nome}.`,
        input,
        output,
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { dart: caminhoImplDart(diretorio, arquivo, nome) },
        origemArquivo: relacao,
        origemSimbolo: nome,
      });
    }

    if (tasks.length === 0) {
      continue;
    }

    modulos.push({
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: [],
      entities: [],
      enums: [],
    });
  }

  return modulos;
}

function criarModuloImportadoSimples(
  nome: string,
  resumo: string,
  tasks: TarefaImportada[],
  routes: RotaImportada[] = [],
  vinculos: VinculoImportado[] = [],
  databases: DatabaseImportado[] = [],
): ModuloImportado {
  sincronizarRotasComTasks(routes, tasks);
  return {
    nome,
    resumo,
    tasks: deduplicarTarefas(tasks),
    routes: deduplicarRotas(routes),
    entities: [],
    enums: [],
    databases: deduplicarDatabases(databases),
    vinculos: deduplicarVinculos(vinculos),
  };
}

function acumularModuloImportado(
  modulos: Map<string, ModuloImportado>,
  modulo: ModuloImportado,
): void {
  const existente = modulos.get(modulo.nome);
  if (!existente) {
    modulos.set(modulo.nome, modulo);
    return;
  }

  existente.tasks = deduplicarTarefas([...existente.tasks, ...modulo.tasks]);
  existente.routes = deduplicarRotas([...existente.routes, ...modulo.routes]);
  existente.entities = deduplicarEntidades([...existente.entities, ...modulo.entities]);
  existente.enums = deduplicarEnums([...existente.enums, ...modulo.enums]);
  existente.databases = deduplicarDatabases([...(existente.databases ?? []), ...(modulo.databases ?? [])]);
  existente.vinculos = deduplicarVinculos([...(existente.vinculos ?? []), ...(modulo.vinculos ?? [])]);
}

function selecionarSimbolosPreferidos<T extends { simbolo: string }>(simbolos: T[]): T[] {
  const mapa = new Map<string, T>();
  for (const simbolo of simbolos) {
    const chave = simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo;
    const existente = mapa.get(chave);
    if (!existente) {
      mapa.set(chave, simbolo);
      continue;
    }
    const pontuacaoAtual = simbolo.simbolo.split(".").length;
    const pontuacaoExistente = existente.simbolo.split(".").length;
    if (pontuacaoAtual > pontuacaoExistente) {
      mapa.set(chave, simbolo);
    }
  }
  return [...mapa.values()];
}

async function existeArquivo(caminho: string): Promise<boolean> {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

async function resolverArquivoRustParaSimbolo(
  diretorio: string,
  relacaoFonte: string,
  simbolo: string,
): Promise<string> {
  const partes = simbolo.split(".").filter(Boolean);
  if (partes.length <= 1) {
    return path.join(diretorio, relacaoFonte);
  }

  const moduloPartes = partes.slice(0, -1);
  const baseAtual = path.dirname(relacaoFonte);
  const candidatos = [
    path.join(baseAtual, ...moduloPartes) + ".rs",
    path.join(baseAtual, ...moduloPartes, "mod.rs"),
    path.join("src", ...moduloPartes) + ".rs",
    path.join("src", ...moduloPartes, "mod.rs"),
  ];

  for (const candidato of candidatos) {
    const absoluto = path.join(diretorio, candidato);
    if (await existeArquivo(absoluto)) {
      return absoluto;
    }
  }

  return path.join(diretorio, relacaoFonte);
}

async function importarDotnetBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".cs"]))
    .filter((arquivo) => !/(^|[\\/])(bin|obj|Test[s]?)([\\/]|$)/i.test(arquivo));
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao, { preservarUltimo: true, snakeCaseUltimo: true });
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosDotnet(texto)) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: criarCampoResultadoBackend(simbolo.retorno),
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { cs: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    for (const rota of extrairRotasDotnet(texto)) {
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      const output = criarCampoResultadoBackend(rota.retorno);
      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP ASP.NET Core importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { cs: caminhoImplGenerico(diretorio, arquivo, rota.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: rota.simbolo,
      });
      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota ASP.NET Core importada automaticamente de ${relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
      });
    }

    if (tasks.length === 0 && routes.length === 0) {
      continue;
    }

    acumularModuloImportado(modulos, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      routes,
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));
  }

  return [...modulos.values()];
}

async function importarJavaBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".java"]))
    .filter((arquivo) => !/(^|[\\/])(target|build|out|Test[s]?)([\\/]|$)/i.test(arquivo));
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao, { preservarUltimo: true, snakeCaseUltimo: true });
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosJava(texto)) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: criarCampoResultadoBackend(simbolo.retorno),
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { java: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    for (const rota of extrairRotasJava(texto)) {
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      const output = criarCampoResultadoBackend(rota.retorno);
      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP Spring Boot importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { java: caminhoImplGenerico(diretorio, arquivo, rota.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: rota.simbolo,
      });
      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota Spring Boot importada automaticamente de ${relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
      });
    }

    if (tasks.length === 0 && routes.length === 0) {
      continue;
    }

    acumularModuloImportado(modulos, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      routes,
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));
  }

  return [...modulos.values()];
}

async function importarGoBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".go"]);
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosGo(texto)) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: criarCampoResultadoBackend(simbolo.retorno),
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { go: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    for (const rota of extrairRotasGo(texto)) {
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP Go importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { go: caminhoImplGenerico(diretorio, arquivo, rota.simbolo) },
        origemArquivo: relacao,
        origemSimbolo: rota.simbolo,
      });
      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota Go importada automaticamente de ${relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
      });
    }

    if (tasks.length === 0 && routes.length === 0) {
      continue;
    }

    modulos.set(nomeModulo, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      routes,
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));
  }

  return [...modulos.values()];
}

async function importarRustBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".rs"]);
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosRust(texto)) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: criarCampoResultadoBackend(simbolo.retorno),
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { rust: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    acumularModuloImportado(modulos, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      routes,
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));

    for (const rota of extrairRotasRust(texto)) {
      const simboloLimpo = rota.simbolo.replace(/::/g, ".");
      const nomeSimbolo = simboloLimpo.split(".").at(-1) ?? simboloLimpo;
      const arquivoAlvo = await resolverArquivoRustParaSimbolo(diretorio, relacao, simboloLimpo);
      const relacaoAlvo = path.relative(diretorio, arquivoAlvo);
      const moduloAlvo = [namespaceBase, ...inferirContextoPorArquivo(relacaoAlvo)].join(".");
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      const task: TarefaImportada = {
        nome: taskNome,
        resumo: `Task HTTP Axum importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { rust: caminhoImplGenerico(diretorio, arquivoAlvo, nomeSimbolo) },
        origemArquivo: relacaoAlvo,
        origemSimbolo: nomeSimbolo,
      };
      const route: RotaImportada = {
        nome: `${taskNome}_publico`,
        resumo: `Rota Axum importada automaticamente de ${relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
      };
      acumularModuloImportado(modulos, criarModuloImportadoSimples(
        moduloAlvo,
        `Rascunho Sema importado automaticamente de ${relacaoAlvo}.`,
        [task],
        [route],
        [],
        inferirDatabasesPorHeuristica(texto, relacao),
      ));
    }
  }

  return [...modulos.values()];
}

async function importarCppBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".cpp", ".cc", ".cxx", ".hpp", ".h"]))
    .filter((arquivo) => !/(^|[\\/])(windows|linux|macos|runner|flutter|ephemeral|build|vendor)([\\/]|$)/i.test(arquivo));
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];

    for (const simbolo of selecionarSimbolosPreferidos(extrairSimbolosCpp(texto))) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { cpp: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    if (tasks.length === 0) {
      continue;
    }

    acumularModuloImportado(modulos, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      [],
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));
  }

  return [...modulos.values()];
}

export async function importarProjetoLegado(
  fonte: FonteImportacao,
  diretorio: string,
  namespaceBase?: string,
): Promise<ResultadoImportacao> {
  const base = path.resolve(diretorio);
  const namespace = inferirNamespaceBase(base, namespaceBase);

  let modulos: ModuloImportado[] = [];
  if (fonte === "nestjs") {
    modulos = await importarTypeScriptBase(base, namespace, true);
  } else if (fonte === "nextjs") {
    modulos = await importarNextJsBase(base, namespace);
  } else if (fonte === "nextjs-consumer") {
    modulos = await importarNextJsConsumerBase(base, namespace);
  } else if (fonte === "react-vite-consumer") {
    modulos = await importarReactViteConsumerBase(base, namespace);
  } else if (fonte === "angular-consumer") {
    modulos = await importarAngularConsumerBase(base, namespace);
  } else if (fonte === "flutter-consumer") {
    modulos = await importarFlutterConsumerBase(base, namespace);
  } else if (fonte === "firebase") {
    modulos = await importarFirebaseBase(base, namespace);
  } else if (fonte === "typescript") {
    modulos = await importarTypeScriptBase(base, namespace, false);
  } else if (fonte === "fastapi") {
    modulos = await importarPythonBase(base, namespace, "fastapi");
  } else if (fonte === "flask") {
    modulos = await importarPythonBase(base, namespace, "flask");
  } else if (fonte === "python") {
    modulos = await importarPythonBase(base, namespace, "nenhum");
  } else if (fonte === "dart") {
    modulos = await importarDartBase(base, namespace);
  } else if (fonte === "dotnet") {
    modulos = await importarDotnetBase(base, namespace);
  } else if (fonte === "java") {
    modulos = await importarJavaBase(base, namespace);
  } else if (fonte === "go") {
    modulos = await importarGoBase(base, namespace);
  } else if (fonte === "rust") {
    modulos = await importarRustBase(base, namespace);
  } else if (fonte === "cpp") {
    modulos = await importarCppBase(base, namespace);
  }

  const arquivos: ArquivoImportado[] = [];
  for (const modulo of modulos) {
    const bruto = moduloParaCodigo(modulo);
    const formatado = await formatarModuloImportado(bruto, `${modulo.nome}.sema`);
    arquivos.push(montarArquivoImportado(modulo, namespace, formatado));
  }

  const diagnosticos = compilarProjeto(
    arquivos.map((arquivo) => ({
      caminho: path.join(base, ".tmp", "importado", arquivo.caminhoRelativo),
      codigo: arquivo.conteudo,
    })),
  ).diagnosticos;

  return {
    fonte,
    diretorio: base,
    namespaceBase: namespace,
    arquivos,
    diagnosticos,
  };
}

export function resumoImportacao(resultado: ResultadoImportacao): {
  modulos: number;
  tarefas: number;
  rotas: number;
  entidades: number;
  enums: number;
  databases: number;
  diagnosticos: number;
  sucesso: boolean;
} {
  return {
    modulos: resultado.arquivos.length,
    tarefas: resultado.arquivos.reduce((total, arquivo) => total + arquivo.tarefas, 0),
    rotas: resultado.arquivos.reduce((total, arquivo) => total + arquivo.rotas, 0),
    entidades: resultado.arquivos.reduce((total, arquivo) => total + arquivo.entidades, 0),
    enums: resultado.arquivos.reduce((total, arquivo) => total + arquivo.enums, 0),
    databases: resultado.arquivos.reduce((total, arquivo) => total + arquivo.databases, 0),
    diagnosticos: resultado.diagnosticos.length,
    sucesso: !temErros(resultado.diagnosticos),
  };
}
