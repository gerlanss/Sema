// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: codigo governado pelo Sema; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descricao: localiza??o e materializa??o dos exemplos oficiais sem depender de caminho local externo.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { caminhoEhDiretorio, caminhoExiste } from "./fsGovernado.js";

const DIRETORIO_CLI_ATUAL = path.dirname(fileURLToPath(import.meta.url));

export interface ResultadoMaterializacaoExemplos {
  sucesso: boolean;
  origem: string | null;
  destino: string;
  criados: string[];
  preservados: string[];
  erro?: string;
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

export async function materializarExemplosOficiais(
  baseProjeto = process.cwd(),
  preservarExistentes = true,
): Promise<ResultadoMaterializacaoExemplos> {
  const origem = await localizarDiretorioExemplosOficiais();
  const destino = path.resolve(baseProjeto, "exemplos");

  if (!origem) {
    return {
      sucesso: false,
      origem: null,
      destino,
      criados: [],
      preservados: [],
      erro: "Diretorio de exemplos oficiais nao foi encontrado no pacote da CLI.",
    };
  }

  await mkdir(destino, { recursive: true });

  const criados: string[] = [];
  const preservados: string[] = [];
  const entradas = await readdir(origem, { withFileTypes: true });

  for (const entrada of entradas.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
    if (!entrada.isFile() || !entrada.name.endsWith(".sema")) {
      continue;
    }

    const origemArquivo = path.join(origem, entrada.name);
    const destinoArquivo = path.join(destino, entrada.name);
    const jaExiste = await caminhoExiste(destinoArquivo);

    if (jaExiste && preservarExistentes) {
      preservados.push(entrada.name);
      continue;
    }

    await writeFile(destinoArquivo, await readFile(origemArquivo, "utf8"), "utf8");
    criados.push(entrada.name);
  }

  return {
    sucesso: true,
    origem,
    destino,
    criados,
    preservados,
  };
}
