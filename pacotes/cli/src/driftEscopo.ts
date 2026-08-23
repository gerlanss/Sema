// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: planeja o conjunto fisico minimo que pode ser indexado antes de qualquer caminhada de drift.

import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import type { BigIntStats } from "node:fs";
import type { IrImplementacaoTask, IrModulo, IrVinculo } from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type { ConfiguracaoEscopoDriftAplicada, EscopoDriftReal } from "./drift.part01.js";
import {
  filtrarCaminhosEscopoReal,
  resolverDiretoriosCodigoEscopoReal,
} from "./drift.part02.js";
import type { CatalogoDrift } from "./driftCatalogo.js";
import {
  candidatosReferenciaLocalDrift,
  extrairReferenciasLocaisDrift,
  raizesCodigoLogicasDrift,
} from "./driftEscopoReferencias.js";

export { extrairReferenciasLocaisDrift } from "./driftEscopoReferencias.js";

export type EstrategiaEscopoDrift = "arquivos_vinculados" | "projeto";
export type CoberturaEscopoDrift = "completa" | "parcial";

export interface PlanoEscopoDrift {
  escopo: EscopoDriftReal;
  estrategia: EstrategiaEscopoDrift;
  arquivos: string[];
  arquivosDeclarados: string[];
  arquivosInferidos: string[];
  arquivosAusentes: string[];
  arquivosAusentesInferidos: string[];
  diretorios: string[];
  modulos: string[];
  cobertura: CoberturaEscopoDrift;
  bloqueios: string[];
  dependencias: Record<string, string[]>;
}

const CONCORRENCIA_SONDAGENS_DRIFT = 16;
const CONCORRENCIA_MAPEAMENTO_DEPENDENCIAS_DRIFT = 8;

const EXTENSAO_POR_ORIGEM: Record<IrImplementacaoTask["origem"], string[]> = {
  ts: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  js: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"],
  py: [".py"],
  dart: [".dart"],
  lua: [".lua"],
  cs: [".cs"],
  java: [".java"],
  go: [".go"],
  rust: [".rs"],
  cpp: [".cpp", ".cc", ".cxx", ".hpp", ".h"],
  php: [".php"],
};
const EXTENSOES_CODIGO_PLANEJADO = new Set([
  ...Object.values(EXTENSAO_POR_ORIGEM).flat(),
  ".sql", ".psql", ".ddl", ".prisma",
]);

function chaveCaminho(caminho: string): string {
  const absoluto = path.normalize(path.resolve(caminho));
  return process.platform === "win32" ? absoluto.toLowerCase() : absoluto;
}

function caminhoEstaDentro(raiz: string, alvo: string): boolean {
  const relativo = path.relative(path.resolve(raiz), path.resolve(alvo));
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

function identidadesArquivoIguais(a: BigIntStats, b: BigIntStats): boolean {
  return a.isFile()
    && b.isFile()
    && !a.isSymbolicLink()
    && !b.isSymbolicLink()
    && a.dev === b.dev
    && a.ino === b.ino
    && a.size === b.size
    && a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs;
}

async function mapearComLimite<T, R>(
  itens: readonly T[],
  limite: number,
  executar: (item: T) => Promise<R>,
): Promise<R[]> {
  if (itens.length === 0) {
    return [];
  }

  const resultados = new Array<R>(itens.length);
  let proximoIndice = 0;
  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const indice = proximoIndice;
      proximoIndice += 1;
      if (indice >= itens.length) {
        return;
      }
      resultados[indice] = await executar(itens[indice]!);
    }
  };

  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, limite), itens.length) },
    () => trabalhador(),
  ));
  return resultados;
}

async function arquivoRegularContido(caminho: string, raizReal: string): Promise<boolean> {
  try {
    const informacaoAntes = await lstat(caminho, { bigint: true });
    if (!informacaoAntes.isFile() || informacaoAntes.isSymbolicLink()) {
      return false;
    }
    const caminhoReal = await realpath(caminho);
    const informacaoDepois = await lstat(caminho, { bigint: true });
    return caminhoEstaDentro(raizReal, caminhoReal)
      && identidadesArquivoIguais(informacaoAntes, informacaoDepois);
  } catch {
    return false;
  }
}

async function sondarArquivosRegularesContidos(
  caminhos: readonly string[],
  raizReal: string,
): Promise<Map<string, boolean>> {
  const unicos = [...new Map(
    caminhos.map((caminho) => [chaveCaminho(caminho), caminho] as const),
  ).entries()];
  const resultados = await mapearComLimite(
    unicos,
    CONCORRENCIA_SONDAGENS_DRIFT,
    async ([chave, caminho]) => [chave, await arquivoRegularContido(caminho, raizReal)] as const,
  );
  return new Map(resultados);
}

