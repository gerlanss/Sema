// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.escrita_segura_workspace
// Descrição: localiza e materializa exemplos oficiais sem sobrescrever ou escapar do workspace.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { caminhoEhDiretorio } from "./fsGovernado.js";
import {
  escreverArquivoWorkspaceSeguro,
  validarDestinosEscritaWorkspace,
} from "./workspaceWrite.js";

const DIRETORIO_CLI_ATUAL = path.dirname(fileURLToPath(import.meta.url));
const EXTENSOES_EXEMPLOS_OFICIAIS = new Set([".sema", ".json", ".md"]);

export interface ResultadoMaterializacaoExemplos {
  sucesso: boolean;
  origem: string | null;
  destino: string;
  criados: string[];
  preservados: string[];
  destinosExemplosPrevalidados: boolean;
  erro?: string;
}

export interface PlanoExemplosOficiais {
  origem: string | undefined;
  arquivos: Array<{
    nome: string;
    origemArquivo: string;
    caminhoRelativo: string;
  }>;
}

async function listarArquivosExemplosOficiais(
  origem: string,
  diretorioAtual = origem,
): Promise<PlanoExemplosOficiais["arquivos"]> {
  const arquivos: PlanoExemplosOficiais["arquivos"] = [];
  const entradas = await readdir(diretorioAtual, { withFileTypes: true });

  for (const entrada of entradas) {
    const origemArquivo = path.join(diretorioAtual, entrada.name);
    const relativoOrigem = path.relative(origem, origemArquivo);

    if (entrada.isSymbolicLink()) {
      throw new Error(`Exemplo oficial nao pode atravessar symlink ou junction: ${relativoOrigem}`);
    }
    if (entrada.isDirectory()) {
      arquivos.push(...await listarArquivosExemplosOficiais(origem, origemArquivo));
      continue;
    }
    if (
      !entrada.isFile() ||
      !EXTENSOES_EXEMPLOS_OFICIAIS.has(path.extname(entrada.name).toLowerCase())
    ) {
      continue;
    }

    arquivos.push({
      nome: relativoOrigem,
      origemArquivo,
      caminhoRelativo: path.join("exemplos", relativoOrigem),
    });
  }

  return arquivos;
}


export async function localizarDiretorioExemplosOficiais(): Promise<string | undefined> {
  const candidatos = [
    path.resolve(DIRETORIO_CLI_ATUAL, "..", "exemplos"),
    path.resolve(DIRETORIO_CLI_ATUAL, "..", "..", "..", "exemplos"),
  ];

  for (const candidato of candidatos) {
    if (await caminhoEhDiretorio(candidato)) {
      return candidato;
    }
  }

  return undefined;
}

export async function planejarExemplosOficiais(): Promise<PlanoExemplosOficiais> {
  const origem = await localizarDiretorioExemplosOficiais();
  if (!origem) {
    return { origem: undefined, arquivos: [] };
  }
  const arquivos = await listarArquivosExemplosOficiais(origem);
  arquivos.sort((a, b) => a.caminhoRelativo.localeCompare(b.caminhoRelativo, "pt-BR"));
  return {
    origem,
    arquivos,
  };
}

export function normalizarCaminhoExemplo(caminho: string): string {
  return caminho.replace(/\\/g, "/");
}

export async function materializarExemplosOficiais(
  baseProjeto = process.cwd(),
  preservarExistentes = true,
  somenteCaminhos?: ReadonlySet<string>,
): Promise<ResultadoMaterializacaoExemplos> {
  const plano = await planejarExemplosOficiais();
  const origem = plano.origem;
  const destino = path.resolve(baseProjeto, "exemplos");

  if (!origem) {
    return {
      sucesso: false,
      origem: null,
      destino,
      criados: [],
      preservados: [],
      destinosExemplosPrevalidados: false,
      erro: "Diretorio de exemplos oficiais nao foi encontrado no pacote da CLI.",
    };
  }

  const arquivosSelecionados = somenteCaminhos
    ? plano.arquivos.filter((arquivo) => somenteCaminhos.has(normalizarCaminhoExemplo(arquivo.caminhoRelativo)))
    : plano.arquivos;

  const criados: string[] = [];
  const preservados: string[] = [];
  await validarDestinosEscritaWorkspace(
    baseProjeto,
    arquivosSelecionados.map((arquivo) => arquivo.caminhoRelativo),
  );

  for (const arquivo of arquivosSelecionados) {
    const resultado = await escreverArquivoWorkspaceSeguro(
      baseProjeto,
      arquivo.caminhoRelativo,
      await readFile(arquivo.origemArquivo, "utf8"),
      { sobrescrever: !preservarExistentes },
    );
    if (resultado.status === "preservado") {
      preservados.push(arquivo.nome);
      continue;
    }
    criados.push(arquivo.nome);
  }

  return {
    sucesso: true,
    origem,
    destino,
    criados,
    preservados,
    destinosExemplosPrevalidados: true,
  };
}
