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

import { listarArquivosRecursivos, paraIdentificadorModulo } from "./drift.part04.js";
import { OpcoesDriftLegado, RegistroImpactoSemanticoArquivo, ResultadoImpactoSemantico, ResultadoRenomeacaoSemantica, SugestaoRenomeacaoSemantica, definirDiretoriosIgnoradosAtivos, obterDiretoriosIgnoradosAtivos, normalizarFragmentoArquivo, quebrarTermosEscopo, resolverDiretoriosIgnoradosAtivos, resolverOpcoesDrift } from "./drift.part01.js";
import { filtrarCaminhosEscopoReal, resolverDiretoriosCodigoEscopoReal, textoCombinaEscopo } from "./drift.part02.js";
import { analisarDriftLegado } from "./drift.part11.js";

export const EXTENSOES_BUSCA_IMPACTO = [
  ".sema",
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".dart", ".lua", ".cs", ".java", ".go", ".rs", ".cpp", ".cc", ".cxx", ".hpp", ".h", ".php",
  ".sql", ".psql", ".ddl", ".prisma", ".json",
];

export function construirVariantesSemanticas(valor: string): string[] {
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

export function classificarArquivoImpacto(arquivo: string): RegistroImpactoSemanticoArquivo["tipo"] {
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

export function prioridadeArquivoImpacto(tipo: RegistroImpactoSemanticoArquivo["tipo"]): RegistroImpactoSemanticoArquivo["prioridade"] {
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

export function textoIrCombinaTermos(texto: string, termos: string[]): boolean {
  return textoCombinaEscopo(texto, termos);
}

export function registrarArquivoImpactado(
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

export async function listarArquivosImpacto(
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

export function extrairLinhasComVariantes(codigo: string, variantes: string[]): number[] {
  const linhas: number[] = [];
  const texto = codigo.split(/\r?\n/);
  for (let indice = 0; indice < texto.length; indice += 1) {
    if (variantes.some((variante) => variante && texto[indice]!.includes(variante))) {
      linhas.push(indice + 1);
    }
  }
  return linhas;
}

export function serializarTaskParaImpacto(task: IrTask): string {
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

export function serializarRouteParaImpacto(route: IrRoute): string {
  return JSON.stringify({
    nome: route.nome,
    caminho: route.caminho,
    metodo: route.metodo,
    task: route.task,
    input: route.inputPublico.map((campo) => campo.nome),
    output: route.outputPublico.map((campo) => campo.nome),
  });
}

export function serializarSuperficieParaImpacto(superficie: IrSuperficie): string {
  return JSON.stringify({
    tipo: superficie.tipo,
    nome: superficie.nome,
    task: superficie.task,
    input: superficie.input.map((campo) => campo.nome),
    output: superficie.output.map((campo) => campo.nome),
  });
}

export function ordenarArquivosImpacto(arquivos: RegistroImpactoSemanticoArquivo[]): RegistroImpactoSemanticoArquivo[] {
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
  const diretoriosIgnoradosAnteriores = obterDiretoriosIgnoradosAtivos();
  definirDiretoriosIgnoradosAtivos(resolverDiretoriosIgnoradosAtivos(opcoesResolvidas));

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
    definirDiretoriosIgnoradosAtivos(diretoriosIgnoradosAnteriores);
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