function vinculosModulo(ir: IrModulo): IrVinculo[] {
  return [
    ...ir.vinculos,
    ...ir.tasks.flatMap((task) => task.vinculos),
    ...ir.flows.flatMap((flow) => flow.vinculos),
    ...ir.routes.flatMap((route) => route.vinculos),
    ...ir.superficies.flatMap((superficie) => superficie.vinculos),
  ];
}

function implementacoesModulo(ir: IrModulo): IrImplementacaoTask[] {
  return [
    ...ir.tasks.flatMap((task) => task.implementacoesExternas),
    ...ir.superficies.flatMap((superficie) => superficie.implementacoesExternas),
  ];
}

function moduloExigeAncoraCodigo(ir: IrModulo): boolean {
  return ir.tasks.length > 0
    || ir.routes.length > 0
    || ir.superficies.length > 0
    || implementacoesModulo(ir).length > 0
    || vinculosModulo(ir).some((vinculo) => Boolean(
      vinculo.arquivo || vinculo.tipo === "arquivo",
    ));
}

function resolverArquivoWorkspace(baseProjeto: string, valor: string): string | undefined {
  const absoluto = path.isAbsolute(valor)
    ? path.resolve(valor)
    : path.resolve(baseProjeto, valor);
  return caminhoEstaDentro(baseProjeto, absoluto) ? absoluto : undefined;
}

function descreverArquivoForaWorkspace(valor: string): string {
  const nome = path.basename(path.normalize(valor)) || "alvo";
  return `[fora_do_workspace]/${nome}`;
}

function variantesSegmentoDiretorio(segmento: string): string[] {
  const camel = segmento.replace(/_([a-z0-9])/gi, (_ocorrencia, caractere: string) => caractere.toUpperCase());
  return [...new Set([
    segmento,
    segmento.includes("_") ? segmento.replace(/_/g, "-") : undefined,
    segmento.includes("_") && camel !== segmento ? camel : undefined,
    /(?:^|_)id$/i.test(segmento) ? `[${segmento}]` : undefined,
    /(?:^|_)id$/i.test(segmento) && camel !== segmento ? `[${camel}]` : undefined,
  ].filter((item): item is string => Boolean(item)))];
}

function adicionarCandidatoPreservandoForma(
  candidatos: Map<string, string>,
  baseProjeto: string,
  caminho: string,
): void {
  const absoluto = path.resolve(caminho);
  if (!caminhoEstaDentro(baseProjeto, absoluto)) {
    return;
  }
  const chave = chaveCaminho(absoluto);
  if (!candidatos.has(chave)) {
    candidatos.set(chave, absoluto);
  }
}

function variantesNomeArquivo(segmento: string): string[] {
  const pascal = segmento
    .split(/[_-]+/)
    .filter(Boolean)
    .map((parte) => `${parte[0]?.toUpperCase() ?? ""}${parte.slice(1)}`)
    .join("");
  return [...new Set([
    segmento,
    segmento.includes("_") ? segmento.replace(/_/g, "-") : undefined,
    segmento.includes("_") ? segmento.replace(/_/g, ".") : undefined,
    pascal && pascal !== segmento ? pascal : undefined,
  ].filter((item): item is string => Boolean(item)))];
}

function resolverDiretoriosCodigoPlanejados(
  contexto: ContextoProjetoCarregado,
  irs: readonly IrModulo[],
  configuracao: ConfiguracaoEscopoDriftAplicada,
): string[] {
  const raizesModulo = irs.flatMap((ir) => {
    const primeiroSegmento = ir.nome.split(".").map((item) => item.trim()).find(Boolean);
    return primeiroSegmento
      ? variantesNomeArquivo(primeiroSegmento).map((segmento) => path.resolve(contexto.baseProjeto, segmento))
      : [];
  });
  const candidatos = [...resolverDiretoriosCodigoEscopoReal(contexto, configuracao), ...raizesModulo];
  return [...new Map(
    filtrarCaminhosEscopoReal(candidatos, contexto, configuracao)
      .map((diretorio) => [chaveCaminho(diretorio), diretorio] as const),
  ).values()];
}

