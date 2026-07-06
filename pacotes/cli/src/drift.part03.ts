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

import { NOMES_RECURSO_IGNORADOS, OPERACOES_REDIS_KEYSPACE, OPERACOES_REDIS_STREAM, fecharPrefixoRecurso, limparLiteralRecurso, normalizarNomeRecursoDrift } from "./drift.part02.js";
import { OrigemRecursoDrift, RecursoResolvido, RegistroVinculoDrift, SimboloResolvido, TipoRecursoDrift, normalizarFragmentoArquivo } from "./drift.part01.js";
import { extrairColecoesFirebase } from "./drift.part06.js";

export function variantesNomeRecursoDrift(valor: string): string[] {
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

export function recursoEhIgnorado(nome: string): boolean {
  const normalizado = normalizarNomeRecursoDrift(nome);
  if (!normalizado || normalizado.length < 2) {
    return true;
  }
  return NOMES_RECURSO_IGNORADOS.has(normalizado);
}

export function registrarRecursoDrift(
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

export function inferirMotoresRelacionais(codigo: string, arquivo: string): EngineBanco[] {
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

export function extrairRecursosSql(arquivo: string, codigo: string): RecursoResolvido[] {
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

export function limparIdentificadorSql(valor: string): string {
  const limpo = valor.trim();
  if ((limpo.startsWith("\"") && limpo.endsWith("\""))
    || (limpo.startsWith("`") && limpo.endsWith("`"))
    || (limpo.startsWith("[") && limpo.endsWith("]"))) {
    return limpo.slice(1, -1).replace(/""/g, "\"").trim();
  }
  return limpo;
}

export function normalizarNomeSqlDeclarativo(valor: string): string {
  return valor
    .split(/\s*\.\s*/g)
    .map(limparIdentificadorSql)
    .filter(Boolean)
    .join(".");
}

export function registrarSimboloSqlDeclarativo(
  simbolos: Map<string, SimboloResolvido>,
  arquivo: string,
  nomeSql: string,
): void {
  const caminho = normalizarNomeSqlDeclarativo(nomeSql);
  if (!caminho) {
    return;
  }

  const ultimoSegmento = caminho.split(".").filter(Boolean).at(-1);
  for (const simbolo of [caminho, ultimoSegmento].filter((item): item is string => Boolean(item))) {
    if (!simbolos.has(simbolo)) {
      simbolos.set(simbolo, {
        origem: "sql",
        caminho: simbolo,
        arquivo,
        simbolo,
      });
    }
  }
}

export function extrairSimbolosSqlDeclarativos(arquivo: string, codigo: string): SimboloResolvido[] {
  if (!/\.(?:sql|psql|ddl)$/i.test(arquivo)) {
    return [];
  }

  const simbolos = new Map<string, SimboloResolvido>();
  const padraoIdentificadorSql = /(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)/;
  const padraoObjetoSql = new RegExp(
    `\\bcreate\\s+(?:or\\s+replace\\s+)?(?:function|procedure)\\s+(${padraoIdentificadorSql.source}(?:\\s*\\.\\s*${padraoIdentificadorSql.source})?)\\s*\\(`,
    "gi",
  );

  for (const match of codigo.matchAll(padraoObjetoSql)) {
    registrarSimboloSqlDeclarativo(simbolos, arquivo, match[1] ?? "");
  }

  return [...simbolos.values()];
}

export function extrairRecursosMongoDb(arquivo: string, codigo: string): RecursoResolvido[] {
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

export function extrairRecursosRedis(arquivo: string, codigo: string): RecursoResolvido[] {
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

export function extrairRecursosArquivoLocal(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();
  const contextoArquivoLocal = /\b(?:json|jsonl|ndjson)\b/i.test(codigo)
    || /\b(?:read_text|write_text|readFile(?:Sync)?|writeFile(?:Sync)?|open)\b/i.test(codigo)
    || /\.(?:json|jsonl|ndjson|db|sqlite|sqlite3)\b/i.test(codigo)
    || /@capacitor\/preferences|Preferences\.(?:get|set|remove)\s*\(/i.test(codigo)
    || /\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(/i.test(codigo)
    || /(?:repository|repositories|repositorio|repo|store|storage|persist|cache)/i.test(normalizarFragmentoArquivo(arquivo));
  if (!contextoArquivoLocal) {
    return [];
  }

  for (const match of codigo.matchAll(/["'`]([^"'`]+\.(?:json|jsonl|ndjson|db|sqlite|sqlite3))["'`]/gi)) {
    const literal = match[1] ?? "";
    const nomeBase = path.basename(literal, path.extname(literal));
    registrarRecursoDrift(recursos, "arquivo", "arquivo_local", nomeBase, arquivo);
  }

  const nomeArquivo = path.basename(arquivo).replace(/\.(?:ts|tsx|js|jsx|mjs|cjs|py|dart|lua|cs|java|go|rs|cpp|cc|cxx|hpp|h|php)$/i, "");
  const nomeStore = nomeArquivo
    .replace(/(?:[_.-]?(?:repository|repositories|repo|store|storage|persistencia|persistence))$/i, "")
    .trim();
  if (nomeStore && /(?:repository|repositories|repositorio|repo|store|storage|persist|cache)/i.test(nomeArquivo)) {
    registrarRecursoDrift(recursos, "arquivo", "arquivo_local", nomeStore, arquivo);
  }

  for (const match of codigo.matchAll(/Preferences\.(?:get|set|remove)\s*\(\s*\{[\s\S]{0,160}?key\s*:\s*["'`]([^"'`]+)["'`]/gi)) {
    registrarRecursoDrift(recursos, "arquivo", "arquivo_local", match[1]!, arquivo);
  }

  for (const match of codigo.matchAll(/\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(\s*["'`]([^"'`]+)["'`]/gi)) {
    registrarRecursoDrift(recursos, "arquivo", "arquivo_local", match[1]!, arquivo);
  }

  return [...recursos.values()];
}

export function extrairRecursosPersistenciaCodigoVivo(arquivo: string, codigo: string): RecursoResolvido[] {
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

export function extrairRecursosPrisma(arquivo: string, codigo: string): RecursoResolvido[] {
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

export function escolherArquivoPorVinculo(arquivos: string[], valor: string): { arquivo?: string; confianca: NivelConfiancaSemantica; status: RegistroVinculoDrift["status"] } {
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

export function escolherSimboloPorVinculo(
  simbolos: SimboloResolvido[],
  mapaImpl: Map<string, SimboloResolvido>,
  valor: string,
): { simbolo?: SimboloResolvido; confianca: NivelConfiancaSemantica; status: RegistroVinculoDrift["status"] } {
  const exato = mapaImpl.get(valor);
  if (exato) {
    return { simbolo: exato, confianca: "alta", status: "resolvido" };
  }

  const valorNormalizado = valor.toLowerCase();
  const exatoIndexado = simbolos.find((simbolo) =>
    simbolo.caminho.toLowerCase() === valorNormalizado
    || simbolo.simbolo.toLowerCase() === valorNormalizado);
  if (exatoIndexado) {
    return { simbolo: exatoIndexado, confianca: "alta", status: "resolvido" };
  }

  const ultimoSegmento = valor.split(".").at(-1)?.toLowerCase();
  if (!ultimoSegmento) {
    return { confianca: "baixa", status: "nao_encontrado" };
  }
  const aproximado = simbolos.find((simbolo) =>
    simbolo.simbolo.toLowerCase() === ultimoSegmento
    || simbolo.caminho.toLowerCase().endsWith(`.${ultimoSegmento}`));

  if (aproximado) {
    return { simbolo: aproximado, confianca: "media", status: "parcial" };
  }

  return { confianca: "baixa", status: "nao_encontrado" };
}
