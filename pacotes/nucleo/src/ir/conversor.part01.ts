// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.
import type { BlocoCasoTesteAst, BlocoGenericoAst, CampoAst, ModuloAst } from "../ast/tipos.js";
import type { Diagnostico } from "../diagnosticos/index.js";
import {
  localizarCampoPersistencia,
  matrizCompatibilidadePersistencia,
  nomeTipoRecursoPersistencia,
  normalizarConsistenciaPersistencia,
  normalizarDurabilidadePersistencia,
  normalizarEngineBanco,
  normalizarModeloConsultaPersistencia,
  normalizarModeloTransacaoPersistencia,
  parsearBooleanoPersistencia,
  TIPOS_RECURSO_PERSISTENCIA,
  type TipoRecursoPersistencia,
} from "../persistencia/contratos.js";
import type { ContextoSemantico, ErroSemanticoTask } from "../semantico/analisador.js";
import {
  contratoDadosTemSensivel,
  extrairContratoAudit,
  extrairContratoAuth,
  extrairContratoAuthz,
  extrairContratoDados,
  extrairContratoForbidden,
  extrairContratoSegredos,
  efeitoEhPrivilegiado,
} from "../semantico/seguranca.js";
import { parsearEfeitoSemantico, parsearEtapaFlow, parsearExpressaoSemantica, parsearTransicaoEstado } from "../semantico/estruturas.js";
import type {
  IrBlocoDeclarativo,
  IrCampo,
  IrCasoTeste,
  IrAudit,
  IrAuth,
  IrAuthz,
  IrDados,
  IrEntity,
  IrErroOperacional,
  IrExecucao,
  IrForbidden,
  IrFlow,
  IrImplementacaoTask,
  IrBancoDados,
  IrCompatibilidadePersistencia,
  IrModulo,
  IrRecursoPersistencia,
  IrResumoAgente,
  IrRoute,
  IrRoutePublica,
  IrSegredos,
  IrState,
  IrSuperficie,
  IrTask,
  IrType,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  PerfilCompatibilidade,
  TipoSuperficieIr,
} from "./modelos.js";
export const TIPOS_PRIMITIVOS = new Set([
  "Texto",
  "Numero",
  "Inteiro",
  "Decimal",
  "Booleano",
  "Data",
  "DataHora",
  "Timestamp",
  "Id",
  "Email",
  "Url",
  "Json",
  "Objeto",
  "Vazio",
]);
export function encontrarSubBloco(bloco: BlocoGenericoAst, palavraChave: string): BlocoGenericoAst | undefined {
  return bloco.blocos.find((subbloco): subbloco is BlocoGenericoAst => subbloco.tipo === "bloco_generico" && subbloco.palavraChave === palavraChave);
}
export function localizarCampo(bloco: BlocoGenericoAst | undefined, ...nomes: string[]): CampoAst | undefined {
  return bloco?.campos.find((campo) => nomes.includes(campo.nome));
}
export function valorCampoCompleto(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }
  return [campo.valor, ...campo.modificadores].join(" ").trim() || undefined;
}
export function normalizarTipoDeclarado(tipo: string): string {
  return tipo
    .replace(/\s*([<>\[\](),|?])\s*/g, "$1")
    .replace(/\s+/g, "")
    .trim();
}
export function dividirNoNivelRaiz(texto: string, separador: string): string[] {
  const partes: string[] = [];
  let profundidadeAngular = 0;
  let profundidadeColchete = 0;
  let inicio = 0;
  for (let indice = 0; indice < texto.length; indice += 1) {
    const caractere = texto[indice]!;
    if (caractere === "<") {
      profundidadeAngular += 1;
      continue;
    }
    if (caractere === ">") {
      profundidadeAngular = Math.max(0, profundidadeAngular - 1);
      continue;
    }
    if (caractere === "[") {
      profundidadeColchete += 1;
      continue;
    }
    if (caractere === "]") {
      profundidadeColchete = Math.max(0, profundidadeColchete - 1);
      continue;
    }
    if (profundidadeAngular === 0 && profundidadeColchete === 0 && texto.startsWith(separador, indice)) {
      partes.push(texto.slice(inicio, indice));
      inicio = indice + separador.length;
      indice += separador.length - 1;
    }
  }
  partes.push(texto.slice(inicio));
  return partes.map((parte) => parte.trim()).filter(Boolean);
}
export function analisarCampoTipo(tipo: string, modificadores: string[]): Omit<IrCampo, "nome"> {
  const tipoOriginal = normalizarTipoDeclarado(tipo);
  const modificadoresNormalizados = modificadores.map((item) => item.trim()).filter(Boolean);
  const refinamentos = modificadoresNormalizados.filter((item) => !["required", "optional", "opcional"].includes(item));
  const opcionalPorModificador = modificadoresNormalizados.includes("optional") || modificadoresNormalizados.includes("opcional");
  let tipoBase = tipoOriginal;
  let cardinalidade: IrCampo["cardinalidade"] = "unitario";
  let tiposAlternativos: string[] = [];
  let tipoItem: string | undefined;
  let chaveMapa: string | undefined;
  let valorMapa: string | undefined;
  let opcional = opcionalPorModificador;
  if (tipoBase.endsWith("?")) {
    opcional = true;
    tipoBase = tipoBase.slice(0, -1);
  }
  if (/^Opcional<.+>$/.test(tipoBase)) {
    opcional = true;
    tipoBase = tipoBase.slice("Opcional<".length, -1);
  }
  const uniao = dividirNoNivelRaiz(tipoBase, "|");
  if (uniao.length > 1) {
    cardinalidade = "uniao";
    tiposAlternativos = uniao.map(normalizarTipoDeclarado);
    tipoBase = tiposAlternativos[0] ?? tipoBase;
  } else if (/^Lista<.+>$/.test(tipoBase)) {
    cardinalidade = "lista";
    tipoItem = tipoBase.slice("Lista<".length, -1).trim();
    tipoBase = tipoItem;
  } else if (/^Mapa<.+>$/.test(tipoBase)) {
    cardinalidade = "mapa";
    const partesMapa = dividirNoNivelRaiz(tipoBase.slice("Mapa<".length, -1), ",");
    chaveMapa = partesMapa[0];
    valorMapa = partesMapa[1];
    tipoBase = valorMapa ?? tipoBase;
  }
  return {
    tipo: tipoOriginal,
    modificadores: modificadoresNormalizados,
    tipoOriginal,
    tipoBase,
    cardinalidade,
    opcional,
    tiposAlternativos,
    tipoItem,
    chaveMapa,
    valorMapa,
    refinamentos,
  };
}
export function converterCampo(campo: CampoAst): IrCampo {
  return {
    nome: campo.nome,
    ...analisarCampoTipo(campo.valor, campo.modificadores),
  };
}
export function converterCampos(bloco?: BlocoGenericoAst): IrCampo[] {
  if (!bloco) {
    return [];
  }
  return bloco.campos.map(converterCampo);
}
export function converterBloco(bloco?: BlocoGenericoAst): IrBlocoDeclarativo {
  return {
    campos: converterCampos(bloco),
    linhas: bloco?.linhas.map((linha) => linha.conteudo) ?? [],
    blocos: (bloco?.blocos ?? [])
      .filter((subbloco): subbloco is BlocoGenericoAst => subbloco.tipo === "bloco_generico")
      .map((subbloco) => ({
        nome: subbloco.nome ?? subbloco.palavraChave,
        conteudo: converterBloco(subbloco),
      })),
  };
}
export function converterCaso(caso: BlocoCasoTesteAst): IrCasoTeste {
  return {
    nome: caso.nome,
    given: converterBloco(caso.given),
    when: caso.when ? converterBloco(caso.when) : undefined,
    expect: converterBloco(caso.expect),
    error: caso.error ? converterBloco(caso.error) : undefined,
  };
}
export function coletarLinhasPersistencia(bloco: BlocoGenericoAst | undefined, nome: string): string[] {
  if (!bloco) {
    return [];
  }
  return encontrarSubBloco(bloco, nome)?.linhas.map((linha) => linha.conteudo) ?? [];
}
export function resolverTipoRecursoPersistencia(bloco: BlocoGenericoAst): TipoRecursoPersistencia | undefined {
  const explicito = valorCampoCompleto(localizarCampoPersistencia(bloco, "resource_kind"));
  if (explicito && TIPOS_RECURSO_PERSISTENCIA.has(explicito as TipoRecursoPersistencia)) {
    return explicito as TipoRecursoPersistencia;
  }
  return nomeTipoRecursoPersistencia(bloco);
}
export function converterCompatibilidadePersistencia(
  compatibilidades: ReturnType<typeof matrizCompatibilidadePersistencia>,
): IrCompatibilidadePersistencia[] {
  return compatibilidades.map((item) => ({ ...item }));
}
export function converterRecursoPersistencia(recurso: BlocoGenericoAst): IrRecursoPersistencia | undefined {
  const resourceKind = resolverTipoRecursoPersistencia(recurso);
  if (!resourceKind) {
    return undefined;
  }
  const mode = valorCampoCompleto(localizarCampoPersistencia(recurso, "mode"));
  const isolation = valorCampoCompleto(localizarCampoPersistencia(recurso, "isolation"));
  return {
    nome: recurso.nome ?? resourceKind,
    resourceKind,
    entity: valorCampoCompleto(localizarCampoPersistencia(recurso, "entity")),
    collection: valorCampoCompleto(localizarCampoPersistencia(recurso, "collection")),
    table: valorCampoCompleto(localizarCampoPersistencia(recurso, "table")),
    consistency: normalizarConsistenciaPersistencia(valorCampoCompleto(localizarCampoPersistencia(recurso, "consistency")))
      ?? valorCampoCompleto(localizarCampoPersistencia(recurso, "consistency")),
    durability: normalizarDurabilidadePersistencia(valorCampoCompleto(localizarCampoPersistencia(recurso, "durability")))
      ?? valorCampoCompleto(localizarCampoPersistencia(recurso, "durability")),
    transactionModel: normalizarModeloTransacaoPersistencia(valorCampoCompleto(localizarCampoPersistencia(recurso, "transaction_model")))
      ?? valorCampoCompleto(localizarCampoPersistencia(recurso, "transaction_model")),
    queryModel: normalizarModeloConsultaPersistencia(valorCampoCompleto(localizarCampoPersistencia(recurso, "query_model")))
      ?? valorCampoCompleto(localizarCampoPersistencia(recurso, "query_model")),
    mode,
    isolation,
    strategy: valorCampoCompleto(localizarCampoPersistencia(recurso, "strategy")),
    ttl: valorCampoCompleto(localizarCampoPersistencia(recurso, "ttl")),
    retention: valorCampoCompleto(localizarCampoPersistencia(recurso, "retention")),
    path: valorCampoCompleto(localizarCampoPersistencia(recurso, "path")),
    from: valorCampoCompleto(localizarCampoPersistencia(recurso, "from")),
    to: valorCampoCompleto(localizarCampoPersistencia(recurso, "to")),
    surface: valorCampoCompleto(localizarCampoPersistencia(recurso, "surface")),
    adapter: valorCampoCompleto(localizarCampoPersistencia(recurso, "adapter")),
    portavel: parsearBooleanoPersistencia(valorCampoCompleto(localizarCampoPersistencia(recurso, "portavel"))),
    capabilities: coletarLinhasPersistencia(recurso, "capabilities"),
    operations: coletarLinhasPersistencia(recurso, "operations"),
    indexing: coletarLinhasPersistencia(recurso, "indexing"),
    guarantees: coletarLinhasPersistencia(recurso, "guarantees"),
    diagnostics: coletarLinhasPersistencia(recurso, "diagnostics"),
    risks: coletarLinhasPersistencia(recurso, "risks"),
    fields: converterCampos(recurso),
    lines: recurso.linhas.map((linha) => linha.conteudo),
    block: converterBloco(recurso),
    compatibilidade: converterCompatibilidadePersistencia(matrizCompatibilidadePersistencia(resourceKind, { mode, isolation })),
  };
}
export function converterDatabase(database: BlocoGenericoAst): IrBancoDados {
  return {
    nome: database.nome ?? "database",
    engine: normalizarEngineBanco(valorCampoCompleto(localizarCampoPersistencia(database, "engine"))),
    schema: valorCampoCompleto(localizarCampoPersistencia(database, "schema")),
    database: valorCampoCompleto(localizarCampoPersistencia(database, "database")),
    consistency: normalizarConsistenciaPersistencia(valorCampoCompleto(localizarCampoPersistencia(database, "consistency")))
      ?? valorCampoCompleto(localizarCampoPersistencia(database, "consistency")),
    durability: normalizarDurabilidadePersistencia(valorCampoCompleto(localizarCampoPersistencia(database, "durability")))
      ?? valorCampoCompleto(localizarCampoPersistencia(database, "durability")),
    transactionModel: normalizarModeloTransacaoPersistencia(valorCampoCompleto(localizarCampoPersistencia(database, "transaction_model")))
      ?? valorCampoCompleto(localizarCampoPersistencia(database, "transaction_model")),
    queryModel: normalizarModeloConsultaPersistencia(valorCampoCompleto(localizarCampoPersistencia(database, "query_model")))
      ?? valorCampoCompleto(localizarCampoPersistencia(database, "query_model")),
    portavel: parsearBooleanoPersistencia(valorCampoCompleto(localizarCampoPersistencia(database, "portavel"))),
    adapter: valorCampoCompleto(localizarCampoPersistencia(database, "adapter")),
    capabilities: coletarLinhasPersistencia(database, "capabilities"),
    operations: coletarLinhasPersistencia(database, "operations"),
    indexing: coletarLinhasPersistencia(database, "indexing"),
    guarantees: coletarLinhasPersistencia(database, "guarantees"),
    diagnostics: coletarLinhasPersistencia(database, "diagnostics"),
    risks: coletarLinhasPersistencia(database, "risks"),
    fields: converterCampos(database),
    lines: database.linhas.map((linha) => linha.conteudo),
    block: converterBloco(database),
    resources: database.blocos
      .filter((bloco): bloco is BlocoGenericoAst => bloco.tipo === "bloco_generico")
      .map(converterRecursoPersistencia)
      .filter((item): item is IrRecursoPersistencia => Boolean(item)),
  };
}
const ORIGENS_INTEROP_IMPLEMENTACAO: Record<string, IrImplementacaoTask["origem"]> = {
  ts: "ts",
  typescript: "ts",
  js: "js",
  javascript: "js",
  py: "py",
  python: "py",
  dart: "dart",
  lua: "lua",
  cs: "cs",
  csharp: "cs",
  dotnet: "cs",
  java: "java",
  go: "go",
  golang: "go",
  rust: "rust",
  rs: "rust",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  "c++": "cpp",
  php: "php",
};
const PAPEIS_IMPLEMENTACAO_IR = new Set(["rota", "servico", "persistencia", "repositorio"]);

