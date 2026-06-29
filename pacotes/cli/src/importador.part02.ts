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
import { extrairParametrosCaminhoFlask, extrairRotasFlaskDecoradas } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import {
  extrairRotasTypeScriptHttp,
  inferirSemanticaHandlerTypeScriptHttp,
  localizarExportacaoTypeScriptHttp,
  type CampoInferidoTypeScriptHttp,
} from "./typescript-http.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";

import { CampoImportado, DatabaseImportado, EfeitoImportado, EntidadeImportada, EnumImportado, ErroImportado, RecursoDatabaseImportado, SUFIXOS_WRAPPER, TipoDescoberto, TipoEnumDescoberto, extrairTextoLiteral, limparTipoBackend, mapearTipoPrimitivo, normalizarNomeCampoImportado, paraIdentificadorModulo, paraSnakeCase } from "./importador.part01.js";
import { deduplicarEntidades } from "./importador.part05.js";

export function mapearTipoBackendParaSema(tipo: string | undefined): string {
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

export function criarCampoResultadoBackend(tipo: string | undefined): CampoImportado[] {
  const tipoSema = mapearTipoBackendParaSema(tipo);
  return tipoSema === "Vazio"
    ? []
    : [{ nome: "resultado", tipo: tipoSema, obrigatorio: false }];
}

export function camposDeParametrosRotaBackend(
  parametros: Array<{ nome: string; tipoSema: "Texto" | "Inteiro" | "Decimal" | "Id" }>,
): CampoImportado[] {
  return parametros.map((parametro) => ({
    nome: normalizarNomeCampoImportado(parametro.nome),
    tipo: parametro.tipoSema,
    obrigatorio: true,
  }));
}

export function pareceWrapperTipo(nome: string): boolean {
  return SUFIXOS_WRAPPER.some((sufixo) => nome.endsWith(sufixo)) || /(entrada|saida|dto|request|response|payload|body|input|output)/i.test(nome);
}

export function descreverEfeitosPorHeuristica(codigo: string): EfeitoImportado[] {
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

export function deduplicarDatabases(databases: DatabaseImportado[]): DatabaseImportado[] {
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

export function inferirDatabasesPorHeuristica(codigo: string, relacao: string): DatabaseImportado[] {
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

export function normalizarNomeErroBruto(nome: string): string {
  return paraSnakeCase(nome.replace(/(Error|Erro|Exception)$/i, "")) || "erro_importado";
}

export function extrairErrosTs(node: ts.Node, sourceFile: ts.SourceFile): ErroImportado[] {
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

export function extrairTiposTs(sourceFile: ts.SourceFile): Map<string, TipoDescoberto> {
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

export function mapearTipoTsParaSema(
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

export function expandirCamposTs(
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

export function criarEntidadesReferenciadas(
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

export function caminhoImplTs(diretorioBase: string, arquivo: string, simbolo: string): string {
  const relativo = path.relative(diretorioBase, arquivo).replace(/\.[^.]+$/, "");
  const segmentos = relativo.split(path.sep).map((segmento) => paraIdentificadorModulo(segmento)).filter(Boolean);
  return [...segmentos, simbolo].join(".");
}

export function mapearCampoInferidoTypeScriptHttp(
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

export function camposDeSemanticaTypeScriptHttp(
  campos: CampoInferidoTypeScriptHttp[],
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): CampoImportado[] {
  return campos.map((campo) => mapearCampoInferidoTypeScriptHttp(campo, tipos, entidadesReferenciadas, enumsReferenciados));
}
