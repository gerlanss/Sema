// SEMA-GOVERNED: sema.produto.orcamento_semantico, sema.produto.escrita_segura_workspace
// Descrição: escrita governada e contida no workspace; consulte os contratos aplicáveis antes de editar.

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  escreverArquivoWorkspaceSeguro,
  validarDestinosEscritaWorkspace,
} from "./workspaceWrite.js";
import {
  avaliarOrcamentoArquivo,
  conteudoTemCabecalhoSemaGoverned,
  contarLinhasConteudo,
  exemploCabecalhoCodigoGovernado,
  LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO,
  tipoArquivoOrcamento,
} from "./driftOrcamento.js";

export async function caminhoExiste(caminhoAlvo: string): Promise<boolean> {
  try {
    await stat(caminhoAlvo);
    return true;
  } catch {
    return false;
  }
}

export interface OpcoesEscritaArquivosGovernados {
  artefatoGerado?: boolean;
  inserirCabecalhoGovernado?: boolean;
}

export interface ArtefatoGeradoAcimaDoLimite {
  caminhoRelativo: string;
  arquivoOrcamento: string;
  linhas: number;
  limite_bloqueio_linhas: number;
}

export interface ResultadoEscritaArquivosGovernados {
  arquivosEscritos: number;
  artefatosGeradosAcimaDoLimite: ArtefatoGeradoAcimaDoLimite[];
}

export function formatarAvisoArtefatosGeradosAcimaDoLimite(
  artefatos: ArtefatoGeradoAcimaDoLimite[],
): string | null {
  if (artefatos.length === 0) {
    return null;
  }

  const linhas = artefatos.slice(0, 5).map((artefato) => (
    `- ${artefato.caminhoRelativo}: ${artefato.linhas} linhas`
  ));
  if (artefatos.length > linhas.length) {
    linhas.push(`- ... mais ${artefatos.length - linhas.length} arquivo(s) gerado(s)`);
  }

  return [
    `Atenção: ${artefatos.length} artefato(s) gerado(s) acima de ${LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO} linhas não foram bloqueados porque são saída determinística.`,
    "Valide a fonte humana governada; não copie esse artefato para código normal.",
    ...linhas,
  ].join("\n");
}

export async function escreverArquivos(
  base: string,
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
  opcoes: OpcoesEscritaArquivosGovernados = {},
): Promise<ResultadoEscritaArquivosGovernados> {
  const resultado: ResultadoEscritaArquivosGovernados = {
    arquivosEscritos: 0,
    artefatosGeradosAcimaDoLimite: [],
  };

  await mkdir(base, { recursive: true });
  await validarDestinosEscritaWorkspace(
    base,
    arquivos.map((arquivo) => arquivo.caminhoRelativo),
  );
  for (const arquivo of arquivos) {
    const deveInserirCabecalho = opcoes.inserirCabecalhoGovernado
      && tipoArquivoOrcamento(arquivo.caminhoRelativo) === "codigo"
      && !conteudoTemCabecalhoSemaGoverned(arquivo.conteudo);
    const conteudo = deveInserirCabecalho
      ? `${exemploCabecalhoCodigoGovernado(arquivo.caminhoRelativo)}\n\n${arquivo.conteudo}`
      : arquivo.conteudo;
    const arquivoOrcamento = opcoes.artefatoGerado
      ? path.join("generated", arquivo.caminhoRelativo)
      : arquivo.caminhoRelativo;
    const linhas = contarLinhasConteudo(conteudo);
    if (opcoes.artefatoGerado && linhas > LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO) {
      resultado.artefatosGeradosAcimaDoLimite.push({
        caminhoRelativo: arquivo.caminhoRelativo,
        arquivoOrcamento: arquivoOrcamento.replace(/\\/g, "/"),
        linhas,
        limite_bloqueio_linhas: LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO,
      });
    }
    const diagnosticoBloqueante = avaliarOrcamentoArquivo({
      arquivo: arquivoOrcamento,
      conteudo,
      exigirCabecalhoCodigoGovernado: true,
    }).find((diagnostico) => diagnostico.bloqueia);
    if (diagnosticoBloqueante) {
      throw new Error(diagnosticoBloqueante.mensagem);
    }
    await escreverArquivoWorkspaceSeguro(base, arquivo.caminhoRelativo, conteudo, {
      sobrescrever: true,
    });
    resultado.arquivosEscritos += 1;
  }

  return resultado;
}


export async function caminhoEhDiretorio(caminhoAlvo: string): Promise<boolean> {
  try {
    return (await stat(caminhoAlvo)).isDirectory();
  } catch {
    return false;
  }
}