function variantesCaminhoSegmentos(segmentos: string[]): string[][] {
  let variantes: string[][] = [[]];
  for (const segmento of segmentos) {
    const opcoes = variantesSegmentoDiretorio(segmento);
    variantes = variantes.flatMap((prefixo) => opcoes.map((opcao) => [...prefixo, opcao]));
  }
  return variantes.slice(0, 16);
}

function candidatosArquivoImpl(
  contexto: ContextoProjetoCarregado,
  impl: IrImplementacaoTask,
  diretoriosCodigo: readonly string[] = contexto.diretoriosCodigo,
): string[][] {
  const grupos: string[][] = [];

  if (impl.origemArquivo) {
    const declarado = resolverArquivoWorkspace(contexto.baseProjeto, impl.origemArquivo);
    if (declarado) {
      grupos.push([declarado]);
    }
  }

  const partes = impl.caminho.split(".").map((parte) => parte.trim()).filter(Boolean);
  if (partes.length < 2) {
    return grupos;
  }

  const bases = [...new Map(
    [contexto.baseProjeto, ...diretoriosCodigo]
      .map((base) => [chaveCaminho(base), base] as const),
  ).values()];
  const extensoes = EXTENSAO_POR_ORIGEM[impl.origem] ?? [];
  for (const removerCauda of [1, 2]) {
    const candidatos = new Map<string, string>();
    const adicionar = (caminho: string): void => {
      adicionarCandidatoPreservandoForma(candidatos, contexto.baseProjeto, caminho);
    };
    const segmentosOriginais = partes.slice(0, Math.max(1, partes.length - removerCauda));
    for (const base of bases) {
      const nomeBase = path.basename(base).toLowerCase();
      const segmentos = segmentosOriginais[0]?.toLowerCase() === nomeBase
        ? segmentosOriginais.slice(1)
        : segmentosOriginais;
      if (segmentos.length === 0) {
        continue;
      }
      for (const diretorios of variantesCaminhoSegmentos(segmentos.slice(0, -1))) {
        for (const nomeArquivo of variantesNomeArquivo(segmentos.at(-1)!)) {
          for (const extensao of extensoes) {
            adicionar(path.join(base, ...diretorios, `${nomeArquivo}${extensao}`));
          }
        }
      }
      for (const caminhoDiretorio of variantesCaminhoSegmentos(segmentos)) {
        for (const extensao of extensoes) {
          adicionar(path.join(base, ...caminhoDiretorio, `index${extensao}`));
        }
      }
    }
    if (candidatos.size > 0) {
      grupos.push([...candidatos.values()]);
    }
  }
  return grupos;
}

function candidatosConsumerDeterministicos(
  contexto: ContextoProjetoCarregado,
  irs: IrModulo[],
  termosEscopo: string[],
  diretoriosCodigo: readonly string[],
): string[] {
  const segmentos = new Set<string>();
  for (const termo of termosEscopo) {
    segmentos.add(termo);
    segmentos.add(termo.replace(/_/g, "-"));
  }
  for (const ir of irs) {
    for (const rota of ir.routes) {
      for (const segmento of (rota.caminho ?? "").split("/").filter((item) => item && !item.startsWith(":"))) {
        segmentos.add(segmento);
      }
    }
  }

  const candidatos = new Map<string, string>();
  const extensoes = [".ts", ".tsx", ".js", ".jsx"];
  for (const raiz of diretoriosCodigo) {
    for (const segmento of segmentos) {
      for (const extensao of extensoes) {
        for (const relativo of [
          ["src", "app", segmento, `page${extensao}`],
          ["app", segmento, `page${extensao}`],
          ["src", "pages", `${segmento}${extensao}`],
          ["pages", `${segmento}${extensao}`],
        ]) {
          adicionarCandidatoPreservandoForma(
            candidatos,
            contexto.baseProjeto,
            path.resolve(raiz, ...relativo),
          );
        }
      }
    }
  }
  return [...candidatos.values()];
}

function candidatosRotasDeterministicos(
  contexto: ContextoProjetoCarregado,
  irs: IrModulo[],
  diretoriosCodigo: readonly string[],
): string[] {
  const candidatos = new Map<string, string>();
  const extensoes = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];
  const segmentos = new Set<string>();

  for (const ir of irs) {
    for (const rota of ir.routes) {
      for (const segmento of (rota.caminho ?? "").split("/").filter((item) => item && !item.startsWith(":") && !item.startsWith("{"))) {
        segmentos.add(segmento);
      }
    }
  }

  for (const raiz of diretoriosCodigo) {
    for (const segmento of segmentos) {
      const nomes = variantesNomeArquivo(segmento);
      for (const nome of nomes) {
        for (const extensao of extensoes) {
          for (const relativo of [
            [segmento, `${nome}.controller${extensao}`],
            [`${nome}.controller${extensao}`],
            ["controllers", `${nome}.controller${extensao}`],
            ["routes", `${nome}${extensao}`],
          ]) {
            adicionarCandidatoPreservandoForma(
              candidatos,
              contexto.baseProjeto,
              path.resolve(raiz, ...relativo),
            );
          }
        }
      }
    }
  }
  return [...candidatos.values()];
}

