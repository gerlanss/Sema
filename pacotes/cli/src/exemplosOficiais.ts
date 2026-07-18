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
  const entradas = (await readdir(origem, { withFileTypes: true }))
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith(".sema"))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return {
    origem,
    arquivos: entradas.map((entrada) => ({
      nome: entrada.name,
      origemArquivo: path.join(origem, entrada.name),
      caminhoRelativo: path.join("exemplos", entrada.name),
    })),
  };
}

export async function materializarExemplosOficiais(
  baseProjeto = process.cwd(),
  preservarExistentes = true,
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

  const criados: string[] = [];
  const preservados: string[] = [];
  await validarDestinosEscritaWorkspace(
    baseProjeto,
    plano.arquivos.map((arquivo) => arquivo.caminhoRelativo),
  );

  for (const arquivo of plano.arquivos) {
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
