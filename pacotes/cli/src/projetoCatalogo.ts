// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descricao: descobre contratos por caminho e carrega apenas o fechamento transitivo de uses do alvo.

import path from "node:path";
import { realpath } from "node:fs/promises";
import {
  listarCandidatosUseRelativo,
  lerArquivoTexto,
  parsear,
  tokenizar,
  type FonteProjeto,
  type ModuloAst,
} from "@sema/nucleo";

interface ContratoCatalogado {
  fonte: FonteProjeto;
  modulo?: ModuloAst;
}

export interface FechamentoContratosSema {
  fontes: FonteProjeto[];
  dependenciasNaoResolvidas: string[];
}

function caminhoEstaContido(base: string, alvo: string): boolean {
  const relativo = path.relative(base, alvo);
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

function chaveCaminhoReal(caminho: string): string {
  return process.platform === "win32" ? caminho.toLocaleLowerCase("en-US") : caminho;
}

export async function canonicalizarContratosNoProjeto(
  baseProjeto: string,
  arquivos: string[],
): Promise<string[]> {
  const baseReal = await realpath(path.resolve(baseProjeto));
  const canonicos = new Map<string, string>();
  for (const arquivo of arquivos) {
    const caminhoReal = await realpath(path.resolve(arquivo));
    if (!caminhoEstaContido(baseReal, caminhoReal)) {
      throw new Error(`Contrato resolve fora da base do projeto: ${arquivo}`);
    }
    if (path.extname(caminhoReal).toLowerCase() !== ".sema") {
      throw new Error(`Entrada de contrato precisa terminar em .sema: ${arquivo}`);
    }
    canonicos.set(chaveCaminhoReal(caminhoReal), caminhoReal);
  }
  return [...canonicos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function normalizarChaveArquivo(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function chavesSufixoModulo(nomeModulo: string): string[] {
  const partes = nomeModulo.split(".").map(normalizarChaveArquivo).filter(Boolean);
  return partes.map((_, indice) => partes.slice(indice).join("_"));
}

function criarIndiceSufixos(arquivos: string[]): Map<string, string[]> {
  const indice = new Map<string, string[]>();
  for (const arquivo of arquivos) {
    const chave = normalizarChaveArquivo(path.basename(arquivo, path.extname(arquivo)));
    const atuais = indice.get(chave) ?? [];
    atuais.push(path.resolve(arquivo));
    indice.set(chave, atuais);
  }
  for (const caminhos of indice.values()) {
    caminhos.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  return indice;
}

export async function carregarFontesContratos(arquivos: string[]): Promise<FonteProjeto[]> {
  const fontes: FonteProjeto[] = [];
  for (const arquivo of arquivos) {
    const caminho = path.resolve(arquivo);
    fontes.push({ caminho, codigo: await lerArquivoTexto(caminho) });
  }
  return fontes;
}

export async function carregarFechamentoContratosSema(
  arquivosAlvo: string[],
  arquivosDescobertos: string[],
): Promise<FechamentoContratosSema> {
  const descobertos = [...new Set(arquivosDescobertos.map((arquivo) => path.resolve(arquivo)))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const indiceSufixos = criarIndiceSufixos(descobertos);
  const leituras = new Map<string, Promise<ContratoCatalogado>>();
  const caminhosPorModulo = new Map<string, Set<string>>();

  const lerContrato = (arquivo: string): Promise<ContratoCatalogado> => {
    const caminho = path.resolve(arquivo);
    const existente = leituras.get(caminho);
    if (existente) {
      return existente;
    }
    const leitura = (async () => {
      const codigo = await lerArquivoTexto(caminho);
      const resultadoLexer = tokenizar(codigo, caminho);
      const resultadoParser = parsear(resultadoLexer.tokens);
      if (resultadoParser.modulo) {
        const caminhos = caminhosPorModulo.get(resultadoParser.modulo.nome) ?? new Set<string>();
        caminhos.add(caminho);
        caminhosPorModulo.set(resultadoParser.modulo.nome, caminhos);
      }
      return {
        fonte: { caminho, codigo },
        modulo: resultadoParser.modulo,
      };
    })();
    leituras.set(caminho, leitura);
    return leitura;
  };

  const resolverArquivoModulo = async (
    nomeModulo: string,
    moduloAtual: string,
  ): Promise<string | undefined> => {
    const nomesCandidatos = [
      nomeModulo,
      ...listarCandidatosUseRelativo(moduloAtual, nomeModulo),
    ];
    for (const nomeCandidato of nomesCandidatos) {
      const tentados = new Set<string>();
      const encontrados = new Set(caminhosPorModulo.get(nomeCandidato) ?? []);

      for (const chave of chavesSufixoModulo(nomeCandidato)) {
        for (const candidato of indiceSufixos.get(chave) ?? []) {
          tentados.add(candidato);
          const contrato = await lerContrato(candidato);
          if (contrato.modulo?.nome === nomeCandidato) {
            encontrados.add(candidato);
          }
        }
      }

      // Fallback raro para workspaces que nao seguem a convencao modulo -> nome do arquivo.
      // Ele so acontece quando o indice deterministico nao encontrou o modulo desta prioridade.
      if (encontrados.size === 0) {
        for (const candidato of descobertos) {
          if (tentados.has(candidato)) {
            continue;
          }
          const contrato = await lerContrato(candidato);
          if (contrato.modulo?.nome === nomeCandidato) {
            encontrados.add(candidato);
          }
        }
      }

      if (encontrados.size > 1) {
        const caminhos = [...encontrados].sort((a, b) => a.localeCompare(b, "pt-BR"));
        throw new Error(`Modulo Sema ambiguo "${nomeCandidato}" em: ${caminhos.join(", ")}`);
      }
      if (encontrados.size === 1) {
        return [...encontrados][0];
      }
    }
    return undefined;
  };

  const fila = arquivosAlvo.map((arquivo) => path.resolve(arquivo));
  const carregados = new Set<string>();
  const fontes: FonteProjeto[] = [];
  const dependenciasNaoResolvidas = new Set<string>();

  while (fila.length > 0) {
    const arquivo = fila.shift()!;
    if (carregados.has(arquivo)) {
      continue;
    }
    carregados.add(arquivo);

    const contrato = await lerContrato(arquivo);
    fontes.push(contrato.fonte);
    const usesSema = contrato.modulo?.uses
      .filter((use) => use.origem === "sema")
      .map((use) => use.caminho) ?? [];
    for (const use of usesSema) {
      const dependencia = await resolverArquivoModulo(use, contrato.modulo!.nome);
      if (!dependencia) {
        dependenciasNaoResolvidas.add(use);
        continue;
      }
      if (!carregados.has(dependencia)) {
        fila.push(dependencia);
      }
    }
  }

  return {
    fontes,
    dependenciasNaoResolvidas: [...dependenciasNaoResolvidas]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}