function candidatosRotasNextDeterministicos(
  contexto: ContextoProjetoCarregado,
  irs: IrModulo[],
  diretoriosCodigo: readonly string[],
): string[] {
  const candidatos = new Map<string, string>();
  const extensoes = [".ts", ".tsx", ".js", ".jsx"];

  for (const ir of irs) {
    for (const rota of ir.routes) {
      const caminho = (rota.caminho ?? "").trim();
      if (!caminho.startsWith("/")) {
        continue;
      }
      const segmentos = caminho.split("/").filter(Boolean).map((segmento) =>
        segmento.replace(/^\{(.+)\}$/u, "[$1]").replace(/^:(.+)$/u, "[$1]"));
      if (segmentos.length === 0) {
        continue;
      }
      const ultimo = segmentos.at(-1)!;
      const intermediarios = segmentos.slice(0, -1);
      const segmentosApi = segmentos[0] === "api" ? segmentos.slice(1) : segmentos;
      const ultimoApi = segmentosApi.length > 0 ? segmentosApi.at(-1)! : undefined;
      const intermediariosApi = segmentosApi.length > 0 ? segmentosApi.slice(0, -1) : [];

      for (const raiz of diretoriosCodigo) {
        for (const extensao of extensoes) {
          // Next.js App Router: src/app/<caminho>/route.ts e app/<caminho>/route.ts
          adicionarCandidatoPreservandoForma(
            candidatos,
            contexto.baseProjeto,
            path.resolve(raiz, "src", "app", ...segmentos, `route${extensao}`),
          );
          adicionarCandidatoPreservandoForma(
            candidatos,
            contexto.baseProjeto,
            path.resolve(raiz, "app", ...segmentos, `route${extensao}`),
          );
          // Next.js Pages Router API: src/pages/api/<caminho>.ts e pages/api/<caminho>.ts
          if (ultimoApi !== undefined) {
            adicionarCandidatoPreservandoForma(
              candidatos,
              contexto.baseProjeto,
              path.resolve(raiz, "src", "pages", "api", ...intermediariosApi, `${ultimoApi}${extensao}`),
            );
            adicionarCandidatoPreservandoForma(
              candidatos,
              contexto.baseProjeto,
              path.resolve(raiz, "pages", "api", ...intermediariosApi, `${ultimoApi}${extensao}`),
            );
          }
        }
      }
    }
  }
  return [...candidatos.values()];
}

function candidatosConvencionaisEscopo(
  contexto: ContextoProjetoCarregado,
  irs: IrModulo[],
  diretoriosCodigo: readonly string[],
): string[] {
  const candidatos = new Map<string, string>();
  const adicionar = (caminho: string): void => {
    adicionarCandidatoPreservandoForma(candidatos, contexto.baseProjeto, caminho);
  };
  const origens = new Set(irs.flatMap((ir) => implementacoesModulo(ir).map((impl) => impl.origem)));
  const possuiRotas = irs.some((ir) => ir.routes.length > 0);
  const possuiPersistencia = irs.some((ir) =>
    ir.databases.length > 0
    || ir.tasks.some((task) => task.effects.some((efeito) => /\b(?:db|database|persist|storage)\b/i.test(efeito))),
  );
  const bases = diretoriosCodigo;

  if (possuiRotas && origens.has("rust")) {
    for (const base of bases) {
      adicionar(path.join(base, "main.rs"));
      adicionar(path.join(base, "src", "main.rs"));
      adicionar(path.join(base, "lib.rs"));
      adicionar(path.join(base, "src", "lib.rs"));
    }
  }
  if (possuiPersistencia) {
    for (const base of bases) {
      adicionar(path.join(base, "schema.sql"));
      adicionar(path.join(base, "schema.prisma"));
      adicionar(path.join(base, "db", "schema.sql"));
      adicionar(path.join(base, "prisma", "schema.prisma"));
    }
  }
  return [...candidatos.values()];
}