export function converterImplementacoes(bloco?: BlocoGenericoAst): IrImplementacaoTask[] {
  const implementacoes: IrImplementacaoTask[] = [];
  for (const campo of bloco?.campos ?? []) {
    const segmentos = campo.nome.toLowerCase().split("_");
    if (segmentos.length > 2) {
      continue;
    }
    const origem = ORIGENS_INTEROP_IMPLEMENTACAO[segmentos[0] ?? ""];
    if (!origem) {
      continue;
    }
    const papel = segmentos[1];
    if (papel !== undefined && !PAPEIS_IMPLEMENTACAO_IR.has(papel)) {
      continue;
    }
    implementacoes.push({
      origem,
      papel: papel as IrImplementacaoTask["papel"],
      caminho: campo.valor,
      resolucaoImpl: campo.valor,
      statusImpl: "nao_verificado",
    });
  }
  return implementacoes;
}
export function converterVinculos(bloco?: BlocoGenericoAst): IrVinculo[] {
  if (!bloco) {
    return [];
  }
  const campos = bloco.campos.map((campo) => {
    const valor = valorCampoCompleto(campo) ?? "";
    return {
      tipo: campo.nome,
      valor,
      arquivo: campo.nome === "arquivo" ? valor : undefined,
      simbolo: campo.nome === "simbolo" ? valor : undefined,
      recurso: ["recurso", "tabela", "fila", "cache", "storage"].includes(campo.nome) ? valor : undefined,
      superficie: ["superficie", "rota", "worker", "cron", "webhook", "evento", "policy", "fila", "cache", "storage"].includes(campo.nome) ? valor : undefined,
      statusResolucao: "nao_verificado" as const,
    };
  });
  const linhas = bloco.linhas.map((linha) => {
    const [tipo, ...resto] = linha.conteudo.split(/\s+/);
    const valor = resto.join(" ").trim();
    return {
      tipo: tipo ?? "desconhecido",
      valor,
      statusResolucao: "nao_verificado" as const,
    };
  }).filter((item) => item.valor);
  const subblocos = bloco.blocos
    .filter((item): item is BlocoGenericoAst => item.tipo === "bloco_generico")
    .map((item) => ({
      tipo: item.palavraChave === "desconhecido" ? (item.nome ?? "desconhecido") : item.palavraChave,
      valor: item.nome ?? item.palavraChave,
      arquivo: valorCampoCompleto(localizarCampo(item, "arquivo")),
      simbolo: valorCampoCompleto(localizarCampo(item, "simbolo")),
      recurso: valorCampoCompleto(localizarCampo(item, "recurso", "tabela", "fila", "cache", "storage")),
      superficie: valorCampoCompleto(localizarCampo(item, "superficie", "rota", "worker", "cron", "webhook", "evento")),
      statusResolucao: "nao_verificado" as const,
    }));
  return [...campos, ...linhas, ...subblocos];
}
export function converterExecucao(bloco?: BlocoGenericoAst): IrExecucao {
  const idempotencia = valorCampoCompleto(localizarCampo(bloco, "idempotencia"));
  const criticidadeOperacional = valorCampoCompleto(localizarCampo(bloco, "criticidade_operacional"));
  return {
    idempotencia: idempotencia === "verdadeiro" || idempotencia === "true",
    timeout: valorCampoCompleto(localizarCampo(bloco, "timeout")) ?? "padrao",
    retry: valorCampoCompleto(localizarCampo(bloco, "retry")) ?? "nenhum",
    compensacao: valorCampoCompleto(localizarCampo(bloco, "compensacao")) ?? "nenhuma",
    criticidadeOperacional: (
      criticidadeOperacional === "baixa"
      || criticidadeOperacional === "alta"
      || criticidadeOperacional === "critica"
    ) ? criticidadeOperacional : "media",
    explicita: Boolean(bloco),
  };
}
export function converterAuth(bloco?: BlocoGenericoAst): IrAuth {
  return extrairContratoAuth(bloco);
}
export function converterAuthz(bloco?: BlocoGenericoAst): IrAuthz {
  return extrairContratoAuthz(bloco);
}
export function converterDados(bloco?: BlocoGenericoAst): IrDados {
  return extrairContratoDados(bloco);
}
export function converterAudit(bloco?: BlocoGenericoAst): IrAudit {
  return extrairContratoAudit(bloco);
}
export function converterSegredos(bloco?: BlocoGenericoAst): IrSegredos {
  return extrairContratoSegredos(bloco);
}
export function converterForbidden(bloco?: BlocoGenericoAst): IrForbidden {
  return extrairContratoForbidden(bloco);
}
export function converterErrosTask(bloco?: BlocoGenericoAst, fallback?: ErroSemanticoTask[]): IrErroOperacional[] {
  const erros = new Map<string, IrErroOperacional>();
  for (const campo of bloco?.campos ?? []) {
    erros.set(campo.nome, {
      codigo: campo.nome,
      mensagem: valorCampoCompleto(campo) ?? "",
    });
  }
  for (const subbloco of bloco?.blocos ?? []) {
    if (subbloco.tipo !== "bloco_generico") {
      continue;
    }
    const codigo = subbloco.nome ?? subbloco.palavraChave;
    if (!codigo || codigo === "desconhecido") {
      continue;
    }
    erros.set(codigo, {
      codigo,
      mensagem: valorCampoCompleto(localizarCampo(subbloco, "mensagem")) ?? `Erro estruturado "${codigo}".`,
      categoria: valorCampoCompleto(localizarCampo(subbloco, "categoria")),
      recuperabilidade: valorCampoCompleto(localizarCampo(subbloco, "recuperabilidade")),
      acaoChamador: valorCampoCompleto(localizarCampo(subbloco, "acao_chamador")),
      impactaEstado: valorCampoCompleto(localizarCampo(subbloco, "impacta_estado")) === "verdadeiro",
      requerCompensacao: valorCampoCompleto(localizarCampo(subbloco, "requer_compensacao")) === "verdadeiro",
    });
  }
  for (const erro of fallback ?? []) {
    if (!erros.has(erro.codigo)) {
      erros.set(erro.codigo, {
        codigo: erro.codigo,
        mensagem: erro.mensagem,
        categoria: erro.categoria,
        recuperabilidade: erro.recuperabilidade,
        acaoChamador: erro.acaoChamador,
        impactaEstado: erro.impactaEstado,
        requerCompensacao: erro.requerCompensacao,
      });
    }
  }
  return [...erros.values()];
}
