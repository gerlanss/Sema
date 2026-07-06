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

import { OrigemRecursoDrift, RecursoEsperadoDrift, RecursoResolvido, RegistroColunaPersistenciaDrift, RegistroPersistenciaRealDrift, RegistroRepositorioPersistenciaDrift, SimboloResolvido, TipoRecursoDrift, categorizarPersistenciaPorOrigem, normalizarFragmentoArquivo, quebrarTermosEscopo } from "./drift.part01.js";
import { fecharPrefixoRecurso, limparLiteralRecurso, normalizarNomeRecursoDrift } from "./drift.part02.js";
import { extrairRecursosArquivoLocal, extrairRecursosMongoDb, extrairRecursosPersistenciaCodigoVivo, extrairRecursosPrisma, inferirMotoresRelacionais, variantesNomeRecursoDrift } from "./drift.part03.js";
import { normalizarOrigemParaEngine, registrarColunaPersistenciaDrift } from "./drift.part07.js";
import { listarArquivosRecursivos } from "./drift.part04.js";
import { recursoResolvidoCombinaEsperado } from "./drift.part10.js";
import { ordenarCandidatos, recursoPersistenciaCombinaAlvo } from "./drift.part09.js";

export function registrarRepositorioPersistenciaDrift(
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

export function extrairColunasSqlDetalhadas(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
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

export function extrairColunasPrismaDetalhadas(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
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

export function extrairCamposMongoDetalhados(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
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

export function extrairCamposRedisDetalhados(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
  const colunas = new Map<string, RegistroColunaPersistenciaDrift>();
  for (const match of codigo.matchAll(/\bh(?:set|get|del|exists)\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]/gi)) {
    registrarColunaPersistenciaDrift(colunas, "redis", match[1]!, match[2]!, arquivo);
  }
  return [...colunas.values()];
}

export function extrairCamposArquivoLocalDetalhados(arquivo: string, codigo: string): RegistroColunaPersistenciaDrift[] {
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

  for (const match of codigo.matchAll(/Preferences\.(?:get|set|remove)\s*\(\s*\{[\s\S]{0,160}?key\s*:\s*["'`]([^"'`]+)["'`]/gi)) {
    registrarColunaPersistenciaDrift(colunas, "arquivo", match[1]!, match[1]!, arquivo);
  }

  for (const match of codigo.matchAll(/\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(\s*["'`]([^"'`]+)["'`]/gi)) {
    registrarColunaPersistenciaDrift(colunas, "arquivo", match[1]!, match[1]!, arquivo);
  }

  return [...colunas.values()];
}

export function registrarRepositoriosPorRecursos(
  repositorios: Map<string, RegistroRepositorioPersistenciaDrift>,
  arquivo: string,
  codigo: string,
  recursos: RecursoResolvido[],
): void {
  const contextoRepositorio = /(?:repository|repositories|repositorio|repositorios|repo|dao|store|queries|persistence|persistencia)/i.test(arquivo)
    || /\b(?:Repository|Repositories|Dao|Store)\b/.test(codigo);
  const contextoAcesso = /\b(?:select|insert|update|delete|aggregate|findOne|findMany|findUnique|findFirst|prisma\.|db\.collection|createClient|hset|hget|xadd|xread|json\.(?:load|loads|dump|dumps)|JSON\.(?:parse|stringify)|read_text|write_text|readFile(?:Sync)?|writeFile(?:Sync)?|open|Preferences\.(?:get|set|remove)|localStorage\.(?:getItem|setItem|removeItem)|sessionStorage\.(?:getItem|setItem|removeItem))\b/i.test(codigo)
    || /\.(?:json|jsonl|ndjson|db|sqlite|sqlite3)\b/i.test(codigo);
  if (!contextoRepositorio && !contextoAcesso) {
    return;
  }

  for (const recurso of recursos) {
    registrarRepositorioPersistenciaDrift(repositorios, recurso.origem, recurso.nome, arquivo);
  }
}

export async function indexarPersistenciaDetalhada(
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
      ".py", ".dart", ".lua", ".cs", ".java", ".go", ".rs", ".cpp", ".cc", ".cxx", ".hpp", ".h", ".php",
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

export function recursoDetalhadoCombina(
  recurso: string,
  esperado: RecursoEsperadoDrift,
): boolean {
  return variantesNomeRecursoDrift(recurso).some((variante) =>
    esperado.nomes.some((nome) => variantesNomeRecursoDrift(nome).includes(variante)));
}

export function deduplicarRecursosResolvidos(recursos: RecursoResolvido[]): RecursoResolvido[] {
  return [...new Map(recursos.map((recurso) =>
    [`${recurso.origem}:${recurso.tipo}:${recurso.nome}:${recurso.arquivo}:${recurso.simbolo ?? ""}`, recurso] as const)).values()];
}

export function normalizarArquivoDeclaradoDrift(valor: string): string {
  return normalizarFragmentoArquivo(valor);
}

export function arquivoCombinaDeclaradoDrift(arquivoReal: string, arquivoDeclarado: string): boolean {
  const real = normalizarArquivoDeclaradoDrift(arquivoReal);
  const declarado = normalizarArquivoDeclaradoDrift(arquivoDeclarado);
  return real === declarado || real.endsWith(declarado) || declarado.endsWith(real);
}

export function coletarArquivosPreferidosPersistenciaTask(
  task: IrTask,
  mapaImpl?: Map<string, SimboloResolvido>,
): Set<string> {
  const arquivos = new Set<string>();
  for (const vinculo of task.vinculos) {
    if (vinculo.arquivo) {
      arquivos.add(vinculo.arquivo);
    }
    if (vinculo.tipo === "arquivo" && vinculo.valor) {
      arquivos.add(vinculo.valor);
    }
  }
  if (mapaImpl) {
    for (const impl of task.implementacoesExternas) {
      const resolvido = mapaImpl.get(impl.caminho);
      if (resolvido?.arquivo) {
        arquivos.add(resolvido.arquivo);
      }
    }
  }
  return arquivos;
}

export function resolverPersistenciaLocalPorTask(
  mapaRecursos: Map<string, RecursoResolvido[]>,
  task: IrTask,
  ir: IrModulo,
  esperado: RecursoEsperadoDrift,
  mapaImpl?: Map<string, SimboloResolvido>,
): RecursoResolvido[] {
  const todosRecursos = deduplicarRecursosResolvidos([...mapaRecursos.values()].flat());
  const arquivosPreferidos = [...coletarArquivosPreferidosPersistenciaTask(task, mapaImpl)];
  const candidatosPorArquivo = arquivosPreferidos.length > 0
    ? todosRecursos.filter((recurso) =>
      recurso.origem === "arquivo"
      && arquivosPreferidos.some((arquivo) => arquivoCombinaDeclaradoDrift(recurso.arquivo, arquivo)))
    : [];
  const variantesAlvo = new Set(variantesNomeRecursoDrift(esperado.alvo));
  const normalizarBusca = (valor: string) => valor.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const pontuarCandidato = (recurso: RecursoResolvido) => {
    let score = 0;
    if (recursoResolvidoCombinaEsperado(recurso, esperado)) {
      score += 4;
    }
    if (variantesNomeRecursoDrift(recurso.nome).some((variacao) => variantesAlvo.has(variacao))) {
      score += 2;
    }
    const nomeNormalizado = normalizarBusca(recurso.nome);
    const alvoNormalizado = normalizarBusca(esperado.alvo);
    if (nomeNormalizado.includes(alvoNormalizado) || alvoNormalizado.includes(nomeNormalizado)) {
      score += 1;
    }
    return score;
  };
  const ordenarCandidatos = (candidatos: RecursoResolvido[]) =>
    [...candidatos].sort((a, b) =>
      pontuarCandidato(b) - pontuarCandidato(a)
      || a.nome.localeCompare(b.nome, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR"));
  if (candidatosPorArquivo.length > 0) {
    return ordenarCandidatos(candidatosPorArquivo);
  }

  const termos = new Set([
    ...quebrarTermosEscopo(ir.nome),
    ...quebrarTermosEscopo(task.nome),
    ...quebrarTermosEscopo(esperado.alvo),
  ]);
  if (termos.size === 0) {
    return [];
  }

  return ordenarCandidatos(todosRecursos.filter((recurso) =>
    recurso.origem === "arquivo"
    && [...termos].some((termo) =>
      variantesNomeRecursoDrift(recurso.nome).some((variacao) => variacao.includes(termo)))));
}

export function detalhePersistenciaCombinaOrigem(
  origemDetalhe: OrigemRecursoDrift,
  recursoReal?: RecursoResolvido,
): boolean {
  if (!recursoReal) {
    return true;
  }
  return origemDetalhe === recursoReal.origem;
}

export function localizarCompatibilidadePersistencia(
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