function escolherDiretoriosLogicos(
  contexto: ContextoProjetoCarregado,
  arquivos: string[],
  diretoriosCodigo: readonly string[] = contexto.diretoriosCodigo,
): string[] {
  const candidatos = [...new Map(
    diretoriosCodigo
      .map((diretorio) => path.resolve(diretorio))
      .map((diretorio) => [chaveCaminho(diretorio), diretorio] as const),
  ).values()]
    .sort((a, b) => b.length - a.length || a.localeCompare(b, "pt-BR"));
  const escolhidos = new Map<string, string>();

  for (const arquivo of arquivos) {
    if (!EXTENSOES_CODIGO_PLANEJADO.has(path.extname(arquivo).toLowerCase())) {
      continue;
    }
    const raiz = candidatos.find((diretorio) => caminhoEstaDentro(diretorio, arquivo));
    const raizEfetiva = raiz ?? path.dirname(arquivo);
    escolhidos.set(chaveCaminho(raizEfetiva), raizEfetiva);
  }
  return [...escolhidos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function planejarEscopoDrift(
  contexto: ContextoProjetoCarregado,
  configuracao: ConfiguracaoEscopoDriftAplicada,
): Promise<PlanoEscopoDrift> {
  if (configuracao.escopo === "projeto") {
    const diretorios = resolverDiretoriosCodigoEscopoReal(contexto, configuracao);
    return {
      escopo: configuracao.escopo,
      estrategia: "projeto",
      arquivos: [],
      arquivosDeclarados: [],
      arquivosInferidos: [],
      arquivosAusentes: [],
      arquivosAusentesInferidos: [],
      diretorios,
      modulos: contexto.modulosSelecionados
        .map((modulo) => modulo.resultado.ir?.nome)
        .filter((nome): nome is string => Boolean(nome)),
      cobertura: "completa",
      bloqueios: [],
      dependencias: {},
    };
  }

  const modulosFonte = configuracao.escopo === "arquivo"
    ? contexto.modulosSelecionados
    : contexto.modulosCarregados;
  const irs = modulosFonte
    .map((modulo) => modulo.resultado.ir)
    .filter((ir): ir is IrModulo => Boolean(ir));
  const declarados = new Map<string, string>();
  const ausentes = new Map<string, string>();
  const ausentesInferidos = new Map<string, string>();
  const inferidos = new Map<string, string>();
  const bloqueiosPlano = new Set<string>();
  const raizReal = await realpath(contexto.baseProjeto);
  const diretoriosCodigoPermitidos = resolverDiretoriosCodigoPlanejados(contexto, irs, configuracao);

  const vinculosPlanejados = irs.flatMap((ir) => vinculosModulo(ir))
    .map((vinculo) => vinculo.arquivo ?? (vinculo.tipo === "arquivo" ? vinculo.valor : undefined))
    .filter((valor): valor is string => Boolean(valor))
    .map((valor) => ({
      valor,
      absoluto: resolverArquivoWorkspace(contexto.baseProjeto, valor),
    }));
  const implementacoesPlanejadas = irs
    .flatMap((ir) => implementacoesModulo(ir))
    .map((impl) => candidatosArquivoImpl(contexto, impl, diretoriosCodigoPermitidos));
  const resultadoSondagens = await sondarArquivosRegularesContidos([
    ...vinculosPlanejados.flatMap((vinculo) => vinculo.absoluto ? [vinculo.absoluto] : []),
    ...implementacoesPlanejadas.flat(2),
  ], raizReal);
  const arquivoExiste = (arquivo: string): boolean => resultadoSondagens.get(chaveCaminho(arquivo)) === true;

  for (const vinculo of vinculosPlanejados) {
    if (!vinculo.absoluto) {
      const descricaoSegura = descreverArquivoForaWorkspace(vinculo.valor);
      ausentes.set(`fora:${descricaoSegura}`, descricaoSegura);
      continue;
    }
    if (arquivoExiste(vinculo.absoluto)) {
      declarados.set(chaveCaminho(vinculo.absoluto), vinculo.absoluto);
    } else {
      ausentes.set(chaveCaminho(vinculo.absoluto), vinculo.absoluto);
    }
  }

  const raizesDeclaradasCodigo = escolherDiretoriosLogicos(contexto, [...declarados.values()]);
  for (const gruposCandidatos of implementacoesPlanejadas) {
    const grupoResolvido = gruposCandidatos.find((grupo) => grupo.some(arquivoExiste));
    let encontrados = grupoResolvido?.filter(arquivoExiste) ?? [];
    const encontradosDeclarados = encontrados.filter((candidato) => declarados.has(chaveCaminho(candidato)));
    if (encontradosDeclarados.length > 0) {
      encontrados = encontradosDeclarados;
    } else if (raizesDeclaradasCodigo.length > 0) {
      const proximosDeDeclarados = encontrados.filter((candidato) =>
        raizesDeclaradasCodigo.some((raiz) => caminhoEstaDentro(raiz, candidato)),
      );
      if (proximosDeDeclarados.length > 0) {
        encontrados = proximosDeDeclarados;
      }
    }
    if (encontrados.length > 1) {
      bloqueiosPlano.add("escopo_estreito_ambiguo");
      continue;
    }
    for (const candidato of encontrados) {
      const chave = chaveCaminho(candidato);
      if (!declarados.has(chave) && !inferidos.has(chave)) {
        inferidos.set(chave, candidato);
      }
    }
    const primeiroCandidato = gruposCandidatos[0]?.[0];
    if (encontrados.length === 0 && primeiroCandidato) {
      // Candidato derivado do simbolo do impl, nao uma promessa do contrato:
      // ausencia aqui e informacao de ancoragem, nunca vinculo quebrado.
      ausentesInferidos.set(chaveCaminho(primeiroCandidato), primeiroCandidato);
    }
  }

  const raizesAncoradas = escolherDiretoriosLogicos(
    contexto,
    [...declarados.values(), ...inferidos.values()],
  );
  if (raizesAncoradas.length > 0) {
    const candidatosDeterministicos = [
      ...candidatosConsumerDeterministicos(
        contexto,
        irs,
        configuracao.termosEscopo,
        raizesAncoradas,
      ),
      ...candidatosRotasDeterministicos(contexto, irs, raizesAncoradas),
      ...candidatosRotasNextDeterministicos(contexto, irs, raizesAncoradas),
      ...candidatosConvencionaisEscopo(contexto, irs, raizesAncoradas),
    ];
    const sondagensDeterministicas = await sondarArquivosRegularesContidos(
      candidatosDeterministicos,
      raizReal,
    );
    for (const candidato of candidatosDeterministicos) {
      if (sondagensDeterministicas.get(chaveCaminho(candidato)) !== true) {
        continue;
      }
      const chave = chaveCaminho(candidato);
      if (!declarados.has(chave) && !inferidos.has(chave)) {
        inferidos.set(chave, candidato);
      }
    }
  }

  const arquivosMesclados = new Map(declarados);
  for (const [chave, arquivo] of inferidos) {
    if (!arquivosMesclados.has(chave)) {
      arquivosMesclados.set(chave, arquivo);
    }
  }
  const arquivos = [...arquivosMesclados.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const arquivosAusentes = [...ausentes.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const arquivosAusentesInferidos = [...ausentesInferidos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const exigeAncoraCodigo = irs.some(moduloExigeAncoraCodigo);
  if (arquivos.length === 0
    && exigeAncoraCodigo
    && !bloqueiosPlano.has("escopo_estreito_ambiguo")) {
    bloqueiosPlano.add("escopo_estreito_sem_vinculos");
  }
  const bloqueios = [...bloqueiosPlano].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    escopo: configuracao.escopo,
    estrategia: "arquivos_vinculados",
    arquivos,
    arquivosDeclarados: [...declarados.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    arquivosInferidos: [...inferidos.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    arquivosAusentes,
    arquivosAusentesInferidos,
    diretorios: escolherDiretoriosLogicos(contexto, arquivos),
    modulos: irs.map((ir) => ir.nome),
    cobertura: arquivosAusentes.length === 0 && bloqueios.length === 0 ? "completa" : "parcial",
    bloqueios,
    dependencias: {},
  };
}

interface ConfinamentoDependenciasDrift {
  raizWorkspaceReal: string;
  raizesCodigoLogicas: string[];
  raizesCodigoReais: string[];
}

interface ResultadoReferenciaLocalDrift {
  referencia: string;
  resolvida?: string;
  ausente?: string;
}

async function construirConfinamentoDependencias(
  contexto: ContextoProjetoCarregado,
): Promise<ConfinamentoDependenciasDrift> {
  const raizWorkspaceReal = await realpath(contexto.baseProjeto);
  const logicas = raizesCodigoLogicasDrift(contexto);
  const reaisPossiveis = await mapearComLimite(
    logicas,
    CONCORRENCIA_SONDAGENS_DRIFT,
    async (raiz): Promise<string | undefined> => {
      try {
        const raizReal = await realpath(raiz);
        return caminhoEstaDentro(raizWorkspaceReal, raizReal) ? raizReal : undefined;
      } catch {
        return undefined;
      }
    },
  );
  const raizesCodigoReais = [...new Map(
    reaisPossiveis
      .filter((raiz): raiz is string => Boolean(raiz))
      .map((raiz) => [chaveCaminho(raiz), raiz] as const),
  ).values()];
  return {
    raizWorkspaceReal,
    raizesCodigoLogicas: logicas,
    raizesCodigoReais,
  };
}

async function arquivoRegularConfinadoDependencias(
  caminho: string,
  confinamento: ConfinamentoDependenciasDrift,
): Promise<boolean> {
  const absoluto = path.resolve(caminho);
  if (!confinamento.raizesCodigoLogicas.some((raiz) => caminhoEstaDentro(raiz, absoluto))) {
    return false;
  }
  try {
    const informacaoAntes = await lstat(absoluto, { bigint: true });
    if (!informacaoAntes.isFile() || informacaoAntes.isSymbolicLink()) {
      return false;
    }
    const caminhoReal = await realpath(absoluto);
    const informacaoDepois = await lstat(absoluto, { bigint: true });
    return caminhoEstaDentro(confinamento.raizWorkspaceReal, caminhoReal)
      && confinamento.raizesCodigoReais.some((raiz) => caminhoEstaDentro(raiz, caminhoReal))
      && identidadesArquivoIguais(informacaoAntes, informacaoDepois);
  } catch {
    return false;
  }
}

function candidatoAusenteSeguro(
  contexto: ContextoProjetoCarregado,
  candidatos: readonly string[],
  referencia: string,
): string {
  const seguro = candidatos.find((candidato) => caminhoEstaDentro(contexto.baseProjeto, candidato));
  return seguro ?? referencia;
}

function referenciaPythonEhLocalObrigatoria(referencia: string): boolean {
  return referencia.startsWith("python:.");
}

async function resolverReferenciasLocais(
  contexto: ContextoProjetoCarregado,
  arquivoOrigem: string,
  referencias: readonly string[],
  confinamento: ConfinamentoDependenciasDrift,
): Promise<ResultadoReferenciaLocalDrift[]> {
  const resultados = await mapearComLimite(
    referencias,
    CONCORRENCIA_SONDAGENS_DRIFT,
    async (referencia): Promise<ResultadoReferenciaLocalDrift> => {
      const candidatos = candidatosReferenciaLocalDrift(contexto, arquivoOrigem, referencia);
      for (const candidato of candidatos) {
        if (await arquivoRegularConfinadoDependencias(candidato, confinamento)) {
          return { referencia, resolvida: candidato };
        }
      }
      const ehPython = referencia.startsWith("python:");
      return {
        referencia,
        ausente: !ehPython || referenciaPythonEhLocalObrigatoria(referencia)
          ? candidatoAusenteSeguro(contexto, candidatos, referencia)
          : undefined,
      };
    },
  );

  const modulosPythonResolvidos = resultados
    .filter((item) => item.resolvida && item.referencia.startsWith("python:"))
    .map((item) => item.referencia.slice("python:".length));

  const dependenciasPythonMarcadas = resultados.map((item) => {
    if (item.resolvida || !item.referencia.startsWith("python:")) {
      return item;
    }
    const modulo = item.referencia.slice("python:".length);
    const prefixoLocalResolvido = modulosPythonResolvidos.some((prefixo) =>
      prefixo !== modulo && modulo.startsWith(`${prefixo}.`),
    );
    if (!referenciaPythonEhLocalObrigatoria(item.referencia) && !prefixoLocalResolvido) {
      return item;
    }
    const candidatos = candidatosReferenciaLocalDrift(contexto, arquivoOrigem, item.referencia);
    return {
      referencia: item.referencia,
      ausente: candidatoAusenteSeguro(contexto, candidatos, item.referencia),
    };
  });
  const modulosPythonAusentes = dependenciasPythonMarcadas
    .filter((item) => item.ausente && item.referencia.startsWith("python:"))
    .map((item) => item.referencia.slice("python:".length));

  return dependenciasPythonMarcadas.map((item) => {
    if (!item.ausente || !item.referencia.startsWith("python:")) {
      return item;
    }
    const modulo = item.referencia.slice("python:".length);
    const possuiPaiAusente = modulosPythonAusentes.some((prefixo) =>
      prefixo !== modulo && modulo.startsWith(`${prefixo}.`),
    );
    return possuiPaiAusente ? { referencia: item.referencia } : item;
  });
}

export async function expandirDependenciasPlanoDrift(
  contexto: ContextoProjetoCarregado,
  plano: PlanoEscopoDrift,
  catalogo: CatalogoDrift,
): Promise<PlanoEscopoDrift> {
  if (plano.estrategia !== "arquivos_vinculados" || plano.arquivos.length === 0) {
    return plano;
  }

  const arquivos = new Map(plano.arquivos.map((arquivo) => [chaveCaminho(arquivo), arquivo] as const));
  const inferidos = new Map(plano.arquivosInferidos.map((arquivo) => [chaveCaminho(arquivo), arquivo] as const));
  const ausentes = new Map(plano.arquivosAusentes.map((arquivo) => [chaveCaminho(arquivo), arquivo] as const));
  const visitados = new Set<string>();
  const fila = [...plano.arquivos];
  const confinamento = await construirConfinamentoDependencias(contexto);
  const dependencias = new Map<string, Set<string>>(
    Object.entries(plano.dependencias).map(([arquivo, itens]) => [arquivo, new Set(itens)]),
  );

  while (fila.length > 0) {
    const lote = fila.splice(0).filter((arquivo) => {
      const chave = chaveCaminho(arquivo);
      if (visitados.has(chave)) {
        return false;
      }
      visitados.add(chave);
      return true;
    });
    const resultadosLote = await mapearComLimite(
      lote,
      CONCORRENCIA_MAPEAMENTO_DEPENDENCIAS_DRIFT,
      async (arquivo) => {
        try {
          const referencias = extrairReferenciasLocaisDrift(
            await catalogo.lerTexto(arquivo),
            { contexto, arquivoOrigem: arquivo },
          );
          return {
            arquivo,
            referencias: await resolverReferenciasLocais(contexto, arquivo, referencias, confinamento),
          };
        } catch {
          return {
            arquivo,
            referencias: [] as ResultadoReferenciaLocalDrift[],
            leituraFalhou: true,
          };
        }
      },
    );

    const candidatosParaIncluir = new Map<string, string>();
    for (const resultado of resultadosLote) {
      if (resultado.leituraFalhou) {
        ausentes.set(chaveCaminho(resultado.arquivo), resultado.arquivo);
      }
      for (const referencia of resultado.referencias) {
        if (referencia.ausente) {
          ausentes.set(chaveCaminho(referencia.ausente), referencia.ausente);
        }
        if (referencia.resolvida && !catalogo.contem(referencia.resolvida)) {
          candidatosParaIncluir.set(chaveCaminho(referencia.resolvida), referencia.resolvida);
        }
      }
    }
    await catalogo.incluir([...candidatosParaIncluir.values()]);

    const novos = new Map<string, string>();
    for (const resultado of resultadosLote) {
      const lista = dependencias.get(resultado.arquivo) ?? new Set<string>();
      for (const referencia of resultado.referencias) {
        if (!referencia.resolvida) {
          continue;
        }
        if (!catalogo.contem(referencia.resolvida)) {
          ausentes.set(chaveCaminho(referencia.resolvida), referencia.resolvida);
          continue;
        }
        lista.add(referencia.resolvida);
        const chave = chaveCaminho(referencia.resolvida);
        if (!arquivos.has(chave)) {
          novos.set(chave, referencia.resolvida);
        }
      }
      if (lista.size > 0) {
        dependencias.set(resultado.arquivo, lista);
      }
    }

    const novosOrdenados = [...novos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
    for (const candidato of novosOrdenados) {
      const chave = chaveCaminho(candidato);
      arquivos.set(chave, candidato);
      inferidos.set(chave, candidato);
      fila.push(candidato);
    }
  }

  const arquivosExpandidos = [...arquivos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const arquivosAusentes = [...ausentes.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    ...plano,
    arquivos: arquivosExpandidos,
    arquivosInferidos: [...inferidos.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    arquivosAusentes,
    diretorios: escolherDiretoriosLogicos(contexto, arquivosExpandidos),
    cobertura: arquivosAusentes.length === 0 && plano.bloqueios.length === 0 ? "completa" : "parcial",
    dependencias: Object.fromEntries(
      [...dependencias.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([arquivo, itens]) => [arquivo, [...itens].sort((a, b) => a.localeCompare(b, "pt-BR"))]),
    ),
  };
}
